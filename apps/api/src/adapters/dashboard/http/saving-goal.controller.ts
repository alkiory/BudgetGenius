import { SavingGoalService } from '@application/dashboard/services/saving-goal.service';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SavingGoal } from '@domain/dashboard/saving-goal.entity';
import { LoggingService } from '@infrastructure/log/logger.service';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import {
  CreateSavingGoalDto,
  SavingGoalResponseDto,
} from '@application/dashboard/dto/create-saving-goal.dto';
import { UpdateSavingGoalDto } from '@application/dashboard/dto/update-saving-goal.dto';

@Controller('saving-goal')
@UseGuards(JwtAuthGuard)
export class SavingGoalController {
  constructor(
    private readonly savingGoalService: SavingGoalService,
    private readonly logger: LoggingService,
  ) {}

  // #region create SG
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiOperation({ summary: 'Creates a new saving goal' })
  @ApiParam({
    name: 'name',
    description: 'Name of the saving goal',
    required: true,
    type: String,
    example: 'Vacation',
  })
  @ApiParam({
    name: 'current',
    description: 'Current amount saved',
    required: true,
    type: Number,
    example: 1000,
  })
  @ApiParam({
    name: 'target',
    description: 'Target amount to save',
    required: true,
    type: Number,
    example: 5000,
  })
  @ApiResponse({
    status: 201,
    description: 'Saving goal created successfully',
    type: SavingGoal,
    examples: {
      SavingGoal: {
        summary: 'Saving goal example',
        value: {
          id: 1,
          name: 'Vacation',
          current: 1000,
          target: 5000,
        },
      },
    },
  })
  @ApiBody({
    description: 'Saving goal data',
    type: SavingGoal,
    examples: {
      SavingGoal: {
        summary: 'Saving goal example',
        value: {
          name: 'Vacation',
          current: 1000,
          target: 5000,
        },
      },
    },
  })
  async createSavingGoal(@Body() dto: CreateSavingGoalDto, @Req() req) {
    const savingGoal = await this.savingGoalService.createSavingGoal(
      dto,
      req.user.userId,
    );
    return savingGoal;
  }
  // #endregion create SG

  // #region get SG
  @Get()
  @ApiOperation({ summary: 'Get all saving goals' })
  async getAllSavingGoals(@Req() req): Promise<SavingGoal[]> {
    const savingGoals = await this.savingGoalService.findAll(req.user.userId);
    if (savingGoals.length === 0) {
      this.logger.warn('No saving goals found');
      return [];
    }
    return savingGoals;
  }

  // #endregion get SG

  // #region update SG
  @Put()
  @ApiOperation({ summary: 'Update a saving goal' })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiParam({
    name: 'id',
    description: 'ID of the saving goal',
    required: true,
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'name',
    description: 'Name of the saving goal',
    required: true,
    type: String,
    example: 'Vacation',
  })
  @ApiParam({
    name: 'current',
    description: 'Current amount saved',
    required: true,
    type: Number,
    example: 1000,
  })
  @ApiParam({
    name: 'target',
    description: 'Target amount to save',
    required: true,
    type: Number,
    example: 5000,
  })
  @ApiBody({
    description: 'Saving goal data',
    type: SavingGoal,
    examples: {
      SavingGoal: {
        summary: 'Saving goal example',
        value: {
          name: 'Vacation',
          current: 1000,
          target: 5000,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Saving goal updated successfully',
    type: SavingGoal,
    examples: {
      SavingGoal: {
        summary: 'Saving goal example',
        value: {
          id: 1,
          name: 'Vacation',
          current: 1000,
          target: 5000,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Saving goal not found',
    type: BadRequestException,
    examples: {
      BadRequestException: {
        summary: 'Saving goal not found',
        value: {
          statusCode: 400,
          message: 'Saving goal not found',
        },
      },
      ValidationException: {
        summary: 'Validation error',
        value: {
          statusCode: 400,
          message: `"id must be a number conforming to the specified constraints",
          "name should not be empty",
          "name must be a string",
          "current must not be less than 0",
          "current must be a number conforming to the specified constraints",
          "target must not be less than 0",
          "target must be a number conforming to the specified constraints",`,
        },
      },
    },
  })
  async updateSavingGoal(
    @Body() dto: Omit<UpdateSavingGoalDto, 'percentage'>,
    @Req() req,
  ) {
    const { userId } = req.user;
    const savingGoal = await this.savingGoalService.updateSavingGoal(
      dto,
      userId,
    );
    return savingGoal;
  }

  // #endregion update SG

  // #region delete all SG
  @Delete('all')
  @ApiOperation({ summary: 'Delete all saving goals' })
  async deleteAllSavingGoals(@Req() req) {
    await this.savingGoalService.deleteAllSavingGoals(req.user.userId);
  }

  // #endregion delete all SG

  // #region delete a SG
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saving goal' })
  @ApiParam({
    name: 'id',
    description: 'ID of the saving goal',
    required: true,
    type: Number,
    example: 1,
  })
  async deleteSavingGoal(@Param() param, @Req() req): Promise<void> {
    await this.savingGoalService.deleteSavingGoal(param.id, req.user.userId);
  }

  // #endregion delete a SG

  // #region get SG by ID
  @Get(':id')
  @ApiOperation({ summary: 'Get a saving goal by ID' })
  @ApiParam({
    name: 'id',
    description: 'ID of the saving goal',
    required: true,
    type: Number,
    example: 1,
  })
  async getSavingGoalById(@Param() param, @Req() req): Promise<SavingGoal> {
    const userId = req.user.userId;
    const getIdParam = parseInt(param.id);
    const savingGoal = await this.savingGoalService.findById(
      getIdParam,
      userId,
    );
    return savingGoal;
  }

  // #endregion get SG by ID

  // #region get SG by name
  @Post(':name')
  @ApiOperation({ summary: 'Get a saving goal by name' })
  @ApiBody({
    description: 'Not used',
  })
  @ApiResponse({
    status: 200,
    description: 'Saving goal found successfully',
    type: SavingGoal,
    examples: {
      SavingGoal: {
        summary: 'Saving goal example',
        value: {
          id: 1,
          name: 'Vacation',
          current: 1000,
          target: 5000,
          percentage: 50,
        },
      },
    },
  })
  async getSavingGoalByName(
    @Param('name') name: string,
    @Req() req,
  ): Promise<SavingGoalResponseDto | null> {
    const savingGoals = await this.savingGoalService.findByName(
      name,
      req.user.userId,
    );
    return savingGoals;
  }
  // #endregion get SG by name
}
