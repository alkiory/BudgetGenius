import {
  BadRequestException,
  Body,
  Controller,
  Get,
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

  /** Cheap readiness check: no provider call, so the rail can show Finny
   * asleep (and explain why) before the user types anything. */
  @Get('status')
  status() {
    return this.aiService.getStatus();
  }

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
