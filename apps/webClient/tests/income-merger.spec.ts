import { test, expect } from "./config/fixtures";

// Phase 5 (T5.7): end-to-end Playwright spec proving the Income →
// Transaction strangler facade works. The /app/dashboard/income page
// must render via the unified /transactions endpoint with type=income
// and the new recurrence column must roundtrip through the form.

const SEEDED_INCOMES = [
  {
    id: 1,
    date: "2026-01-01T00:00:00.000Z",
    description: "Monthly paycheck",
    category: "Salary",
    amount: 1500,
    currency: "USD",
    recurrence: "Monthly",
    userId: 1,
  },
  {
    id: 2,
    date: "2026-01-15T00:00:00.000Z",
    description: "Freelance gig",
    category: "Freelance",
    amount: 800,
    currency: "USD",
    recurrence: "One-time",
    userId: 1,
  },
];

test.describe("Income ↔ Transaction Strangler Facade", () => {
  test.beforeEach(async ({ page }) => {
    // Auth bootstrap (Phase 5 T5.7: pin i18nextLng so toggle locators
    // and label matches are stable across both en + es locales).
    // addInitScript runs BEFORE any page script so i18next's module-level
    // detector cannot outrace our setter when routing from `/` into
    // /app/dashboard/*.
    await page.addInitScript(() => {
      localStorage.setItem("i18nextLng", "en");
    });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("accessToken", "mock-token");
      localStorage.setItem("refreshToken", "mock-refresh");
    });

    await page.route("**/api/auth/verify", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json" });
    });

    await page.route("**/api/user/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@test.com",
          isPremium: true,
        }),
      });
    });

    // The income page now reads from /transactions?type=income. The
    // mock below seeds the legacy-merged data so the page renders rows.
    await page.route("**/api/transactions**", async (route) => {
      const url = new URL(route.request().url());
      const type = url.searchParams.get("type");
      const filtered =
        type === "income"
          ? SEEDED_INCOMES
          : type === "expense"
          ? []
          : SEEDED_INCOMES;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transactions: filtered,
          meta: {
            total: filtered.length,
            offset: "0",
            limit: "50",
            nextOffset: null,
          },
        }),
      });
    });

    await page.route("**/api/budgets", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/dashboard**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/api/expense-categories**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("income page renders rows from /transactions?type=income and never shows literal 'NaN'", async ({
    page,
  }) => {
    await page.goto("/app/dashboard/income", {
      waitUntil: "domcontentloaded",
    });
    // Wait for the table to render
    await page.waitForTimeout(2000);

    // Confirm at least one seeded row is present.
    await expect(page.getByText("Monthly paycheck")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Freelance gig")).toBeVisible({
      timeout: 10000,
    });

    // Phase 5 acceptance: the literal string "NaN" must NEVER appear
    // anywhere on the income page. Even one occurrence is a regression
    // of the bug the Phase 3 NaN-ternary kill fixed.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bNaN\b/);
  });

  test("submitting an income row from the income page puts it in /transactions?type=income", async ({
    page,
  }) => {
    let postedBody: unknown = null;

    await page.route("**/api/transactions", async (route) => {
      if (route.request().method() === "POST") {
        try {
          postedBody = JSON.parse(route.request().postData() ?? "{}");
        } catch {
          postedBody = route.request().postData();
        }
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Transaction created successfully",
            transaction: postedBody,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            transactions: SEEDED_INCOMES,
            meta: {
              total: SEEDED_INCOMES.length,
              offset: "0",
              limit: "50",
              nextOffset: null,
            },
          }),
        });
      }
    });

    await page.goto("/app/dashboard/income", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);

    // Click the Add Transaction CTA on the income page.
    const addButton = page
      .getByRole("button", { name: /add transaction/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // Toggle income, fill, select Monthly recurrence, submit.
    // Locale-agnostic via data-testid (en "Income" / es "Ingreso" both
    // resolve to the same data-testid="type-income").
    const incomeToggle = page.getByTestId("type-income");
    await incomeToggle.click();

    await page.locator("input#description").fill("New recurring paycheck");
    await page.locator("input#amount").fill("2000");
    await page.locator("select#category").selectOption("Salary");
    await page.locator("select#recurrence").selectOption("Monthly");

    await page.locator("form").evaluate((form) => form.requestSubmit());

    await page.waitForTimeout(500);

    expect(postedBody).toMatchObject({
      amount: 2000,
      category: "Salary",
      recurrence: "Monthly",
    });
  });
});
