import { describe, expect, it } from "vitest";
import { currencyService } from "./currencyService";

describe("currency formatting", () => {
  it.each([
    { currency: "USD" as const, amount: 1234.56, formattedAmount: "1,234.56" },
    { currency: "EUR" as const, amount: 1234.56, formattedAmount: "1234,56" },
    { currency: "COP" as const, amount: 1234.56, formattedAmount: "1.234,56" },
  ])("changes only the $currency formatting, never the amount", ({
    currency,
    amount,
    formattedAmount,
  }) => {
    const formatted = currencyService.formatCurrency(
      amount,
      currency,
      false,
    );

    expect(formatted.amount).toBe(amount);
    expect(formatted.formatted).toContain(formattedAmount);
    expect(formatted.formatted).toContain(currency === "EUR" ? "€" : "$");
  });

  it("preserves expense sign while formatting the unchanged magnitude", () => {
    const formatted = currencyService.formatCurrency(-42.75, "COP");

    expect(formatted.amount).toBe(42.75);
    expect(formatted.isPositive).toBe(false);
    expect(formatted.formatted).toContain("-");
    expect(formatted.formatted).toContain("42,75");
  });
});

describe("amount input formatting", () => {
  it.each([
    { raw: 62.787499999999994, expected: "62.79" },
    { raw: 1260.2818351105634, expected: "1260.28" },
    { raw: 100, expected: "100" },
    { raw: 0, expected: "0" },
    { raw: 10.5, expected: "10.5" },
  ])("seeds the editor with $raw as $expected", ({ raw, expected }) => {
    expect(currencyService.formatAmountInput(raw, "EUR")).toBe(expected);
  });

  it("returns an empty buffer for missing or non-finite values", () => {
    expect(currencyService.formatAmountInput(undefined, "EUR")).toBe("");
    expect(currencyService.formatAmountInput(null, "EUR")).toBe("");
    expect(currencyService.formatAmountInput(Number.NaN, "EUR")).toBe("");
  });

  it("rounds to the currency precision", () => {
    expect(currencyService.roundAmount(62.787499999999994, "EUR")).toBe(62.79);
    expect(currencyService.roundAmount(-0.8239, "EUR")).toBe(-0.82);
    expect(currencyService.roundAmount(1234.56, "COP")).toBe(1235);
  });
});
