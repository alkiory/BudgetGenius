import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Put,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { CreateIncomeDto } from '@application/dashboard/dto/create-income.dto';
import { IncomeService } from '@application/dashboard/services/income.service';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

@Controller('incomes')
@UseGuards(JwtAuthGuard)
export class IncomeController {
  constructor(private readonly svc: IncomeService) {}

  @Get()
  @ApiOperation({ summary: 'Get all incomes' })
  @ApiQuery({
    name: 'offset',
    description: 'Offset of the transactions',
    type: Number,
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Limit of the transactions',
    type: Number,
    example: 10,
  })
  getAll(@Req() req, @Query('offset') offset = 0, @Query('limit') limit = 50) {
    return this.svc.getAllByUser({ userId: req.user.userId, offset, limit });
  }

  @Post()
  @ApiOperation({ summary: 'Create an income' })
  @ApiBody({ type: CreateIncomeDto })
  @ApiParam({ name: 'description', type: 'string' })
  @ApiParam({ name: 'amount', type: 'number' })
  @ApiParam({ name: 'category', type: 'string' })
  @ApiParam({ name: 'recurrence', type: 'string' })
  @ApiParam({ name: 'date', type: 'date' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(@Req() req, @Body() dto: CreateIncomeDto) {
    return this.svc.createIncome(req.user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an income' })
  @ApiBody({ type: CreateIncomeDto })
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: Partial<CreateIncomeDto>,
  ) {
    return this.svc.updateIncome(+id, req.user.userId, dto);
  }

  @Delete('all')
  @ApiOperation({ summary: 'Delete all incomes' })
  async deleteAllIncomes(@Req() req) {
    await this.svc.deleteAllIncomes(req.user.userId);
    return {
      message: '🗑️ All Incomes deleted successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an income' })
  deleteIncome(@Req() req, @Param('id') id: string) {
    this.svc.deleteIncome(+id, req.user.userId);
    return {
      message: '🗑️ Income deleted successfully',
    };
  }
}
