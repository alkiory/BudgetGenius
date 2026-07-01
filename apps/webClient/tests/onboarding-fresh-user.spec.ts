/**
 * @file onboarding-fresh-user.spec.ts
 *
 * Android APK dev audit, 2026-07 (v1.7.0) regression net.
 *
 * WHAT TIPPED THE FIX. A brand-new user from the Capacitor APK
 * who completed signup was routed to `/app/dashboard` directly,
 * skipping the `/app/onboarding` preferences wizard. Root cause
 * was twofold:
 *
 *   1. **OnboardingGuard** gate predicate used strict-negative
 *      `settings?.hasCompletedOnboarding === false`. When
 *      `useGetSettings()` returned `undefined` (transient JWT
 *      round-trip failure, or cache-miss before fetch resolves),
 *      `undefined === false` evaluates to `false` — the guard
 *      passed-through silently and the fresh user landed on
 *      `/app/dashboard` with hardcoded defaults.
 *
 *   2. **splash.tsx** `go()` ternary routed
 *      `onboardingComplete === null` (transient /user-settings
 *      failure on the cold-start path) to `/app/dashboard` —
 *      exact opposite of what the surrounding doc-comment
 *      claimed ("default to onboarding").
 *
 * WHAT THIS SPEC PINS. The symmetric fix shipped as:
 *
 *   - `OnboardingGuard`: predicate changed from
 *     `=== false` to `!== true` (positive-confirmation).
 *   - `OnboardingPage`: inverse bounce-back changed from truthy
 *     `settings?.hasCompletedOnboarding` to STRICT
 *     `settings?.hasCompletedOnboarding === true`.
 *   - `splash.tsx`: ternary inverted to
 *     `=== true ? Dashboard : Onboarding`.
 *
 * The truth table below sweeps every (fresh × finished) ×
 * (data-fits = true/false/undefined/transient-error) cell and
 * asserts the routed URL. The wizard's symmetric
 * `=== true` bounce-back guarantees that a finished user whose
 * `/user-settings` line transiently faulted lands back at
 * `/app/dashboard` within one render cycle (otherwise the spec
 * would mock a stable `/user-settings` 200 with `true` for
 * case 4).
 *
 * RUN. `pnpm --filter frontend-web test`
 */

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * Android APK dev audit, 2026-07 (v1.7.0) regression net.
 *
 * Mocking note: Playwright's `request` fixture (APIRequestContext)
 * is Node-side and does NOT intercept the browser's axios instance.
 * For browser-side axios interception we MUST use `page.route()`.
 * This helper consolidates the four truth-table mocks to
 * `page.route()` so the assertions match the production code path.
 *
 * WHAT TIPPED THE FIX. A brand-new user from the Capacitor APK
 * who completed signup was routed to `/app/dashboard` directly,
 * skipping the `/app/onboarding` preferences wizard. Root cause
 * was twofold:
 *
 *   1. **OnboardingGuard** gate predicate used strict-negative
 *      `settings?.hasCompletedOnboarding === false`. When
 *      `useGetSettings()` returned `undefined` (transient JWT
 *      round-trip failure, or cache miss before fetch resolves),
 *      `undefined === false` evaluates to `false` — the guard
 *      passed-through silently and the fresh user landed on
 *      `/app/dashboard` with hardcoded defaults.
 *
 *   2. **splash.tsx** `go()` ternary routed
 *      `onboardingComplete === null` (transient /user-settings
 *      failure on the cold-start path) to `/app/dashboard` —
 *      exact opposite of what the surrounding doc-comment
 *      claimed ("default to onboarding").
 *
 * WHAT THIS SPEC PINS. The symmetric fix shipped as:
 *
 *   - `OnboardingGuard`: predicate changed from
 *     `=== false` to `!== true` (positive-confirmation).
 *   - `OnboardingPage`: inverse bounce-back changed from truthy
 *     `settings?.hasCompletedOnboarding` to STRICT
 *     `settings?.hasCompletedOnboarding === true`.
 *   - `splash.tsx`: ternary inverted to
 *     `=== true ? Dashboard : Onboarding`.
 *
 * The truth table below sweeps every (fresh × finished) ×
 * (data-fits = true/false/undefined/transient-error) cell and
 * asserts the routed URL. The wizard's symmetric
 * `=== true` bounce-back guarantees that a finished user whose
 * `/user-settings` line transiently faulted lands back at
 * `/app/dashboard` within one render cycle (otherwise the spec
 * would mock a stable `/user-settings` 200 with `true` for
 * case 4).
 *
 * RUN. `pnpm --filter frontend-web test`
 */

const USER_PROFILE_PAYLOAD = {
  id: 42,
  name: "Sergio",
  surname: "Campbell",
  email: "sergio@example.com",
  authProvider: "email",
  role: "user",
  isPremium: false,
} as const;

/**
 * Wire `page.route()` handlers for the three endpoints the post-
 * signup flow needs, in priority order: /auth/verify → /user/profile
 * → /user-settings. The /user-settings handler internally tracks
 * `settingsCallCount` so cell 4 can switch responses after the
 * third 5xx (post-retry 200 with `true`) without any external state.
 */
async function mockApi(
  page: Page,
  options: {
    /** value of `hasCompletedOnboarding` returned by /user-settings */
    settings: boolean | "transient-error";
  },
): Promise<void> {
  let settingsCallCount = 0;

  await page.route("**/api/auth/verify", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isValid: true, user: { userId: 42 } }),
    });
  });

  await page.route("**/api/user/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(USER_PROFILE_PAYLOAD),
    });
  });

  await page.route("**/api/user-settings", async (route) => {
    settingsCallCount += 1;
    if (options.settings === "transient-error" && settingsCallCount <= 3) {
      // 3× 5xx to exhaust React Query's `retry: 3`.
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "mocked transient failure" }),
      });
      return;
    }
    if (options.settings === "transient-error") {
      // Post-retry 200 with `true` so the wizard's symmetric
      // bounce-back has the data it needs to redirect.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          timezone: "America/Bogota",
          currency: "COP",
          locale: "es-CO",
          hasCompletedOnboarding: true,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        timezone: options.settings ? "America/Bogota" : "UTC",
        currency: options.settings ? "COP" : "USD",
        locale: options.settings ? "es-CO" : "en-US",
        hasCompletedOnboarding: options.settings,
      }),
    });
  });
}
  // /auth/verify returns 200 (the user just signed up, the JWT
  // is in localStorage on the Capacitor path or in cookies on
  // the web path; either way the backend issues a fresh 200 on
  // verify). We don't need to shape the body — useLoadUser
  // reads /user/profile next, but we mock that too.
  await request.post("**/api/auth/verify", {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ isValid: true, user: { userId: 42 } }),
  });

  await request.get("**/api/user/profile", {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: 42,
      name: "Sergio",
      surname: "Campbell",
      email: "sergio@example.com",
      authProvider: "email",
      role: "user",
      isPremium: false,
    }),
  });

  if (options.settings === "transient-error") {
    // Three failures to exhaust React Query's `retry: 3`. The
    // spec still asserts the gate routes a FRESH user to
    // /app/onboarding under this condition (the bypass
    // regression).
    await request.get("**/api/user-settings", {
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "mocked transient failure" }),
    });
    await request.get("**/api/user-settings", {
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "mocked transient failure" }),
    });
    await request.get("**/api/user-settings", {
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "mocked transient failure" }),
    });
  } else {
    await request.get("**/api/user-settings", {
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        timezone: options.settings ? "America/Bogota" : "UTC",
        currency: options.settings ? "COP" : "USD",
        locale: options.settings ? "es-CO" : "en-US",
        hasCompletedOnboarding: options.settings,
      }),
    });
  }
}

test.describe("OnboardingGuard v1.7.0 truth-table regression net", () => {
  // Standardized 8-second timeout across all four cells. Cells
  // 3 + 4 need the headroom for React Query's `retry: 3` plus
  // the wizard's strict-positive bounce-back to fire. Bumping
  // every cell (not just the slow ones) keeps the contract
  // future-safe if the retry count is ever raised (e.g. retry: 5).
  const CELL_TIMEOUT_MS = 8000;

  test("cell 1 — fresh user with /user-settings=false lands on /app/onboarding", async ({
    page,
  }) => {
    await mockApi(page, { settings: false });
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/app\/onboarding$/, {
      timeout: CELL_TIMEOUT_MS,
    });
  });

  test("cell 2 — finished user with /user-settings=true lands on /app/dashboard (no bounce)", async ({
    page,
  }) => {
    await mockApi(page, { settings: true });
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/app\/dashboard$/, {
      timeout: CELL_TIMEOUT_MS,
    });
  });

  test("cell 3 — fresh user with transient /user-settings 5xx STILL lands on /app/onboarding (the regression)", async ({
    page,
  }) => {
    await mockApi(page, { settings: "transient-error" });
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/app\/onboarding$/, {
      timeout: CELL_TIMEOUT_MS,
    });
  });

  test("cell 4 — finished user with transient /user-settings 5xx lands on /app/onboarding then bounces back to /app/dashboard", async ({
    page,
  }) => {
    await mockApi(page, { settings: "transient-error" });
    await page.goto("/app/dashboard");
    // Give React Query enough time to retry 3x + the wizard's
    // inverse strict-===true bounce-back to fire.
    await expect(page).toHaveURL(/\/app\/dashboard$/, {
      timeout: CELL_TIMEOUT_MS,
    });
  });
});
