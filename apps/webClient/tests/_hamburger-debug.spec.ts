import { test, expect } from "@playwright/test";

test("hamburger click toggles drawer", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errs.push(`console.error: ${m.text()}`); });

  let response;
  try {
    response = await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 20000 });
  } catch (e: any) {
    throw new Error("Dev server unreachable at localhost:5173 — start with `pnpm dev` first: " + e.message);
  }
  await page.waitForTimeout(500);

  const preAria = await page.getAttribute('button[aria-controls="mobile-primary-menu"]', "aria-expanded");
  const preDrawerCount = await page.locator('#mobile-primary-menu').count();
  console.log(`PRE: aria-expanded=${preAria}, drawer DOM count=${preDrawerCount}`);

  await page.screenshot({ path: "/tmp/hb-pre.png" });

  await page.click('button[aria-controls="mobile-primary-menu"]');
  await page.waitForTimeout(500);

  const postAria = await page.getAttribute('button[aria-controls="mobile-primary-menu"]', "aria-expanded");
  const postDrawerCount = await page.locator('#mobile-primary-menu').count();
  console.log(`POST: aria-expanded=${postAria}, drawer DOM count=${postDrawerCount}`);
  console.log(`Console errors during run: ${errs.length}`);
  errs.forEach((e) => console.log("  ERR: " + e));

  await page.screenshot({ path: "/tmp/hb-post.png", fullPage: true });

  expect(postAria).toBe("true");
  expect(postDrawerCount).toBeGreaterThan(0);
});
