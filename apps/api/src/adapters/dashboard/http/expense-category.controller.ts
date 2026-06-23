/**
 * HTTP controller for ExpenseCategory management.
 *
 * The controller was missing entirely — until now, the routes the
 * service exposes were unreachable from HTTP. This file wires them up
 * with the same conventions as the other dashboard controllers
 * (`budget.controller.ts`): JWT guard, Swagger decorations,
 * path-parameter `:id` for resource identity, and `req.user.userId`
 * forwarded to the service so the repo can scope every WHERE clause.
 *
 * Security note: the `EntityNotFoundExceptionFilter` translates TypeORM's
 * `EntityNotFoundError` (which the repo's `findOneOrFail` raises on a
 * foreign id) into a clean 404. Without it, Nest's default filter
 * would return 500 — wrong on two counts: (a) it leaks TypeORM as the
 * ORM, and (b) the foreign-id attempt is a normal "not found", not a
 * server fault. The filter is scoped to this controller so it doesn't
 * change elsewhere.
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { ExpenseCategoryService } from '@application/dashboard/services/expense-category.service';
import { ExpenseCategory } from '@domain/dashboard/expense-category.entity';
import { CreateExpenseDto } from '@application/dashboard/dto/create-expense.dto';
import { UpdateExpenseCategoryDto } from '@application/dashboard/dto/update-expense-category.dto';
import { EntityNotFoundExceptionFilter } from './filters/entity-not-found.filter';

@ApiTags('expense-categories')
@Controller('expense-categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UseFilters(EntityNotFoundExceptionFilter)
export class ExpenseCategoryController {
  constructor(private readonly svc: ExpenseCategoryService) {}

  @Get()
  @ApiOperation({ summary: 'List expense categories for the current user' })
  @ApiResponse({ status: 200, type: [ExpenseCategory] })
  list(@Req() req) {
    return this.svc.getExpenseCategoriesByUser(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one expense category by id' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: ExpenseCategory })
  @ApiResponse({
    status: 404,
    description: 'Category not found or not owned by caller',
  })
  getById(@Param('id') id: string, @Req() req) {
    return this.svc.getExpenseCategoryById(req.user.userId, +id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new expense category' })
  @ApiResponse({ status: 201, type: ExpenseCategory })
  create(@Body() dto: CreateExpenseDto, @Req() req) {
    return this.svc.createExpenseCategory(req.user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an expense category' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: ExpenseCategory })
  @ApiResponse({
    status: 404,
    description: 'Category not found or not owned by caller',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
    @Req() req,
  ) {
    // Service signature is `Omit<UpdateExpenseDTO, 'createdAt'>`, which
    // requires `{id, name, value, transactions: Transaction[]}`. The
    // HTTP DTO only carries `{name, value}`, so we synthesize `id` from
    // the path and pass `transactions: []` as the placeholder the
    // service already discards. This keeps the HTTP shape clean while
    // not forcing a service-signature refactor outside the scope of
    // "wire the controller".
    return this.svc.updateExpenseCategory(req.user.userId, {
      id: +id,
      name: dto.name,
      value: dto.value,
      transactions: [],
    } as any);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an expense category' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Deleted' })
  remove(@Param('id') id: string, @Req() req) {
    return this.svc.deleteExpenseCategory(req.user.userId, +id);
  }
}
