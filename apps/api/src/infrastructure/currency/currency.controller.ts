import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';

import { CurrencyService } from './currency.service';
import {
  ConvertCurrencyDto,
  ConvertCurrencyResponseDto,
} from './dto/convert.dto';

@ApiTags('currency')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currency: CurrencyService) { }

  @Get('rates')
  @ApiOperation({
    operationId: 'getCurrencyRates',
    summary: 'Return current USD-anchored exchange rates',
    description:
      'Returns the rates bundle (USD, EUR, COP) currently served ' +
      'from Redis. Cache TTL is 1h by default (configurable via ' +
      'CURRENCY_CACHE_TTL_SECONDS).',
  })
  public async getRates() {
    const r = await this.currency.getRates();
    return r;
  }

  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'convertCurrency',
    summary: 'Convert an amount between two of USD|EUR|COP',
  })
  public async convert(
    @Body() body: ConvertCurrencyDto,
  ): Promise<ConvertCurrencyResponseDto> {
    return this.currency.convert(body);
  }
}
