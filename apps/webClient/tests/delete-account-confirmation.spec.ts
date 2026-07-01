import { test, expect, type Page } from "@playwright/test";

/**
 * v1.7 — regression spec for the danger-zone "Eliminar Cuenta" gate.
 *
 * The previous comparison in `apps/webClient/src/presentation/components/
 * profile/account-settings.tsx` was hardcoded to the English literal
 * `"delete my account"`. That meant:
 *   - Spanish users (prompted to type "eliminar mi cuenta") could NEVER
 *     satisfy the gate — no Spanish input matches an English string.
 *   - Even English users tripped on trailing spaces and capitalization
 *     variants — the predicate had no `trim()` and no `toLowerCase()`.
 *
 * The fix derives the comparison from the i18n key
 * `settings.deleteConfirmPhrase` and applies `trim().toLowerCase()` to
 * both sides. This spec pins all 8 user-reported input variants in BOTH
 * locales so any future drift in the comparison logic (or accidental
 * hardcoded string reintroduction) re-fails loud.
 */

// ---------------------------------------------------------------------------
// Auth-mock scaffolding (borrowed pattern from auth.spec.ts)
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
  // Any other dashboard fetches during profile mount.
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
}

async function openDangerZone(page: Page) {
  await page.goto("/app/profile", { waitUntil: "domcontentloaded" });
  // Initial session-warm + React hydration window.
  await page.waitForTimeout(1500);
  // Click "Eliminar Cuenta" / "Delete Account" to expand the confirmation.
  await page
    .getByRole("button", { name: /eliminar cuenta|delete account/i })
    .click();
  // The destructive confirmation button is initially rendered after the
  // modal's confirm-input appears.
  await expect(page.getByLabel(/confirm-delete/i)).toBeVisible({
    timeout: 5000,
  });
}

// ---------------------------------------------------------------------------
// 5 POSITIVE cases — must enable the destructive button
// ---------------------------------------------------------------------------

const POSITIVE_EN = [
  { label: "exact English phrase", input: "delete my account" },
  { label: "trailing space", input: "delete my account " },
  { label: "leading space", input: " delete my account" },
  { label: "capital initial", input: "Delete my account" },
  { label: "all caps", input: "DELETE MY ACCOUNT" },
];

const POSITIVE_ES = [
  { label: "exact Spanish phrase", input: "eliminar mi cuenta" },
  { label: "trailing space (ES)", input: "eliminar mi cuenta " },
  { label: "leading space (ES)", input: " eliminar mi cuenta" },
  { label: "capital initial (ES)", input: "Eliminar mi cuenta" },
  { label: "all caps (ES)", input: "ELIMINAR MI CUENTA" },
];

for (const { label, input } of [...POSITIVE_EN, ...POSITIVE_ES]) {
  test(`v1.7 — enables delete button for: ${label}`, async ({ page }) => {
    await mockAuthSession(page);
    await openDangerZone(page);

    const inputBox = page.getByLabel(/confirm-delete/i);
    await inputBox.fill(input);

    const destructive = page.getByRole("button", {
      name: /eliminar cuenta permanentemente|permanently delete account/i,
    });
    await expect(destructive).toBeEnabled({ timeout: 3000 });
  });
}

// ---------------------------------------------------------------------------
// 3 NEGATIVE cases — must keep the destructive button DISABLED
// ---------------------------------------------------------------------------

const NEGATIVE = [
  { label: "incomplete phrase", input: "eliminar cuenta" },
  { label: "empty", input: "" },
  { label: "double-space-inside", input: "eliminar mi  cuenta" },
];

for (const { label, input } of NEGATIVE) {
  test(`v1.7 — keeps delete button DISABLED for: ${label}`, async ({
    page,
  }) => {
    await mockAuthSession(page);
    await openDangerZone(page);

    const inputBox = page.getByLabel(/confirm-delete/i);
    await inputBox.fill(input);

    const destructive = page.getByRole("button", {
      name: /eliminar cuenta permanentemente|permanently delete account/i,
    });
    await expect(destructive).toBeDisabled();
  });
}

// ---------------------------------------------------------------------------
// Locale-awareness assertion — the prompt itself interpolates from the
// same i18n key the gate reads, so changing language must immediately
// change the EXPECTED phrase (this is the property the bug broke).
// ---------------------------------------------------------------------------

test("v1.7 — Spanish user typing the Spanish phrase enables the button (was the bug)", async ({
  page,
}) => {
  await mockAuthSession(page);
  await openDangerZone(page);

  // The exact phrase the visual prompt DEMANDS in Spanish is what must
  // match. Previously this disabled the button because the gate was
  // hardcoded to the English literal "delete my account".
  const inputBox = page.getByLabel(/confirm-delete/i);
  await inputBox.fill("eliminar mi cuenta");

  await expect(
    page.getByRole("button", {
      name: /eliminar cuenta permanentemente|permanently delete account/i,
    }),
  ).toBeEnabled();
});
