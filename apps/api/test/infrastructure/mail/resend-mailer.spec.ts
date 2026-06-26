/**
 * Sent-counter tests for ResendMailerService.
 *
 * Targets the post-fix contract: per-call `mailerAttempts` increment,
 * plus separate `mailerSuccesses` / `mailerFailures` increments, with
 * milestone log emission every Nth successful send and immediate error
 * log on every failure.
 *
 * The Resend SDK is mock-replaced so we control whether
 * `client.emails.send(...)` resolves with `{data}` (success) or
 * `{error}` (Resend API failure) or throws (network / SDK exception).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '@infrastructure/log/logger.service';
import { ResendMailerService } from '@infrastructure/mail/resend-mailer.service';
import { Resend } from 'resend';

// jest.mock is hoisted: replaces the Resend constructor with a stub so
// `new Resend(apiKey)` returns whatever we wire in beforeEach. The real
// HTTP transport is never invoked.
jest.mock('resend');

describe('ResendMailerService — sent-counter contract', () => {
  let service: ResendMailerService;
  let logger: jest.Mocked<LoggingService>;
  let sendMock: jest.Mock;

  beforeEach(async () => {
    sendMock = jest.fn();
    (Resend as jest.MockedClass<typeof Resend>).mockImplementation(
      () =>
        ({
          emails: { send: sendMock },
        }) as any,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResendMailerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) => {
              if (k === 'RESEND_API_KEY') return 'test-key';
              if (k === 'MAILER_COUNTER_MILESTONE') return 25;
              return undefined;
            }),
          },
        },
        {
          provide: LoggingService,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ResendMailerService);
    logger = module.get(LoggingService);
  });

  it('throws at construction if RESEND_API_KEY is missing', () => {
    expect(
      () =>
        new ResendMailerService(
          { get: () => undefined } as any,
          { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
        ),
    ).toThrow(/RESEND_API_KEY/);
  });

  it('increments attempts AND successes on a clean send and logs the sent line', async () => {
    sendMock.mockResolvedValueOnce({
      data: { id: 'msg-1' },
      error: null,
    });

    const id = await service.sendPasswordReset(
      'test@example.com',
      'https://example.com/x',
    );

    expect(id).toBe('msg-1');
    expect((service as any).mailerAttempts).toBe(1);
    expect((service as any).mailerSuccesses).toBe(1);
    expect((service as any).mailerFailures).toBe(0);

    // The "📨 sent" log line MUST be emitted (level: info).
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        '📨 Password reset email sent to test@example.com',
      ),
    );
    // Failures log is silent on success.
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('increments attempts AND failures on a Resend API error (no double-count)', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'daily cap exceeded' },
    });

    await expect(
      service.sendPasswordReset('test@example.com', 'https://example.com/x'),
    ).rejects.toThrow(/daily cap exceeded/);

    expect((service as any).mailerAttempts).toBe(1);
    expect((service as any).mailerSuccesses).toBe(0);
    expect((service as any).mailerFailures).toBe(1);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('🚨 Mailer send failed'),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('attempts=1, successes=0, failures=1'),
    );
  });

  it('increments attempts AND failures on a thrown network/SDK error', async () => {
    sendMock.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(
      service.sendPasswordReset('test@example.com', 'https://example.com/x'),
    ).rejects.toThrow(/socket hang up/);

    expect((service as any).mailerAttempts).toBe(1);
    expect((service as any).mailerSuccesses).toBe(0);
    expect((service as any).mailerFailures).toBe(1);
  });

  it('exactly one failure bin increments per call (attempts = successes + failures)', async () => {
    // 3 successes + 2 failures = attempts 5
    sendMock.mockResolvedValueOnce({ data: { id: '1' }, error: null });
    sendMock.mockResolvedValueOnce({ data: { id: '2' }, error: null });
    sendMock.mockResolvedValueOnce({ data: { id: '3' }, error: null });
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'quota' },
    });
    sendMock.mockRejectedValueOnce(new Error('net'));

    for (let i = 0; i < 5; i++) {
      try {
        await service.sendPasswordReset('a@b.com', 'https://x');
      } catch {
        // expected for the last two
      }
    }

    expect((service as any).mailerAttempts).toBe(5);
    expect((service as any).mailerSuccesses).toBe(3);
    expect((service as any).mailerFailures).toBe(2);
  });

  it('emits a milestone log line every MAILER_COUNTER_MILESTONE successful sends, with running totals', async () => {
    const MILESTONE = (service as any).counterMilestone;
    // Send exactly MILESTONE successful emails. The milestone fires
    // ON the Nth send (success % MILESTONE === 0 → true for 25, 50, …).
    sendMock.mockImplementation(() =>
      Promise.resolve({ data: { id: 'msg' }, error: null }),
    );

    for (let i = 0; i < MILESTONE; i++) {
      await service.sendPasswordReset('a@b.com', 'https://x');
    }

    // Filter for the milestone line specifically (the per-send "📨" line
    // also calls logger.log, but lacks the milestone substring).
    const milestoneLines = logger.log.mock.calls
      .map((args) => args[0])
      .filter((msg) => /^📊 Mailer counter milestone/.test(String(msg)));

    expect(milestoneLines).toHaveLength(1);
    expect(milestoneLines[0]).toMatch(/successes=25/);
    expect(milestoneLines[0]).toMatch(/attempts=25/);
    expect(milestoneLines[0]).toMatch(/failures=0/);
  });

  it('does NOT emit a milestone line mid-batch at non-milestone counts', async () => {
    sendMock.mockImplementation(() =>
      Promise.resolve({ data: { id: 'msg' }, error: null }),
    );

    // MILESTONE - 1 successes: should NOT trigger a milestone log.
    const MILESTONE = (service as any).counterMilestone;
    for (let i = 0; i < MILESTONE - 1; i++) {
      await service.sendPasswordReset('a@b.com', 'https://x');
    }

    const milestoneLines = logger.log.mock.calls
      .map((args) => args[0])
      .filter((msg) => /^📊 Mailer counter milestone/.test(String(msg)));

    expect(milestoneLines).toHaveLength(0);
  });

  it('honors MAILER_COUNTER_MILESTONE override (smaller threshold emits milestone earlier)', async () => {
    // Replace the service with one configured at threshold 3, plus a
    // fresh inline logging stub for the scoped module.
    sendMock.mockReset();
    sendMock.mockImplementation(() =>
      Promise.resolve({ data: { id: 'msg' }, error: null }),
    );
    (Resend as jest.MockedClass<typeof Resend>).mockImplementation(
      () => ({ emails: { send: sendMock } }) as any,
    );
    const scopedLoggerStub = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const scopedModule: TestingModule = await Test.createTestingModule({
      providers: [
        ResendMailerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) => {
              if (k === 'RESEND_API_KEY') return 'test-key';
              if (k === 'MAILER_COUNTER_MILESTONE') return 3;
              return undefined;
            }),
          },
        },
        {
          provide: LoggingService,
          useValue: scopedLoggerStub,
        },
      ],
    }).compile();
    const scopedService = scopedModule.get(ResendMailerService);
    // Cast to jest.Mocked<LoggingService> so `log.mock.calls` is typed
    // correctly — mirrors the outer `logger: jest.Mocked<LoggingService>`
    // pattern used in the beforeEach block, where the assignment
    // happens at the const declaration site.
    const scopedLogger = scopedModule.get(
      LoggingService,
    ) as unknown as jest.Mocked<LoggingService>;

    for (let i = 0; i < 3; i++) {
      await scopedService.sendPasswordReset('a@b.com', 'https://x');
    }

    const milestoneLines = scopedLogger.log.mock.calls
      .map((args) => args[0])
      .filter((msg) => /^📊 Mailer counter milestone/.test(String(msg)));
    expect(milestoneLines).toHaveLength(1);
    expect(milestoneLines[0]).toMatch(/successes=3/);
    expect(milestoneLines[0]).toMatch(/every 3 successful sends/);
    // Sanity: the override actually flowed through into the instance.
    expect((scopedService as any).counterMilestone).toBe(3);
  });
});
