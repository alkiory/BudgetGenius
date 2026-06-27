import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';

export class ConvertCurrencyDto {
  @ApiProperty({
    description: 'ISO currency code to convert FROM (USD, EUR, COP).',
    enum: ['USD', 'EUR', 'COP'],
    example: 'USD',
  })
  @IsString()
  @IsEnum(['USD', 'EUR', 'COP'], {
    message: 'fromCurrency must be one of USD|EUR|COP',
  })
  fromCurrency!: 'USD' | 'EUR' | 'COP';

  @ApiProperty({
    description: 'ISO currency code to convert TO (USD, EUR, COP).',
    enum: ['USD', 'EUR', 'COP'],
    example: 'COP',
  })
  @IsString()
  @IsEnum(['USD', 'EUR', 'COP'], {
    message: 'toCurrency must be one of USD|EUR|COP',
  })
  toCurrency!: 'USD' | 'EUR' | 'COP';

  @ApiProperty({
    description:
      'Numeric amount in `fromCurrency` units. Locale-formatted strings ' +
      "(e.g. '10,42') are stripped at the input layer before reaching " +
      'this DTO. Must be a finite positive number.',
    example: 10.5,
    minimum: 0.000001,
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.000001)
  amount!: number;
}

export class ConvertCurrencyResponseDto {
  @ApiProperty({ enum: ['USD', 'EUR', 'COP'], example: 'USD' })
  fromCurrency!: 'USD' | 'EUR' | 'COP';

  @ApiProperty({ enum: ['USD', 'EUR', 'COP'], example: 'COP' })
  toCurrency!: 'USD' | 'EUR' | 'COP';

  @ApiProperty({
    description: 'Echo of the input amount (sanity check for the caller).',
    example: 10.5,
  })
  amount!: number;

  @ApiProperty({
    description:
      'The converted amount after applying the cached / fetched rate.',
    example: 42000,
  })
  convertedAmount!: number;

  @ApiProperty({
    description:
      'Raw multiplier from fromCurrency to toCurrency (1 USD = 4200 COP).',
    example: 4000,
  })
  rate!: number;

  @ApiProperty({
    description:
      'ISO8601 timestamp of the upstream fetch that produced this rate.',
    example: '2026-06-27T18:00:00.000Z',
  })
  fetchedAt!: string;

  @ApiProperty({
    description:
      'True when the rate was served from Redis (cacheHit=true) rather ' +
      'than a fresh upstream fetch (cacheHit=false).',
    example: true,
  })
  cacheHit!: boolean;
}
