import { UserService } from '@application/user/user.service';
import { LoggingService } from '@infrastructure/log/logger.service';
import { RedisService } from '@infrastructure/config/redis.service';
import { AppProviderKey } from '@domain/superadmin/app-provider-key.entity';
import { openSecret } from '@infrastructure/crypto/secret-box';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import { Repository } from 'typeorm';

/** Raised when Finny cannot run because of its own configuration. The
 * controller maps it to a 503 with a machine-readable code so the rail can
 * show setup instructions instead of a generic failure message. */
export type FinnyConfigErrorCode =
  | 'FINNY_NOT_CONFIGURED'
  | 'FINNY_INVALID_KEY';

export class FinnyConfigError extends Error {
  constructor(
    readonly code: FinnyConfigErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FinnyConfigError';
  }
}

interface ProviderCandidate {
  /** Backoffice row, or `null` for the environment fallback. */
  id: number | null;
  key: string;
}

@Injectable()
export class AiService {
  private readonly clients = new Map<string, OpenAI>();
  private readonly HISTORY_PREFIX = 'ai_history:';
  private readonly MAX_HISTORY_MESSAGES = 10; // Guardamos 5 vueltas (User + AI)

  constructor(
    private readonly logger: LoggingService,
    private readonly userService: UserService,
    private readonly redis: RedisService,
    @InjectRepository(AppProviderKey)
    private readonly providerKeys: Repository<AppProviderKey>,
  ) {}

  async analyzeFinancialData(
    userId: number,
    userQuery: string,
    contextData?: any,
  ): Promise<string> {
    const candidates = await this.resolveKeys();
    if (candidates.length === 0) {
      throw new FinnyConfigError(
        'FINNY_NOT_CONFIGURED',
        'Finny is not configured. Add a provider key in the backoffice or set AGENT_API_KEY.',
      );
    }

    const user = await this.userService.getById(userId);

    // 1. Recuperar historial de Redis
    const history = await this.getHistory(userId);

    // 2. Construir el System Prompt dinámico
    const systemPrompt = this.buildSystemPrompt(user, contextData);

    // 3. Preparar el array de mensajes (Formato estándar para GPT/Gemini/Claude)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userQuery },
    ];

    let sawAuthError = false;
    let lastError: any = null;

    // 4. Failover: the first active key in the backoffice wins; a rejected,
    // rate-limited or unreachable key is recorded and the next one is tried.
    for (const candidate of candidates) {
      try {
        const aiResponse = await this.callOpenAI(messages, candidate.key);
        await this.saveToHistory(userId, userQuery, aiResponse);
        if (candidate.id !== null) {
          void this.providerKeys
            .update(candidate.id, { lastUsedAt: new Date(), lastError: null })
            .catch(() => undefined);
        }
        return aiResponse;
      } catch (error) {
        lastError = error;
        if (isProviderAuthError(error)) sawAuthError = true;
        this.logger.warn(
          `🚨 Finny provider key ${
            candidate.id === null ? '(env)' : candidate.id
          } failed: ${(error as Error)?.message ?? error}`,
        );
        if (candidate.id !== null) {
          void this.providerKeys
            .update(candidate.id, {
              lastFailedAt: new Date(),
              lastError: String(
                (error as Error)?.message ?? error,
              ).slice(0, 240),
            })
            .catch(() => undefined);
        }
      }
    }

    if (sawAuthError) {
      this.logger.error(
        '🚨 Every configured Finny provider key was rejected. Update them in the backoffice.',
      );
      throw new FinnyConfigError(
        'FINNY_INVALID_KEY',
        'The Finny API key was rejected by the provider.',
      );
    }

    this.logger.error(
      `🚨 AI Service Error: ${(lastError as Error)?.message ?? lastError}`,
    );
    return "I'm having trouble connecting right now. / Estoy teniendo problemas para conectarme ahora mismo.";
  }

  /**
   * Backoffice keys in priority order, then the environment fallback.
   *
   * The table may not exist yet on an API booted before the migration; that
   * must not take Finny down, so a query failure falls back to the env key.
   */
  private async resolveKeys(): Promise<ProviderCandidate[]> {
    const candidates: ProviderCandidate[] = [];
    try {
      const rows = await this.providerKeys.find({
        where: { isActive: true },
        order: { priority: 'ASC', createdAt: 'ASC' },
      });
      for (const row of rows) {
        const key = openSecret(row.encryptedKey);
        if (key) candidates.push({ id: row.id, key });
      }
    } catch (error) {
      this.logger.warn(
        `Could not read backoffice provider keys: ${(error as Error).message}`,
      );
    }

    // Legacy fallback: keeps deployments working until the operator moves the
    // key into the backoffice.
    const envKey = (
      process.env.AGENT_API_KEY ||
      process.env.OPENAI_API_KEY ||
      ''
    ).trim();
    if (envKey && !candidates.some((candidate) => candidate.key === envKey)) {
      candidates.push({ id: null, key: envKey });
    }

    return candidates;
  }

  private buildSystemPrompt(user: any, financialData: any): string {
    return `
    You are "Finny," a smart and empathetic financial assistant. 
    
    **CRITICAL RULES:**
    1. **Bilingual:** Always detect the user's language (English or Spanish) and respond in the same language. 
       - If they ask in Spanish, respond in Spanish.
       - If they ask in English, respond in English.
    2. **Persona:** Professional yet friendly. Use "tú" in Spanish.
    3. **Scope:** Only personal finances within the app.
    4. **Formatting:** Use Markdown (bold, lists, headers) for readability.
    5. **Privacy:** Do not mention specific sensitive ID numbers, just trends and summaries.

    **Context of ${user.name}:**
    - Current Totals: ${JSON.stringify(user.overviews)}
    - Specific Data analyzed: ${JSON.stringify(financialData)}

    **Forbidden:** No specific stock advice. No predictions. Always add a small disclaimer if suggesting the investment module.
    `;
  }

  // --- Lógica de Historial (Redis) ---
  private async getHistory(userId: number): Promise<any[]> {
    const data = await this.redis.get(`${this.HISTORY_PREFIX}${userId}`);
    return data ? JSON.parse(data) : [];
  }

  private async saveToHistory(
    userId: number,
    userQuery: string,
    aiResponse: string,
  ) {
    const history = await this.getHistory(userId);
    history.push({ role: 'user', content: userQuery });
    history.push({ role: 'assistant', content: aiResponse });

    // Mantener solo los últimos N mensajes
    const trimmedHistory = history.slice(-this.MAX_HISTORY_MESSAGES);
    await this.redis.set(
      `${this.HISTORY_PREFIX}${userId}`,
      JSON.stringify(trimmedHistory),
      3600, // Expira en 1 hora de inactividad
    );
  }

  // --- Proveedor (Fácil de swappear) ---
  private async callOpenAI(
    messages: any[],
    apiKey: string,
  ): Promise<string> {
    let client = this.clients.get(apiKey);
    if (!client) {
      client = new OpenAI({ apiKey });
      this.clients.set(apiKey, client);
    }
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.6,
    });
    return response.choices[0].message?.content || '';
  }
}

/** A 401 from the provider means Finny's own key is wrong — a deployment
 * problem, not a transient model failure, so it is surfaced as config. */
function isProviderAuthError(error: any): boolean {
  return (
    error?.status === 401 ||
    error?.code === 'invalid_api_key' ||
    error?.error?.code === 'invalid_api_key'
  );
}
