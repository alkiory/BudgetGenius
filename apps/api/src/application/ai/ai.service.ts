import { UserService } from '@application/user/user.service';
import { LoggingService } from '@infrastructure/log/logger.service';
import { RedisService } from '@infrastructure/config/redis.service';
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

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

@Injectable()
export class AiService {
  private openai: OpenAI;
  private readonly apiKey: string;
  private readonly HISTORY_PREFIX = 'ai_history:';
  private readonly MAX_HISTORY_MESSAGES = 10; // Guardamos 5 vueltas (User + AI)

  constructor(
    private readonly logger: LoggingService,
    private readonly userService: UserService,
    private readonly redis: RedisService,
  ) {
    // Finny's dedicated token lives only in the API process. Fall back to
    // the legacy OpenAI key so existing deployments keep working while
    // AGENT_API_KEY is rolled out through compose/env_file.
    this.apiKey = (
      process.env.AGENT_API_KEY ||
      process.env.OPENAI_API_KEY ||
      ''
    ).trim();
    // A placeholder keeps the SDK constructor from throwing at boot; the
    // real check happens per request so the app can still start unconfigured.
    this.openai = new OpenAI({ apiKey: this.apiKey || 'not-configured' });
  }

  async analyzeFinancialData(
    userId: number,
    userQuery: string,
    contextData?: any,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new FinnyConfigError(
        'FINNY_NOT_CONFIGURED',
        'Finny is not configured. Set AGENT_API_KEY in the API environment.',
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

    try {
      // 4. Llamada al proveedor (Opcional usar un Factory para Gemini/Claude)
      const aiResponse = await this.callOpenAI(messages);

      // 5. Guardar la nueva interacción en el historial
      await this.saveToHistory(userId, userQuery, aiResponse);

      return aiResponse;
    } catch (error) {
      if (isProviderAuthError(error)) {
        this.logger.error(
          '🚨 Finny rejected the configured API key. Update AGENT_API_KEY.',
        );
        throw new FinnyConfigError(
          'FINNY_INVALID_KEY',
          'The Finny API key was rejected by the provider.',
        );
      }
      this.logger.error(`🚨 AI Service Error: ${error.message}`);
      return "I'm having trouble connecting right now. / Estoy teniendo problemas para conectarme ahora mismo.";
    }
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
  private async callOpenAI(messages: any[]): Promise<string> {
    const response = await this.openai.chat.completions.create({
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
