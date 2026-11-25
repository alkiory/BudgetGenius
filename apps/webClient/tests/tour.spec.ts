/**
 * @file tour.spec.ts
 *
 * Regression net for the driver.js product tour on the dashboard.
 *
 * Three bugs this pins:
 *
 *  1. **Scheduling.** The wizard flag used to be consumed before the 700 ms
 *     launch delay. Any re-render (settings resolving, dashboard queries
 *     landing) cleared the timer, the next pass saw "no flag / first visit"
 *     and silently stamped the build version without ever showing the tour.
 *     The new-user test waits for the popover after the dashboard settles.
 *
 *  2. **Language.** i18n starts in the detected browser language and switches
 *     to the saved locale once `/user-settings` resolves. The tour used to be
 *     built with the pre-switch language. The locale test forces an English
 *     browser + Spanish settings and asserts the Spanish copy.
 *
 *  3. **Build-change notice.** Existing users get a two-step "what's new"
 *     tour once per `__APP_VERSION__`, and the release step must offer a real
 *     changelog link that opens in a new tab.
 *
 * RUN. `pnpm --filter frontend-web test -- --project=app tests/tour.spec.ts`
 */

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const USER_PROFILE_PAYLOAD = {
  id: 42,
  name: "Sergio",
  surname: "Campbell",
  email: "sergio@example.com",
  authProvider: "email",
  role: "user",
  isPremium: false,
} as const;

const TOUR_VERSION_KEY = "budgetgenius:last-tour-version";
const ONBOARDING_FLAG_KEY = "budgetgenius:onboarding-just-finished";

/**
 * Seeds tokens and the pre-existing tour state once per browser session.
 * `addInitScript` runs on every navigation, so a reload after the tour must
 * not wipe the version the tour just stamped.
 */
async function seedTourState(
  page: Page,
  options: {
    seenVersion?: string | null;
    pendingOnboarding?: boolean;
  } = {},
): Promise<void> {
  await page.addInitScript(
    ({ seenVersion, pendingOnboarding, versionKey, onboardingKey }) => {
      try {
        localStorage.setItem("accessToken", "tour-mock-token");
        localStorage.setItem("refreshToken", "tour-mock-refresh");
        if (sessionStorage.getItem("tour-test-seeded") === "1") return;
        localStorage.removeItem(versionKey);
        if (seenVersion) localStorage.setItem(versionKey, seenVersion);
        if (pendingOnboarding) sessionStorage.setItem(onboardingKey, "1");
        sessionStorage.setItem("tour-test-seeded", "1");
      } catch {
        // Storage blocked: the spec fails on the assertions, not here.
      }
    },
    {
      seenVersion: options.seenVersion ?? null,
      pendingOnboarding: Boolean(options.pendingOnboarding),
      versionKey: TOUR_VERSION_KEY,
      onboardingKey: ONBOARDING_FLAG_KEY,
    },
  );
}

async function mockApi(
  page: Page,
  options: { locale?: "en-US" | "es-CO" } = {},
): Promise<void> {
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

  await page.route("**/api/user-settings**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        timezone: "America/Bogota",
        currency: "USD",
        locale: options.locale ?? "en-US",
        hasCompletedOnboarding: true,
      }),
    });
  });

  // Nested paths: a trailing `**` inside a segment does not cross `/` in
  // Playwright globs, so match the whole subtree with a RegExp.
  await page.route(/\/api\/dashboard\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        balance: 4820.4,
        income: 3200,
        expenses: 1379.6,
        period: new Date().toISOString(),
      }),
    });
  });

  await page.route(/\/api\/expense-categories/, async (route) => {
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

  await page.route(/\/api\/transactions/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        transactions: [],
        aggregate: { income: 0, expense: 0, net: 0 },
      }),
    });
  });

  await page.route(/\/api\/budgets/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route(/\/api\/saving-goals/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

function popover(page: Page) {
  return page.locator(".driver-popover.bg-tour");
}

test.describe("Dashboard product tour", () => {
  test("new user sees the full tour once, even after the dashboard re-renders", async ({
    page,
  }) => {
    await seedTourState(page, { pendingOnboarding: true });
    await mockApi(page);

    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/app\/dashboard$/);

    const tour = popover(page);
    const title = tour.locator(".driver-popover-title");

    // The 700 ms scheduling window plus settings/query re-renders.
    await expect(title).toHaveText("You're all set", { timeout: 10_000 });
    await expect(tour.locator(".driver-popover-progress-text")).toHaveText(
      "1 of 5",
    );

    await tour.getByRole("button", { name: "Next" }).click();
    await expect(title).toHaveText("Every area, one click away");
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(title).toHaveText("Log your first transaction");
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(title).toHaveText("Meet Finny");
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(title).toHaveText("Release notes live here");

    // The release step offers a real way into the changelog.
    await expect(tour.getByRole("link", { name: /changelog/i })).toHaveAttribute(
      "target",
      "_blank",
    );

    await tour.getByRole("button", { name: "Got it" }).click();
    await expect(tour).toHaveCount(0);

    const stored = await page.evaluate(
      (key) => ({
        version: localStorage.getItem(key),
        onboarding: sessionStorage.getItem(
          "budgetgenius:onboarding-just-finished",
        ),
      }),
      TOUR_VERSION_KEY,
    );
    const badge = page.locator('[data-tour="version-badge"]');
    expect(stored.version).toBe(
      (await badge.innerText()).trim().replace(/^v/, ""),
    );
    expect(stored.onboarding).toBeNull();

    // The tour tells users to open the changelog from the badge, so the
    // badge itself must be a real new-tab link.
    const badgeLink = badge.getByRole("link");
    await expect(badgeLink).toHaveAttribute("href", "/changelog");
    await expect(badgeLink).toHaveAttribute("target", "_blank");
  });

  test("build change shows what's new, opens the changelog in a new tab and never repeats", async ({
    page,
  }) => {
    await seedTourState(page, { seenVersion: "0.0.1" });
    await mockApi(page);

    await page.goto("/app/dashboard");
    const tour = popover(page);
    const title = tour.locator(".driver-popover-title");

    await expect(title).toContainText("What's new in v", { timeout: 10_000 });
    await expect(tour.locator(".driver-popover-progress-text")).toHaveText(
      "1 of 2",
    );

    await tour.getByRole("button", { name: "Next" }).click();
    await expect(title).toHaveText("See the full changelog");

    const changelog = tour.getByRole("link", {
      name: /open the full changelog/i,
    });
    await expect(changelog).toHaveAttribute("target", "_blank");
    await expect(changelog).toHaveAttribute("href", "/changelog");

    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      changelog.click(),
    ]);
    await popup.waitForLoadState("domcontentloaded");
    expect(new URL(popup.url()).pathname).toBe("/changelog");
    await popup.close();

    await tour.getByRole("button", { name: "Got it" }).click();
    await expect(tour).toHaveCount(0);

    // The build is stamped; a reload must stay quiet. The init script only
    // seeds once per browser session, so this reads the tour's own value.
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.locator(".driver-popover")).toHaveCount(0);
  });

  test("saved Spanish locale drives the tour copy on an English browser", async ({
    page,
  }) => {
    await seedTourState(page, { pendingOnboarding: true });
    await mockApi(page, { locale: "es-CO" });

    await page.goto("/app/dashboard");
    const tour = popover(page);

    // Browser is en-US (playwright config); settings resolve to es-CO. The
    // tour must read the post-switch translations, not the initial ones.
    await expect(tour.locator(".driver-popover-title")).toHaveText(
      "Todo listo",
      { timeout: 10_000 },
    );
    await expect(tour.locator(".driver-popover-progress-text")).toHaveText(
      "1 de 5",
    );
    await expect(
      tour.getByRole("button", { name: "Siguiente" }),
    ).toBeVisible();
  });
});
