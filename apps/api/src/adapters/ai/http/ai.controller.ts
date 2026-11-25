import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Request,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AiService, FinnyConfigError } from '@application/ai/ai.service';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analysis')
  async analyze(@Request() req, @Body() body: any) {
    // JwtStrategy.validate exposes { userId, email, role }.
    const userId = req.user.userId;

    // The Finny rail sends { prompt, context }. Keep accepting a bare
    // string/object body for backwards compatibility with earlier callers.
    const prompt =
      typeof body === 'string'
        ? body
        : typeof body?.prompt === 'string'
        ? body.prompt
        : typeof body?.message === 'string'
        ? body.message
        : '';

    if (!prompt.trim()) {
      throw new BadRequestException('A prompt is required');
    }

    const context =
      body && typeof body === 'object' && !Array.isArray(body)
        ? body.context
        : undefined;

    try {
      return await this.aiService.analyzeFinancialData(
        userId,
        prompt.trim(),
        context,
      );
    } catch (error) {
      if (error instanceof FinnyConfigError) {
        throw new ServiceUnavailableException({
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }
  }
}
