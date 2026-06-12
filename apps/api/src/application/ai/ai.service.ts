import { UserService } from '@application/user/user.service';
import { LoggingService } from '@infrastructure/log/logger.service';
import { RedisService } from '@infrastructure/config/redis.service';
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI;
  private readonly HISTORY_PREFIX = 'ai_history:';
  private readonly MAX_HISTORY_MESSAGES = 10; // Guardamos 5 vueltas (User + AI)

  constructor(
    private readonly logger: LoggingService,
    private readonly userService: UserService,
    private readonly redis: RedisService,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async analyzeFinancialData(userId: number, userQuery: string, contextData?: any): Promise<string> {
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

  private async saveToHistory(userId: number, userQuery: string, aiResponse: string) {
    const history = await this.getHistory(userId);
    history.push({ role: 'user', content: userQuery });
    history.push({ role: 'assistant', content: aiResponse });

    // Mantener solo los últimos N mensajes
    const trimmedHistory = history.slice(-this.MAX_HISTORY_MESSAGES);
    await this.redis.set(
      `${this.HISTORY_PREFIX}${userId}`,
      JSON.stringify(trimmedHistory),
      3600 // Expira en 1 hora de inactividad
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