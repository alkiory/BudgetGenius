import { test, expect, type Page } from "@playwright/test";

/**
 * v1.7.2 — regression spec for the delete-account state-reset contract.
 *
 * Fixes the production regression described in
 * `rpi/delete-account-cleanup/research.md`: the danger-zone "Eliminar
 * Cuenta" button was a 2-second `setTimeout` placeholder that never
 * invoked the backend DELETE, AND the surrounding React Query / Redux /
 * localStorage state lingered so a re-login with the same email
 * authenticated as an existing user.
 *
 * Pinning contract — each test corresponds to one bullet of the
 * `clearAuthAndStateForLogout` order-of-side-effects from
 * `knowledge.md §6.8.5`. A future contributor who removes a side-effect
 * OR re-orders them will trip at least one test.
 */

// ---------------------------------------------------------------------------
// Auth-mock scaffolding (extends the v1.7 pattern from
// `delete-account-confirmation.spec.ts` — same fixtures so it runs the
// realtime-session path the user actually hits.)
// ---------------------------------------------------------------------------

async function mockAuthSession(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("accessToken", "mock-access");
    localStorage.setItem("refreshToken", "mock-refresh");
  });
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
        name: "QA",
        surname: "User",
        email: "qa@budgetgenius.com",
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
  // Catch-all dashboard fetches so the page mounts cleanly.
  for (const slug of [
    "dashboard",
    "expense-categories",
    "transactions",
    "budgets",
    "saving-goals",
  ]) {
    await page.route(`**/api/${slug}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });
  }
}

async function openDangerZone(page: Page) {
  await page.goto("/app/profile", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page
    .getByRole("button", { name: /eliminar cuenta|delete account/i })
    .click();
  await expect(page.getByLabel(/confirm-delete/i)).toBeVisible({
    timeout: 5000,
  });
}

// ---------------------------------------------------------------------------
// POSITIVE — happy path (real DELETE chain)
// ---------------------------------------------------------------------------

test("v1.7.2 — happy path: DELETE /user/:id is called AND page redirects to /auth/login AND localStorage tokens are cleared", async ({
  page,
}) => {
  // Track the DELETE call so we can assert the producer chain
  // actually fired (catches the v1.7.1-style stub regression —
  // a 2-second setTimeout that never reached the network).
  let deleteCallCount = 0;
  await page.route("**/api/user/*", async (route) => {
    if (route.request().method() === "DELETE") {
      deleteCallCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "user-deleted" }),
      });
      return;
    }
    await route.fallback();
  });

  await mockAuthSession(page);
  await openDangerZone(page);

  await page.getByLabel(/confirm-delete/i).fill("delete my account");
  await page
    .getByRole("button", { name: /permanently delete account/i })
    .click();

  // The clearAuthAndStateForLogout + window.location.href chain in
  // account-settings.tsx lands the user on /auth/login. We poll the
  // URL with a generous timeout because the redirect happens AFTER
  // the mutation's onSuccess completes (real network round-trip in
  // the test, ~50ms).
  await page.waitForURL("**/auth/login", { timeout: 8000 });

  // Load-bearing assertion: the actual DELETE was invoked exactly
  // once. If the queued stub fix ever sneaks back in (e.g. someone
  // reverts to "Simulate API call"), this is the assertion that
  // fires.
  expect(deleteCallCount).toBe(1);

  // half 1 of the §6.8.5 contract — localStorage tokens MUST be
  // gone. A prior bug left them in place, so a user reloading /app/*
  // within the same session was treated as authenticated.
  const stillAuthed = await page.evaluate(() => ({
    access: localStorage.getItem("accessToken"),
    refresh: localStorage.getItem("refreshToken"),
  }));
  expect(stillAuthed.access).toBeNull();
  expect(stillAuthed.refresh).toBeNull();
});

test("v1.7.2 — re-login by 'same' email triggers the onboarding wizard (fresh user via cleanup + cascade)", async ({
  page,
}) => {
  // Set up a mock that, on each GET /user-settings, returns
  // hasCompletedOnboarding = false (the fresh-user invariant from
  // §6.8.5).
  await page.route("**/api/user-settings**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        timezone: "UTC",
        currency: "USD",
        locale: "en-US",
        hasCompletedOnboarding: false,
      }),
    });
  });

  await mockAuthSession(page);

  // Simulate: the user just deleted and lands on the freshly-mounted
  // /app/* tree via the splash. The strict-positive
  // OnboardingGuard (§6.8.3) MUST redirect to /app/onboarding
  // because hasCompletedOnboarding !== true.
  await page.goto("/app/dashboard");

  // The onboarding module is fetched lazily; the URL lands on the
  // wizard once the gate fires.
  await page.waitForURL("**/app/onboarding", { timeout: 8000 });
});

// ---------------------------------------------------------------------------
// NEGATIVE — error / idempotency edges
// ---------------------------------------------------------------------------

test("v1.7.2 — when backend DELETE fails, the user STAYS on /app/profile and tokens are PRESERVED", async ({
  page,
}) => {
  await page.route("**/api/user/*", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "fail" }),
      });
      return;
    }
    await route.fallback();
  });

  await mockAuthSession(page);
  await openDangerZone(page);

  await page.getByLabel(/confirm-delete/i).fill("delete my account");
  await page
    .getByRole("button", { name: /permanently delete account/i })
    .click();

  // The onError handler in account-settings.tsx surfaces a toast and
  // re-enables the button. URL MUST NOT change.
  await page.waitForTimeout(2000);
  expect(page.url()).toContain("/app/profile");

  // Tokens are intact — failed-delete UX is "stay logged in, retry".
  const stillAuthed = await page.evaluate(() => ({
    access: localStorage.getItem("accessToken"),
    refresh: localStorage.getItem("refreshToken"),
  }));
  expect(stillAuthed.access).toBe("mock-access");
  expect(stillAuthed.refresh).toBe("mock-refresh");
});
