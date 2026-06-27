import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '@infrastructure/config/redis.service';
import { LoggingService } from '@infrastructure/log/logger.service';

import { SupportedCurrency } from '@domain/user/user-settings.entity';

import {
  ConvertCurrencyDto,
  ConvertCurrencyResponseDto,
} from './dto/convert.dto';

interface CachedRates {
  base: SupportedCurrency;
  rates: Record<SupportedCurrency, number>;
  fetchedAt: string;
}

const DEFAULT_CACHE_TTL_SECONDS = 3600;
const REDIS_KEY = 'bg:exchange_rates:latest';
const ER_API_BASE = 'https://open.er-api.com/v6/latest';

@Injectable()
export class CurrencyService {
  private readonly cacheTtlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly logger: LoggingService,
  ) {
    this.cacheTtlSeconds = Number(
      this.config.get<number>('CURRENCY_CACHE_TTL_SECONDS') ??
      DEFAULT_CACHE_TTL_SECONDS,
    );
  }

  public async convert(
    input: ConvertCurrencyDto,
  ): Promise<ConvertCurrencyResponseDto> {
    // 1. Try cache.
    const cached = await this.readCache();
    if (cached) {
      const result = this.applyRates(cached, input);
      return this.toResponse(input, result, cached.fetchedAt, true);
    }

    // 2. Cache miss → upstream fetch.
    let fresh: CachedRates;
    try {
      fresh = await this.fetchUpstream('USD');
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.error(
        `currency:upstream fetch failed (from=${input.fromCurrency} ` +
        `to=${input.toCurrency} amount=${input.amount}): ${msg}`,
      );
      throw new ServiceUnavailableException(
        'Exchange-rate provider unavailable — frontend should fall back',
      );
    }

    await this.writeCache(fresh);
    const result = this.applyRates(fresh, input);
    this.logger.log(
      `currency:cache-miss fetch served (from=${input.fromCurrency} ` +
      `to=${input.toCurrency} amount=${input.amount} rate=${result.rate})`,
    );
    return this.toResponse(input, result, fresh.fetchedAt, false);
  }

  /** Returns current rates (cached or freshly fetched). */
  public async getRates(): Promise<CachedRates> {
    const cached = await this.readCache();
    if (cached) return cached;
    const fresh = await this.fetchUpstream('USD');
    await this.writeCache(fresh);
    return fresh;
  }

  private toResponse(
    input: ConvertCurrencyDto,
    result: { rate: number; convertedAmount: number },
    fetchedAt: string,
    cacheHit: boolean,
  ): ConvertCurrencyResponseDto {
    return {
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      amount: input.amount,
      rate: result.rate,
      convertedAmount: result.convertedAmount,
      fetchedAt,
      cacheHit,
    };
  }

  private async readCache(): Promise<CachedRates | null> {
    if (!this.redis.isConnected()) return null;
    try {
      const raw = await this.redis.getJson<CachedRates | null>(REDIS_KEY);
      return raw ?? null;
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.warn(`currency:redis read failed: ${msg}`);
      return null;
    }
  }

  private async writeCache(payload: CachedRates): Promise<void> {
    if (!this.redis.isConnected()) return;
    try {
      await this.redis.set(REDIS_KEY, payload, this.cacheTtlSeconds);
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.warn(`currency:redis write failed: ${msg}`);
    }
  }

  private async fetchUpstream(base: SupportedCurrency): Promise<CachedRates> {
    const url = `${ER_API_BASE}/${base}`;
    const res = await fetch(url, {
      // AbortController-style timeout: free-tier endpoints can hang.
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      throw new Error(`upstream HTTP ${res.status} on ${url}`);
    }
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (data.result !== 'success' || !data.rates) {
      throw new Error(`upstream returned non-success: ${JSON.stringify(data)}`);
    }

    const rates: Record<SupportedCurrency, number> = {
      USD: data.rates.USD ?? 1,
      EUR: data.rates.EUR ?? 0.93,
      COP: data.rates.COP ?? 4000,
    };
    return {
      base,
      rates,
      fetchedAt: new Date().toISOString(),
    };
  }

  public applyRates(
    rates: CachedRates,
    input: ConvertCurrencyDto,
  ): { rate: number; convertedAmount: number } {
    const { amount, fromCurrency, toCurrency } = input;
    if (fromCurrency === toCurrency) {
      return { rate: 1, convertedAmount: amount };
    }
    const fromRate = fromCurrency === 'USD' ? 1 : rates.rates[fromCurrency];
    const toRate = toCurrency === 'USD' ? 1 : rates.rates[toCurrency];
    if (fromRate === undefined || toRate === undefined) {
      return { rate: 1, convertedAmount: amount };
    }
    const inUsd = fromCurrency === 'USD' ? amount : amount / fromRate;
    const converted = toCurrency === 'USD' ? inUsd : inUsd * toRate;
    return { rate: toRate / fromRate, convertedAmount: converted };
  }
}
