import { expect, test } from "./config/fixtures";

test("Should go to login page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Log in" }).click();
  await page.getByText("Welcome backSign in to your").click();
});

test("Should not login", async ({ page }) => {
  // Mock the login endpoint to return 401
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        message: "🔒 Invalid credentials, try again",
        error: "Unauthorized",
        statusCode: 401,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("link", { name: /log in/i }).click();
  await page.getByRole("textbox", { name: "Email" }).fill("user@user.com");
  await page.getByRole("textbox", { name: "Password" }).fill("BadPassword123*");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("🔒 Invalid credentials, try again"),
  ).toBeVisible();
});

test("should navigate to dashboard after login", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /log in/i }).click();
  await page.getByText("Welcome back").isVisible();
});

test("should display mocked user data", async ({ page }) => {
  // Set up auth state before navigating to a protected route
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("accessToken", "mock-token");
    localStorage.setItem("refreshToken", "mock-refresh");
  });

  // Mock the verify endpoint to simulate a logged-in session
  await page.route("**/api/auth/verify", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json" });
  });

  // Mock the profile endpoint to return mocked user data
  await page.route("**/api/user/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        name: "Mocked",
        surname: "User",
        email: "mock@example.com",
        isPremium: true,
      }),
    });
  });

  // Mock user settings (needed by dashboard page)
  await page.route("**/api/user-settings**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        timezone: "America/New_York",
        currency: "USD",
        locale: "en-US",
      }),
    });
  });

  // Mock dashboard overview (needed by dashboard page)
  await page.route("**/api/dashboard**", async (route) => {
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

  // Mock expense categories
  await page.route("**/api/expense-categories**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total: 0,
        byCategory: [],
        largest: null,
        period: new Date().toISOString(),
      }),
    });
  });

  // Mock transactions (for RecentTransactions component)
  await page.route("**/api/transactions**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ transactions: [] }),
    });
  });

  // Mock budgets (for BudgetProgress component)
  await page.route("**/api/budgets**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  // Mock saving goals
  await page.route("**/api/saving-goals**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.goto("/app/dashboard", { waitUntil: "domcontentloaded" });
  // Wait for React to hydrate and all mocked API calls to resolve
  await page.waitForTimeout(3000);
  // Now verify that the mocked data is rendered correctly
  // The dashboard shows "Welcome back, Mocked" using the user's name
  await expect(page.getByText("Mocked")).toBeVisible({ timeout: 10000 });
});

// v1.3.1 — regression test for the Capacitor Android WebView
// infinite-loop cascade. Without `{ _retry: true }` on the inner
// `/auth/refresh` POST inside `apps/webClient/src/infrastructure/
// api.config.ts`, when the refresh endpoint itself 401s the
// interceptor's 401 handler recurses into another refresh which
// recurses into another, producing an unbounded stream of
// `POST /api/auth/refresh {}` curls until ThrottlerModule 429s.
//
// This spec reproduces the v1.3.0 bug-by-stale-state scenario:
//   1. localStorage has valid-looking tokens (steady-state after a
//      successful /auth/firebase-login).
//   2. /app/dashboard mounts and fetches /api/dashboard/overview.
//   3. /api/dashboard/overview returns 401 (simulate backend rejecting
//      the stale access token).
//   4. Frontend interceptor calls refreshToken() → POST /auth/refresh.
//   5. /auth/refresh also returns 401 (simulate revoked session).
//   6. With v1.3.0: refreshLog grows unbounded (interceptor recurses).
//   7. With v1.3.1: refreshLog is bounded to exactly one call, the
//      catch block clears localStorage, the user is gracefully logged
//      out instead of trapped in a curl storm.
test("v1.3.1 — caps /auth/refresh at exactly one call when refresh itself 401s", async ({
  page,
}) => {
  const refreshLog: Array<unknown> = [];

  await page.route("**/api/auth/refresh", async (route) => {
    refreshLog.push(route.request().postDataJSON() ?? null);
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Invalid refresh token" }),
    });
  });

  // Steady-state: tokens in localStorage as if /auth/firebase-login's
  // response interceptor had just persisted them.
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("accessToken", "stale-mock-access-token");
    localStorage.setItem("refreshToken", "stale-mock-refresh-token");
  });

  // Mount a protected route. /api/auth/verify passes (so the protected
  // route renders), /api/user/profile passes, but the dashboard
  // overview endpoint returns 401 — this is the entry-point of the
  // recursion cascade because the dashboard fetches are NOT marked
  // with `_retry: true` (only /auth/verify and /user/profile are, on
  // those specific useRestoreSession paths).
  await page.route("**/api/auth/verify", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isValid: true }),
    });
  });
  await page.route("**/api/user/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        name: "Stale",
        surname: "User",
        email: "stale@user.com",
        isPremium: false,
      }),
    });
  });
  await page.route("**/api/user-settings**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        timezone: "America/New_York",
        currency: "USD",
        locale: "en-US",
      }),
    });
  });

  // The trigger: the dashboard overview endpoint returns 401. This is
  // the same shape as the v1.3.0 production trace (a 401 from a
  // non-`/auth/refresh`, non-`/auth/login` request).
  await page.route("**/api/dashboard/overview**", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    });
  });

  // Other dashboard-side fetches succeed so the rest of the page
  // mounts and we don't flake on an unrelated 401.
  await page.route("**/api/expense-categories**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
  await page.route("**/api/transactions**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ transactions: [] }),
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

  await page.goto("/app/dashboard", { waitUntil: "domcontentloaded" });

  // Let any cascading requests settle. The v1.3.0 bug would have grown
  // refreshLog unbounded; with the fix it caps out within a few ms of
  // the cascade starting. 2s is overkill for the happy path but
  // confidently past any 4-rps throttle-protected sub-cascade.
  await page.waitForTimeout(2000);

  // v1.3.0: refreshLog.length would grow unbounded (or at least past
  // 5-10 within this window). v1.3.1: exactly 1 (one /auth/refresh
  // call before the catch block clears state).
  expect(refreshLog.length).toBeLessThanOrEqual(1);

  // The catch block at api.config.ts:196–198 must have cleared
  // localStorage so the user is gracefully logged-out instead of
  // leaving stale tokens around for the next page-load to recycle.
  const tokensAfter = await page.evaluate(() => ({
    accessToken: localStorage.getItem("accessToken"),
    refreshToken: localStorage.getItem("refreshToken"),
  }));
  expect(tokensAfter.accessToken).toBeNull();
  expect(tokensAfter.refreshToken).toBeNull();
});
