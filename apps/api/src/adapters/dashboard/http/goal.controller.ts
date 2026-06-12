import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Put,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import {
  CreateGoalDto,
  UpdateGoalDto,
  UpdateGoalProgressDto,
} from '@application/dashboard/dto/create-goal.dto';
import { GoalService } from '@application/dashboard/services/goal.service';
import { ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { PremiumGuard } from '@infrastructure/config/guards/premium.guard';

@Controller('goals')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class GoalController {
  constructor(private readonly svc: GoalService) {}

  @Post()
  async create(@Req() req, @Body() dto: CreateGoalDto) {
    const goal = await this.svc.createGoal(req.user.userId, dto);
    return goal;
  }

  @Get()
  async list(@Req() req) {
    return this.svc.list(req.user.userId);
  }

  @Get(':id')
  async get(@Req() req, @Param('id') id: string) {
    return this.svc.getGoal(req.user.userId, +id);
  }

  @Put(':id')
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.svc.updateGoal(req.user.userId, +id, dto);
  }

  @Patch(':id/progress')
  @ApiOperation({ summary: 'Increment a goal’s progress by amount' })
  @ApiParam({ name: 'id', type: Number, description: 'Goal ID' })
  @ApiBody({ type: UpdateGoalProgressDto })
  @ApiResponse({ status: 200, description: 'Updated goal returned' })
  async updateProgress(
    @Param('id') id: string,
    @Body() dto: UpdateGoalProgressDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.svc.updateGoalProgress(userId, Number(id), dto.amount);
  }

  @Delete(':id')
  async remove(@Req() req, @Param('id') id: string) {
    await this.svc.removeGoal(req.user.userId, +id);
    return { message: 'Goal removed' };
  }
}
