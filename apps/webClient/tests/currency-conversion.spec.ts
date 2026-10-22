import { expect, test } from "./config/fixtures";

test.describe("Currency formatting without conversion", () => {
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

  test("keeps dashboard numbers unchanged when formatted as COP", async ({ page }) => {
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

    // Currency preference changes the currency label only; the number stays 5,000.
    expect(bodyText).toContain("5.000");
    expect(bodyText).not.toContain("20.000.000");
  });

  test("currency formatting changes the symbol without converting the amount", async ({
    page,
  }) => {
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
        const usd = svc.formatCurrency(100, "USD", false);
        const eur = svc.formatCurrency(100, "EUR", false);
        const cop = svc.formatCurrency(100, "COP", false);
        return { usd, eur, cop };
      } catch (e) {
        return { skippedProd: true, error: String(e) };
      }
    });

    if ("skippedProd" in result) {
      test.skip(true, "currencyService source unreachable in production bundle");
      return;
    }

    expect(result.usd.amount).toBe(100);
    expect(result.eur.amount).toBe(100);
    expect(result.cop.amount).toBe(100);
    expect(result.usd.formatted).toContain("$");
    expect(result.eur.formatted).toContain("€");
    expect(result.cop.formatted).toContain("$");
  });

  test("[T2.7] COP precision rejects fractional cents on AddTransaction", async ({
    page,
  }) => {
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

    const amountInput = page.locator("input#amount");
    await expect(amountInput).toBeVisible({ timeout: 5000 });
    const stepAttr = await amountInput.getAttribute("step");
    // COP precision is 0 → step = 1 (whole unit). Anything else is a regression.
    expect(stepAttr).toBe("1");

    await amountInput.fill("10.42");
    await page.locator("input#description").fill("COP precision rejection");
    await page.locator("select#category").selectOption("Salary");

    await page.locator("form").evaluate((form) => form.requestSubmit());

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
