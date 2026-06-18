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
        body: JSON.stringify({ id: 1, name: "Test", surname: "User", email: "test@test.com", isPremium: true }),
      });
    });
    await page.route("**/api/user-settings**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, timezone: "America/Bogota", currency: "COP", locale: "es-CO" }),
      });
    });
    await page.route("**/api/dashboard/overview**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ balance: 5000, income: 3000, expenses: 2000, period: new Date().toISOString() }),
      });
    });
    await page.route("**/api/dashboard/expense-breakdown**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total: 2000, byCategory: [], largest: null, period: new Date().toISOString() }),
      });
    });
    await page.route("**/api/transactions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transactions: [], meta: { total: 0, offset: "0", limit: "5", nextOffset: null } }),
      });
    });
    await page.route("**/api/budgets**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
    await page.route("**/api/saving-goals**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
    await page.route("**/api/goals**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
    await page.route("**/api/incomes**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ incomes: [] }) });
    });
  });

  test("should convert USD dashboard values to COP", async ({ page }) => {
    // Set up response promises before navigating
    const overviewResp = page.waitForResponse("**/api/dashboard/overview**", { timeout: 20000 });
    const settingsResp = page.waitForResponse("**/api/user-settings**", { timeout: 20000 });

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
});
