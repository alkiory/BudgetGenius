import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  SetMetadata,
} from '@nestjs/common';
import { AiService } from '@application/ai/ai.service';
import { JwtAiGuard } from '@infrastructure/ai/guard/jwt-ai.guard';
import { PremiumGuard } from '@infrastructure/config/guards/premium.guard';

const premiumAccess = (premiumAccess: boolean) =>
  SetMetadata('premiumAccess', premiumAccess);

@Controller('ai')
@UseGuards(JwtAiGuard, PremiumGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analysis')
  @premiumAccess(true)
  async analyze(@Request() req, @Body() financialData: any) {
    const userId = req.user.id;
    return this.aiService.analyzeFinancialData(userId, financialData);
  }
}
