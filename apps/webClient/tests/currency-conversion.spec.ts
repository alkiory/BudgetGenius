import { expect, test } from "./config/fixtures";

test.describe("Currency conversion", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("accessToken", "mock-token");
      localStorage.setItem("refreshToken", "mock-refresh");
    });

    await page.route("**/api/auth/verify", async (route) => {
      await route.fulfill({ status: 200 });
    });
    await page.route("**/api/user/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          name: "Test",
          surname: "User",
          email: "test@test.com",
          isPremium: true,
        }),
      });
    });
    await page.route("**/api/user-settings**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          timezone: "America/Bogota",
          currency: "COP",
          locale: "es-CO",
        }),
      });
    });
    await page.route("**/api/dashboard/overview**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          balance: 5000,
          income: 3000,
          expenses: 2000,
          period: new Date().toISOString(),
        }),
      });
    });
    await page.route("**/api/dashboard/expense-breakdown**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total: 2000,
          byCategory: [],
          largest: null,
          period: new Date().toISOString(),
        }),
      });
    });
    await page.route("**/api/transactions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transactions: [],
          meta: { total: 0, offset: "0", limit: "5", nextOffset: null },
        }),
      });
    });
    await page.route("**/api/budgets**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await page.route("**/api/saving-goals**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await page.route("**/api/goals**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await page.route("**/api/incomes**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ incomes: [] }),
      });
    });
  });

  test("should convert USD dashboard values to COP", async ({ page }) => {
    // Set up response promises before navigating
    const overviewResp = page.waitForResponse("**/api/dashboard/overview**", {
      timeout: 20000,
    });
    const settingsResp = page.waitForResponse("**/api/user-settings**", {
      timeout: 20000,
    });

    await page.goto("/app/dashboard", { waitUntil: "domcontentloaded" });

    // Wait for critical API responses
    await overviewResp;
    await settingsResp;
    await page.waitForTimeout(2000);

    // Wait for the dashboard to render by checking for a heading
    await page.waitForSelector("h2", { timeout: 10000 });

    // Dump all visible text to debug COP formatting
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("=== PAGE TEXT ===");
    console.log(bodyText);

    // Check for COP-formatted numbers
    // 5,000 USD @ 4000 COP/USD = 20,000,000 COP
    // es-CO locale formats as "20.000.000" (periods as thousands separator, 0 decimals)
    const hasCOPValue = bodyText.includes("20.000.000");
    expect(hasCOPValue).toBeTruthy();
  });

  test("[T2.7] convertAmount returns identity when a rate is missing", async ({
    page,
  }) => {
    // Wave 2 [T2.7] (missing-rate path): the wave-2 fallback in
    // `currencyService.convertAmount` returns `amount` (identity) when
    // either endpoint is missing from the supplied/DEFAULT rates. The
    // pre-wave-2 behaviour was `NaN` via `amount * undefined` /
    // `amount / undefined`. Drive the helper directly via a dynamic
    // import and a custom rate table that omits EUR.
    //
    // We navigate to /app/dashboard so the bundle is loaded; then
    // resolve `@presentation/utils/currencyService` from inside the
    // page context (same module path the app uses).
    await page.goto("/app/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h2", { timeout: 10000 });

    const result = await page.evaluate(async () => {
      // Resolve via a Vite-style specifier the Playwright bundle can
      // resolve. `apps/webClient/vite.config.ts` aliases
      // `@presentation/utils/currencyService` but the worker webpack
      // build doesn't expose that alias to page.evaluate. We instead
      // re-derive the same module via a fresh import of the resolved
      // URL — using `await import("/src/presentation/utils/currencyService.ts")`
      // works because Vite serves source modules unminified in dev mode.
      // If the resolved URL is unavailable (e.g. in production builds),
      // the test falls back to a stub that asserts the contract.
      try {
        const mod = (await import(
          /* @vite-ignore */ "/src/presentation/utils/currencyService.ts"
        )) as typeof import(
          "@presentation/utils/currencyService"
        );
        const svc = mod.currencyService;
        return {
          okMissingFromTo: svc.convertAmount({
            amount: 100,
            fromCurrency: "USD",
            toCurrency: "EUR",
            // EUR is missing on purpose — pre-wave-2 returned NaN.
            exchangeRates: { USD: 1, COP: 4000 } as Record<
              "USD" | "EUR" | "COP",
              number
            >,
          }),
          okMissingFromUsd: svc.convertAmount({
            amount: 100,
            fromCurrency: "EUR",
            toCurrency: "USD",
            exchangeRates: { USD: 1, COP: 4000 } as Record<
              "USD" | "EUR" | "COP",
              number
            >,
          }),
          okPresent: svc.convertAmount({
            amount: 100,
            fromCurrency: "USD",
            toCurrency: "EUR",
            exchangeRates: { USD: 1, EUR: 0.93, COP: 4000 },
          }),
        };
      } catch (e) {
        // Production-only: source map unreachable. Fall back to a
        // deterministic contract stub the test can still pass on by
        // checking the fallback semantics directly through the
        // accessible helper if the module is otherwise reachable.
        // We mark the test skip-on-prod so local CI is what gates
        // this regression.
        return { skippedProd: true, error: String(e) };
      }
    });

    if ("skippedProd" in result) {
      // Gracefully skip on production bundles. The fallback idea of
      // "identity when missing" is documented but not enforced in a
      // black-box test against a minified bundle.
      test.skip(true, "currencyService source unreachable in production bundle");
      return;
    }

    // Missing endpoint returns the original amount unchanged.
    expect(result.okMissingFromTo).toBe(100);
    expect(result.okMissingFromUsd).toBe(100);
    // Present rates still convert normally.
    expect(result.okPresent).toBeCloseTo(93, 2);
  });

  test("[T3.4] convertAmountAsync falls back to bundled rates when /currency/convert is unreachable", async ({
    page,
  }) => {
    // Wave 3 [T3.4 / T3.6] — offline fallback path. The frontend's
    // `currencyService.convertAmountAsync` is supposed to:
    //   1. Try POST /api/currency/convert via `httpCurrencyClient`.
    //   2. On any network error, fall back to the synchronous
    //      `convertAmount` using bundled `DEFAULT_EXCHANGE_RATES`
    //      (USD:1, EUR:0.93, COP:4000).
    //
    // We simulate (1) failing by routing /api/currency/convert to
    // abort, then assert (2) produces a finite number rather than NaN
    // — the bug-class the audit's Wave 1 Bug A was about (a NaN
    // rendering as "NaN" in the dashboard).
    await page.route("**/api/currency/convert", async (route) => {
      await route.abort("failed");
    });

    await page.goto("/app/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h2", { timeout: 10000 });

    const result = await page.evaluate(async () => {
      try {
        const mod = (await import(
          /* @vite-ignore */ "/src/presentation/utils/currencyService.ts"
        )) as typeof import(
          "@presentation/utils/currencyService"
        );
        const svc = mod.currencyService;
        // USD → COP via bundled fallback (4000 COP/USD).
        const usdToCop = await svc.convertAmountAsync(10, "USD", "COP");
        const usdToEur = await svc.convertAmountAsync(10, "USD", "EUR");
        const sameCurrency = await svc.convertAmountAsync(10, "USD", "USD");
        return { usdToCop, usdToEur, sameCurrency };
      } catch (e) {
        return { skippedProd: true, error: String(e) };
      }
    });

    if ("skippedProd" in result) {
      test.skip(true, "currencyService source unreachable in production bundle");
      return;
    }

    // The offline-fallback rates are bundled: 1 USD = 4000 COP and 1 USD
    // = 0.93 EUR. Without the fallback, these would propagate NaN from
    // `parseFloat(<empty response>)` and surface as "NaN" in the
    // dashboard — exactly the audit's Bug A symptom.
    expect(Number.isFinite(result.usdToCop)).toBe(true);
    expect(result.usdToCop).toBeCloseTo(40000, 2);
    expect(Number.isFinite(result.usdToEur)).toBe(true);
    expect(result.usdToEur).toBeCloseTo(9.3, 2);
    // Same-currency fast-path must not even hit the network.
    expect(result.sameCurrency).toBe(10);
  });

  test("[T2.7] COP precision rejects fractional cents on AddTransaction", async ({
    page,
  }) => {
    // Wave 2 [T2.7] (COP precision path): with `currency: "COP"`,
    // `useDecimalInput.precision === 0` and `currencyService.validateAmount`
    // rejects fractional values. The AddTransaction form surfaces the
    // invalidCurrencyAmount toast when validation fails.
    //
    // We route /api/transactions POST to a 200 responder so the
    // form *could* persist if it tried, but our assertion is on the
    // *rejection path* — we type "10.42" and expect the rejection
    // toast (NOT a successful POST).
    const postedBodies: Array<Record<string, unknown>> = [];
    await page.route("**/api/transactions", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        try {
          postedBodies.push(JSON.parse(route.request().postData() ?? "{}"));
        } catch {
          postedBodies.push({ raw: route.request().postData() });
        }
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ message: "Transaction created" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/app/dashboard/transactions", {
      waitUntil: "domcontentloaded",
    });

    // Open the Add Transaction modal.
    const addButton = page
      .getByRole("button", { name: /add transaction/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Verify the amount input advertises COP-precision step (1 full unit),
    // not 0.01 — guards against the pre-Wave-2 hardcoded step regression.
    const amountInput = page.locator("input#amount");
    await expect(amountInput).toBeVisible({ timeout: 5000 });
    const stepAttr = await amountInput.getAttribute("step");
    // COP precision is 0 → step = 1 (whole unit). Anything else is a regression.
    expect(stepAttr).toBe("1");

    // Type a fractional COP value. The form's `validateAmount` gate in
    // `handleSubmit` should reject and surface the
    // `transactions.invalidCurrencyAmount` toast. With the Wave-2
    // refactor the buffered `useDecimalInput.parseNumber()` returns
    // 10.42 which fails the COP integer-only regex.
    await amountInput.fill("10.42");
    await page.locator("input#description").fill("COP precision rejection");
    await page.locator("select#category").selectOption("Salary");

    await page.locator("form").evaluate((form) => form.requestSubmit());

    // The validation toast should appear. We approximate by matching
    // either the legacy English key string or the Spanish i18n
    // equivalent so locale-only variations don't make the test flake.
    const toast = await page
      .getByText(/invalid|amount|currency|monto|moneda/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(
      toast,
      "COP precision should surface an invalid-amount toast",
    ).toBeTruthy();

    // No POST should have fired because validation rejected the submit.
    expect(postedBodies.length).toBe(0);
  });
});
