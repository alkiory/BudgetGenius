import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "@infrastructure/auth/guards/jwt-auth.guard";

import { CurrencyService } from "./currency.service";
import {
  ConvertCurrencyDto,
  ConvertCurrencyResponseDto,
} from "./dto/convert.dto";

/**
 * Wave 3 [T3.3] HTTP surface for currency conversion.
 *
 * Endpoints:
 *   GET  /currency/rates   — returns the current rates bundle (base
 *                            "USD", rates for USD|EUR|COP). Used by
 *                            the frontend's HttpCurrencyClient on
 *                            cold-mount to bypass the bundle fall-
 *                            back if the user is online.
 *   POST /currency/convert — converts a specific amount using the
 *                            server-side cached rates. Used per call
 *                            by the React Query 30s staleTime cache
 *                            (Wave 2 [T2.8]).
 *
 * Auth: both endpoints require the JwtAuthGuard per the architecture
 * decision in the audit's open-question 1. Exposing an unauthenticated
 * third-party proxy route courts DDoS that would burn the free-tier
 * `open.er-api.com` budget in minutes.
 */
@ApiTags("currency")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("currency")
export class CurrencyController {
  constructor(private readonly currency: CurrencyService) {}

  @Get("rates")
  @ApiOperation({
    operationId: "getCurrencyRates",
    summary: "Return current USD-anchored exchange rates",
    description:
      "Returns the rates bundle (USD, EUR, COP) currently served " +
      "from Redis. Cache TTL is 1h by default (configurable via " +
      "CURRENCY_CACHE_TTL_SECONDS).",
  })
  public async getRates() {
    const r = await this.currency.getRates();
    return r;
  }

  @Post("convert")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: "convertCurrency",
    summary: "Convert an amount between two of USD|EUR|COP",
  })
  public async convert(
    @Body() body: ConvertCurrencyDto,
  ): Promise<ConvertCurrencyResponseDto> {
    return this.currency.convert(body);
  }
}
