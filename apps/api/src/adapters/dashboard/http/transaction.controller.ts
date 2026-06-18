import { CreateTransactionDto } from '@application/dashboard/dto/create-transaction.dto';
import { UpdateTransactionDto } from '@application/dashboard/dto/update-transaction.dto';
import { TransactionService } from '@application/dashboard/services/transaction.service';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { LoggingService } from '@infrastructure/log/logger.service';
import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Put,
  Delete,
  BadRequestException,
  NotFoundException,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly logger: LoggingService,
  ) {}

  // #region Create Transaction
  @Post()
  @ApiOperation({ summary: 'Creates a new transaction' })
  @ApiParam({
    name: 'category',
    description: 'Category of the transaction',
    required: true,
    type: String,
    example: 'Food',
  })
  @ApiParam({
    name: 'description',
    description: 'Description of the transaction',
    required: true,
    type: String,
    example: 'Food Groceries',
  })
  @ApiParam({
    name: 'amount',
    description: 'Amount of the transaction',
    required: true,
    type: Number,
    example: 50,
  })
  @ApiParam({
    name: 'status',
    description: 'Status of the transaction',
    required: false,
    type: String,
    example: 'Completed',
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction created successfully',
    schema: {
      example: {
        message: 'Transaction created successfully',
        transaction: {
          id: 1,
          description: 'Groceries',
          category: 'Food',
          amount: 50,
          status: 'completed',
          userId: 1,
        },
      },
    },
  })
  @ApiBody({
    description: 'Transaction data',
    type: CreateTransactionDto,
    required: true,
    examples: {
      example: {
        value: {
          date: '2025-04-12T23:50:00.528Z',
          category: 'Food',
          description: 'Groceries',
          amount: 50,
          status: 'completed',
        },
      },
    },
  })
  async createTransaction(
    @Body() dto: Omit<CreateTransactionDto, 'id'>,
    @Req() req,
  ) {
    const userId = req.user.userId;
    if (!userId) {
      throw new NotFoundException(
        'POST /transactions => User ID not found in request',
      );
    }
    const transaction = await this.transactionService.createTransaction(
      userId,
      dto,
    );
    return {
      message: '📊 Transaction created successfully',
      transaction,
    };
  }
  // #endregion Create Transaction

  // #region Get Transactions
  @Get()
  @ApiOperation({ summary: 'Get transactions by user' })
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
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    schema: {
      example: {
        transactions: [
          {
            id: 1,
            description: 'Groceries',
            category: 'Food',
            amount: 50,
            status: 'completed',
            userId: 1,
          },
          {
            id: 2,
            description: 'Rent',
            category: 'Bills',
            amount: 1000,
            status: 'completed',
            userId: 1,
          },
        ],
      },
    },
  })
  async getTransactions(
    @Req() req,
    @Query('offset') offset = 0,
    @Query('limit') limit = 50,
  ) {
    const userId = req.user.userId;
    return this.transactionService.getTransactionsByUser({
      userId,
      offset,
      limit,
    });
  }
  // #endregion Get Transactions

  // #region Update Transaction
  @Put()
  @ApiOperation({ summary: 'Updates a transaction' })
  @ApiParam({
    name: 'id',
    description: 'ID of the transaction',
    required: true,
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'description',
    description: 'Description of the transaction',
    required: true,
    type: String,
    example: 'Groceries',
  })
  @ApiParam({
    name: 'category',
    description: 'Category of the transaction',
    required: true,
    type: String,
    example: 'Food',
  })
  @ApiParam({
    name: 'amount',
    description: 'Amount of the transaction',
    required: true,
    type: Number,
    example: 50,
  })
  @ApiParam({
    name: 'status',
    description: 'Status of the transaction',
    required: false,
    type: String,
    example: 'Completed',
  })
  @ApiBody({
    description: 'Transaction data',
    type: UpdateTransactionDto,
    required: true,
    examples: {
      example: {
        value: {
          id: 1,
          date: '2025-04-12T23:50:00.528Z',
          category: 'Food',
          description: 'Groceries',
          amount: 50,
          status: 'completed',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction updated successfully',
    schema: {
      example: {
        message: 'Transaction updated successfully',
        transaction: {
          id: 1,
          description: 'Groceries',
          category: 'Food',
          amount: 50,
          status: 'completed',
          userId: 1,
        },
      },
    },
  })
  async updateTransaction(@Body() dto: UpdateTransactionDto, @Req() req) {
    const userId = req.user.userId;
    this.transactionService.updateTransaction(userId, dto);
    return {
      message: '📈 Transaction updated successfully',
      transaction: dto,
    };
  }
  // #endregion Update Transaction

  // #region Delete All Transactions
  @Delete('all')
  @ApiOperation({ summary: 'Deletes all transactions' })
  @ApiResponse({
    status: 200,
    description: 'All transactions deleted successfully',
    schema: {
      example: {
        message: 'All transactions deleted successfully',
      },
    },
  })
  async deleteAllTransactions(@Req() req, @Body() transactionId: number[]) {
    const userId = req.user.userId;
    try {
      await this.transactionService.deleteAllTransactions(
        userId,
        transactionId,
      );
      return {
        message: '🗑️ All transactions deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting all transactions', error);
      throw new Error('Error deleting all transactions');
    }
  }

  // #endregion Delete Transactions

  // #region Delete Transaction
  @Delete(':id')
  @ApiOperation({ summary: 'Deletes a transaction' })
  @ApiParam({
    name: 'id',
    description: 'ID of the transaction',
    required: true,
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction deleted successfully',
    schema: {
      example: {
        message: 'Transaction deleted successfully',
        transaction: {
          id: 1,
          description: 'Groceries',
          category: 'Food',
          amount: 50,
          status: 'completed',
          userId: 1,
        },
      },
    },
  })
  async deleteTransaction(@Req() req) {
    const userId = req.user.userId;
    const transactionId = parseInt(req.params.id, 10);

    if (isNaN(transactionId)) {
      throw new BadRequestException('Transaction ID must be a number');
    }

    const wasDeleted = await this.transactionService.deleteTransaction(
      transactionId,
      userId,
    );

    if (!wasDeleted) {
      throw new NotFoundException(
        'Transaction not found or does not belong to the user',
      );
    }

    this.logger.log(
      `Transaction with ID ${transactionId} deleted successfully`,
    );
    return {
      message: '📉 Transaction deleted successfully',
    };
  }
  // #endregion Delete Transaction
}
