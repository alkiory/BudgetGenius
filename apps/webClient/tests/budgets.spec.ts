import { test, expect } from "./config/fixtures";
import type { Route } from "@playwright/test";

/**
 * Budgets v2 regression coverage:
 * - a savings budget relabels the manual action and saves a manual deposit
 *   (not a negative expense),
 * - the create form no longer asks for a spent amount and submits the
 *   selected spending/savings type.
 */
test.describe("Budgets spending vs savings", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("i18nextLng", "en");
    });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("accessToken", "mock-token");
      localStorage.setItem("refreshToken", "mock-refresh");
    });

    const json = (body: unknown) => async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    };

    await page.route("**/api/**", json({}));
    await page.route("**/api/auth/verify", json({}));
    await page.route(
      "**/api/user/profile",
      json({ id: 1, name: "Test User", email: "test@test.com" }),
    );
    await page.route(
      "**/api/user-settings**",
      json({
        id: 1,
        timezone: "America/Bogota",
        currency: "EUR",
        locale: "en-US",
        hasCompletedOnboarding: true,
      }),
    );
  });

  test("savings budget uses 'Add savings' and stores a manual deposit", async ({
    page,
  }) => {
    let manualSpent = 250;
    const category = () => ({
      id: 2,
      name: "Transportation",
      allocated: 1000,
      spent: manualSpent,
      manualSpent,
      transactionSpent: 0,
    });
    const budgets = () => [
      {
        id: 2,
        name: "Japan trip",
        type: "savings",
        period: "Yearly",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        totalAllocated: 1000,
        totalSpent: manualSpent,
        categories: [category()],
      },
    ];

    // Register broad first, then specific: Playwright resolves routes in
    // reverse registration order, so the narrow handlers must come last.
    await page.route("**/api/budgets**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(budgets()),
      });
    });

    const putRequest = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        request.url().includes("/api/budgets/category"),
    );

    await page.route("**/api/budgets/category", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      if (typeof body.manualSpent === "number") {
        manualSpent = body.manualSpent;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(category()),
      });
    });

    await page.route("**/api/budgets/categories**", async (route) => {
      const budgetId = Number(
        new URL(route.request().url()).searchParams.get("budgetId"),
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(budgetId === 2 ? [category()] : []),
      });
    });

    await page.goto("/app/dashboard/budgets", {
      waitUntil: "domcontentloaded",
    });

    await page.getByRole("heading", { name: "Japan trip" }).click();
    const addButton = page.getByRole("button", { name: "Add savings" });
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Add expense" }),
    ).toHaveCount(0);

    await addButton.click();
    await page.locator("input[id^=category-spent-]").fill("50");
    await page.getByRole("button", { name: /^Save$/ }).click();

    const request = await putRequest;
    expect(JSON.parse(request.postData() ?? "{}")).toMatchObject({
      id: 2,
      manualSpent: 300,
    });
    await expect(page.getByText(/€300,00/).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("create form has no spent field and submits a savings goal", async ({
    page,
  }) => {
    let postedBody: Record<string, unknown> | null = null;

    await page.route("**/api/budgets/categories**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/budgets", async (route) => {
      if (route.request().method() === "POST") {
        postedBody = JSON.parse(route.request().postData() ?? "{}");
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ ...postedBody, id: 10 }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/app/dashboard/budgets", {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "Create Budget" })
      .first()
      .click();

    const form = page.locator("form");
    await expect(form).toBeVisible({ timeout: 10000 });
    await expect(form.locator("input[id^=category-spent-]")).toHaveCount(0);
    await expect(form.getByText("Spent Amount")).toHaveCount(0);

    await page.getByTestId("budget-type-savings").click();
    await expect(
      form.locator('label[for="category-allocated-0"]'),
    ).toHaveText("Goal");

    await page.locator("input#name").fill("Car savings");
    await page.locator("select#category-name-0").selectOption("Transportation");
    await page.locator("input#category-allocated-0").fill("500");
    await form.locator('button[type="submit"]').click();

    await expect.poll(() => postedBody).not.toBeNull();
    expect(postedBody).toMatchObject({
      name: "Car savings",
      type: "savings",
      totalAllocated: 500,
      categories: [
        {
          name: "Transportation",
          allocated: 500,
          manualSpent: 0,
          spent: 0,
        },
      ],
    });
  });
});
