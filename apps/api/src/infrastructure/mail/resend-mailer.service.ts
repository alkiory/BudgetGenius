import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { LoggingService } from '@infrastructure/log/logger.service';

/**
 * Resend-based transactional mailer for BudgetGenius.
 *
 * Used by `AuthService.requestPasswordReset` to deliver the password
 * recovery link via Resend's HTTP API (no SMTP setup required).
 *
 * Provider resolution: RESEND_API_KEY env var. Resend's free tier ships
 * from `onboarding@resend.dev` until a custom domain is verified in
 * their dashboard; this code reads `MAIL_FROM` so you can override the
 * sender without redeploying.
 *
 * Hard-fail on missing config: if `RESEND_API_KEY` is unset the service
 * throws at construction time so the process refuses to boot rather
 * than silently swallowing every email — security-critical because
 * `forgot-password` returning success-without-delivery was the original
 * production bug.
 *
 * Send counters: per-call sent counters (attempts → successes / failures)
 * surface through `LoggingService` so ops can see Resend's free-tier
 * daily cap (~100/day from `onboarding@resend.dev`) being pressured.
 * Milestone log lines fire every `MAILER_COUNTER_MILESTONE` successful
 * sends (env-configurable, default 25) with the running totals;
 * failures log immediately at `error` level.
 *
 * Per-process limitation: counters are instance-local and reset on
 * process restart, so they do NOT auto-reset at "midnight UTC". For
 * multi-instance deployments swap for a Redis-backed counter
 * (out of scope here, but flagged in the comment so the call site is
 * obvious when it matters).
 *
 * Ops visibility note: `LoggingService` is a Winston-backed logger that
 * writes to `stdout` (via the Console transport) AND to
 * `logs/app.log` / `logs/error.log`. In Docker without a persistent
 * volume mounted at `/app/logs/`, the file writes silently fail; what
 * the operator sees is the container's stdout — so the milestone and
 * failure lines ARE surfaced via whatever Docker log driver / journald /
 * CloudWatch is forwarding stdout. The file log is best-effort
 * secondary storage in production.
 */
@Injectable()
export class ResendMailerService {
  /**
   * Number of successes between milestone log lines. Default 25 emits
   * ~4 lines/day against Resend's free-tier ~100/day ceiling. Ops can
   * tune density via the `MAILER_COUNTER_MILESTONE` env var without a
   * redeploy.
   */
  private static readonly DEFAULT_COUNTER_MILESTONE = 25;

  private readonly counterMilestone: number;

  private readonly client: Resend;
  private readonly from: string;

  // Counter state — instance-local. Resets when the process restarts;
  // for multi-instance or shared global rate-limit visibility, swap
  // for a Redis-backed INCR on a 24h-TTL key.
  private mailerAttempts = 0;
  private mailerSuccesses = 0;
  private mailerFailures = 0;

  constructor(
    configService: ConfigService,
    private readonly logger: LoggingService,
  ) {
    const apiKey = configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error(
        'RESEND_API_KEY is required for outbound transactional mail. Add it to the .env(development/production) file.',
      );
    }
    this.client = new Resend(apiKey);
    this.from =
      configService.get<string>('MAIL_FROM') ??
      'BudgetGenius <onboarding@resend.dev>';
    // Env-configurable milestone so ops can tune log density without
    // a redeploy. Falls back to the static default when unset or zero
    // (e.g., an empty string from the env file).
    const raw = configService.get<number | string>('MAILER_COUNTER_MILESTONE');
    const parsed = Number(raw);
    this.counterMilestone =
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : ResendMailerService.DEFAULT_COUNTER_MILESTONE;
  }

  /**
   * Send a password-reset email. The reset URL must be fully qualified
   * (https://…). Returns the Resend message id; throws on transport
   * error so the caller (AuthService) can surface a 5xx.
   *
   * Counter semantics:
   *  - `mailerAttempts` increments on every call (success OR failure).
   *  - `mailerSuccesses` increments exclusively on confirmed send.
   *  - `mailerFailures` increments on either a Resend API error or an
   *    SDK/network exception.
   * The same call NEVER lands in both successes and failures — the
   * early-return guards enforce this.
   */
  async sendPasswordReset(to: string, resetUrl: string): Promise<string> {
    // Counter increment at every call site, as the original task spec
    // required. The success / failure branches below roll this single
    // attempt into exactly one of the outcome bins.
    this.mailerAttempts++;

    const subject = '🔐 Restablece tu contraseña de BudgetGenius';
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #1a73e8;">Restablece tu contraseña</h2>
        <p>Hola,</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en BudgetGenius.
           Si no fuiste tú, puedes ignorar este mensaje — tu contraseña seguirá siendo la misma.</p>
        <p style="margin: 32px 0; text-align: center;">
          <a href="${resetUrl}"
             style="background-color: #1a73e8; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Restablecer contraseña
          </a>
        </p>
        <p>O copia y pega este enlace en tu navegador:</p>
        <p style="word-break: break-all; color: #555;">${resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
          Este enlace expira en 1 hora. Por tu seguridad, después de usarlo ya no servirá.
        </p>
      </div>
    `;

    let messageId: string | undefined;
    let failureReason: string | undefined;
    try {
      const result = await this.client.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });
      if (result.error) {
        failureReason = `Resend API: ${result.error.message}`;
      } else {
        messageId = result.data?.id;
      }
    } catch (error) {
      failureReason = `Network/SDK: ${(error as Error).message}`;
    }

    if (failureReason) {
      // Failure branch — single increment, single log line. Failure
      // logs are always emitted (level: error) so they show up in
      // standard log streams immediately, BEFORE the throw — so ops
      // dashboards see the cap-pressure alert even if the controller's
      // 5xx response handling strips it from the user.
      this.mailerFailures++;
      this.logger.error(
        `🚨 Mailer send failed (${failureReason}) [to=${to}] — counters: attempts=${this.mailerAttempts}, successes=${this.mailerSuccesses}, failures=${this.mailerFailures}`,
      );
      throw new Error(`Resend transport error: ${failureReason}`);
    }

    // Success branch — increment then emit the standard "sent" log,
    // then check the milestone. Per-call success logs are at `info`
    // level (default: ✅ visible). If log noise becomes a problem
    // during traffic spikes, drop these to `debug` and keep the
    // milestone line.
    this.mailerSuccesses++;
    this.logger.log(
      `📨 Password reset email sent to ${to} (id: ${messageId ?? 'unknown'})`,
    );

    if (this.mailerSuccesses % this.counterMilestone === 0) {
      this.logger.log(
        `📊 Mailer counter milestone (every ${this.counterMilestone} successful sends) — attempts=${this.mailerAttempts}, successes=${this.mailerSuccesses}, failures=${this.mailerFailures}`,
      );
    }

    return messageId ?? 'unknown';
  }
}
