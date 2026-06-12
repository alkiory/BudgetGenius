import { expect, test } from "./config/fixtures";

test("Home page is visible", async ({ page }) => {
  await page.goto('/');
})

test("Should change theme", async({page}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await page.getByRole('button', { name: 'Dark' }).click();

  await expect(page.locator("body")).toHaveClass(/dark/)
})

test('Should see how it works', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'See how it works' }).click();
  await page.locator('#root div').filter({ hasText: 'Desktop ExperienceOur desktop' }).nth(2).isVisible();
});

test('Should see mobile and desktop experience', async ({ page }) => {
  await page.goto('/how-it-works');

  await page.getByRole('button', { name: 'Mobile' }).click();
  await page.getByRole('heading', { name: 'Mobile Experience' }).isVisible();
  await page.getByRole('button', { name: 'Desktop' }).click();
  await page.getByRole('heading', { name: 'Desktop Experience' }).isVisible();
});
