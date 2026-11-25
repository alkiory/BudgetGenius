import { test as base, expect } from "@playwright/test";

/**
 * The dashboard product tour is a real overlay: driver.js blocks pointer
 * events outside the highlighted element. Dashboard specs that are not about
 * the tour would otherwise hang on their first click. Dismiss it as soon as
 * it appears for every spec using these fixtures.
 *
 * `tour.spec.ts` imports `@playwright/test` directly (not this fixture), so
 * the dedicated tour coverage still exercises the real thing.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addLocatorHandler(
      page.locator(".driver-popover .driver-popover-close-btn"),
      async () => {
        try {
          await page
            .locator(".driver-popover .driver-popover-close-btn")
            .click({ timeout: 2000 });
        } catch {
          // The popover can disappear between detection and the click (e.g.
          // a test navigated away). Nothing left to dismiss.
        }
      },
    );
    await use(page);
  },
});

export { expect };
