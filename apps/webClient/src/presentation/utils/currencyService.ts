export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'COP';
type ExchangeRates = Record<Currency, number>;

// Exchange rates defaults (Should be fetched from an API)
const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  USD: 1,
  EUR: 0.93,
  GBP: 0.80,
  JPY: 150.50,
  COP: 4000
};

// Currency Symbols
const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  COP: '$'
};

interface CurrencyConversionOptions {
  amount: number;
  fromCurrency?: Currency;
  toCurrency: Currency;
  exchangeRates?: ExchangeRates;
}

interface FormattedCurrency {
  amount: number;
  symbol: string;
  formatted: string;
  isPositive: boolean;
}

export class CurrencyService {
  private static instance: CurrencyService;
  private exchangeRates: ExchangeRates;

  private constructor(exchangeRates: ExchangeRates = DEFAULT_EXCHANGE_RATES) {
    this.exchangeRates = exchangeRates;
  }

  private getLocaleForCurrency(currency: Currency): string {
    const localeMap: Record<Currency, string> = {
      USD: 'en-US',
      EUR: 'es-ES',
      GBP: 'en-GB',
      JPY: 'ja-JP',
      COP: 'es-CO',
    };
    return localeMap[currency] || 'en-US';
  }

  public static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService();
    }
    return CurrencyService.instance;
  }

  public async updateExchangeRates(): Promise<void> {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await response.json();
      const rates = data.rates;
      this.exchangeRates = {
        ...DEFAULT_EXCHANGE_RATES,
        ...rates
      };
    } catch (error) {
      console.error('Error updating exchange rates:', error);
    }
  }

  public validateAmount(amount: number, currency: Currency): boolean {
    const decimalPlaces = this.getDecimalPrecision(currency);
    // When decimalPlaces is 0 (e.g., COP, JPY), only allow integers
    const pattern = decimalPlaces === 0
      ? /^-?\d+$/
      : new RegExp(`^-?\\d+(\\.\\d{1,${decimalPlaces}})?$`);
    return pattern.test(amount.toString());
  }

  private getDecimalPrecision(currency: Currency): number {
    const precisionMap: Record<Currency, number> = {
      USD: 2,
      EUR: 2,
      GBP: 2,
      JPY: 0,
      COP: 0
    };
    return precisionMap[currency] ?? 2;
  }

  public convertAmount(options: CurrencyConversionOptions): number {
    const { amount, fromCurrency = 'USD', toCurrency } = options;
    const rates = options.exchangeRates || this.exchangeRates;

    // Convert to USD first if not the base currency
    const amountInUSD = fromCurrency === 'USD'
      ? amount
      : amount / rates[fromCurrency];

    // Convert to target currency
    return toCurrency === 'USD'
      ? amountInUSD
      : amountInUSD * rates[toCurrency];
  }

  public normalizeAmount(amount: number, currency: Currency): number {
    return this.convertAmount({ amount, fromCurrency: currency, toCurrency: 'USD' });
  }

  public formatCurrency(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
    showSign: boolean = true
  ): FormattedCurrency {
    const converted = this.convertAmount({
      amount: Math.abs(amount),
      fromCurrency,
      toCurrency
    });

    const symbol = CURRENCY_SYMBOLS[toCurrency] || '$';
    const isPositive = amount >= 0;
    const sign = showSign ? (isPositive ? '+' : '-') : '';

    // Obtener el locale para la moneda de destino
    const locale = this.getLocaleForCurrency(toCurrency);

    const formatted = converted.toLocaleString(locale, {
      style: 'currency',
      currency: toCurrency,
      minimumFractionDigits: this.getDecimalPrecision(toCurrency),
      maximumFractionDigits: this.getDecimalPrecision(toCurrency),
    });

    return {
      amount: converted,
      symbol,
      formatted: `${sign}${formatted}`,
      isPositive
    };
  }

  public getSymbol(currency: Currency): string {
    return CURRENCY_SYMBOLS[currency] || '$';
  }

  public getAvailableCurrencies(): Currency[] {
    return Object.keys(CURRENCY_SYMBOLS) as Currency[];
  }

  public startExchangeRateUpdater(): void {
    setInterval(() => {
      this.updateExchangeRates();
    }, 60 * 60 * 1000); // update every hour
  }
}

// Singleton instance export
export const currencyService = CurrencyService.getInstance();