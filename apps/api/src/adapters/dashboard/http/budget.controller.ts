// apps/api/src/adapters/dashboard/http/budget.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { BudgetService } from '@application/dashboard/services/budget.service';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { Budget } from '@domain/dashboard/budget.entity';
import {
  CreateBudgetCategoryDto,
  CreateBudgetDto,
} from '@application/dashboard/dto/create-budget.dto';
import {
  UpdateBudgetCategoryDto,
  UpdateBudgetDto,
} from '@application/dashboard/dto/update-budget.dto';
import { BudgetCategory } from '@domain/dashboard/budget-category.entity';

@ApiTags('budgets')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BudgetController {
  constructor(private svc: BudgetService) {}

  @Get()
  @ApiOperation({ summary: 'List all budgets for current user' })
  @ApiResponse({ status: 200, type: [Budget] })
  getAll(@Req() req) {
    return this.svc.getBudgets(req.user.userId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Obtener categorías de presupuesto' })
  @ApiQuery({ name: 'budgetId', required: false, type: Number })
  @ApiQuery({ name: 'name', required: false, type: String })
  async getCategories(
    @Req() req,
    @Query('budgetId') budgetId?: number,
    @Query('name') name?: string,
  ) {
    return this.svc.findCategories({ userId: req.user.userId, budgetId, name });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one budget by id' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: Budget })
  get(@Param('id') id: string, @Req() req) {
    return this.svc.getBudget(+id, req.user.userId);
  }

  @Get(':id/category')
  @ApiOperation({ summary: 'Get one budget category by id' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: BudgetCategory })
  getCategory(@Param('id') id: string, @Req() req) {
    return this.svc.getBudgetCategory(+id, req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new budget' })
  @ApiResponse({ status: 201, type: Budget })
  create(@Req() req, @Body() dto: CreateBudgetDto) {
    return this.svc.createBudget(req.user.userId, dto);
  }

  @Post('category')
  @ApiOperation({ summary: 'Create a new budget category' })
  @ApiResponse({ status: 201, type: BudgetCategory })
  createCategory(@Body() dto: CreateBudgetCategoryDto, @Req() req) {
    return this.svc.createBudgetCategory({
      userId: req.user.userId,
      budgetId: dto.budgetId,
      dto,
    });
  }

  @Put()
  @ApiOperation({ summary: 'Update a budget' })
  @ApiResponse({ status: 200, type: Budget })
  update(@Req() req, @Body() dto: UpdateBudgetDto) {
    return this.svc.updateBudget(req.user.userId, dto);
  }

  @Put('category')
  @ApiOperation({ summary: 'Update a budget category' })
  @ApiResponse({ status: 200, type: BudgetCategory })
  updateCategory(@Req() req, @Body() dto: UpdateBudgetCategoryDto) {
    return this.svc.updateBudgetCategory(req.user.userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a budget' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Deleted' })
  remove(@Param('id') id: string, @Req() req) {
    return this.svc.deleteBudget(req.user.userId, +id);
  }

  @Delete('category/:id')
  @ApiOperation({ summary: 'Delete a budget category' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Deleted' })
  removeCategory(@Param('id') id: string, @Req() req) {
    return this.svc.deleteBudgetCategory(req.user.userId, +id);
  }
}
