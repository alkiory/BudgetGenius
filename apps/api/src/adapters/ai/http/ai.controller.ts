import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AiService } from '@application/ai/ai.service';
import { JwtAiGuard } from '@infrastructure/ai/guard/jwt-ai.guard';

@Controller('ai')
@UseGuards(JwtAiGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analysis')
  async analyze(@Request() req, @Body() financialData: any) {
    // `req.user.id` was undefined because JwtStrategy.validate exposes the
    // payload as { userId, email, role } (see jwt.strategy.ts). Reading
    // `req.user.userId` actually populates the AI service with a valid
    // foreign key into the users table — previously the AI service was
    // fetching some unrelated user (or none) via `userService.getById(undefined)`.
    const userId = req.user.userId;
    return this.aiService.analyzeFinancialData(userId, financialData);
  }
}
