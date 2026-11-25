import { expect, test } from "./config/fixtures";

// These specs run against the Astro landing (apps/landing), which now owns
// the root URL. The SPA keeps /app/* and /auth/* — see playwright.config.ts.
test("Landing page is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /money/i,
  );
  await expect(page.getByRole("link", { name: "Start free" }).first()).toBeVisible();
});

test("Should change theme", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("Should see how it works", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page.locator("#how-it-works")).toBeInViewport();
});

test("Should see mobile and desktop showcase", async ({ page }) => {
  await page.goto("/");
  await page.locator("#showcase").scrollIntoViewIfNeeded();

  await expect(page.locator("#showcase figure")).toHaveCount(2);
  await expect(page.getByText("Desktop", { exact: true })).toBeVisible();
  await expect(page.getByText("Mobile", { exact: true })).toBeVisible();
});
