import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AiService } from '@application/ai/ai.service';
import { JwtAiGuard } from '@infrastructure/ai/guard/jwt-ai.guard';

@Controller('ai')
@UseGuards(JwtAiGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analysis')
  async analyze(@Request() req, @Body() financialData: any) {
    const userId = req.user.id;
    return this.aiService.analyzeFinancialData(userId, financialData);
  }
}
