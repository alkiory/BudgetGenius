import { test, expect } from './config/fixtures';

test.describe('Transaction form smoke test', () => {
  test.beforeEach(async ({ page }) => {
    // Set up auth state before navigating to protected routes
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'mock-token');
      localStorage.setItem('refreshToken', 'mock-refresh');
    });

    // Mock auth verify
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json' });
    });

    // Mock user profile
    await page.route('**/api/user/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, name: 'Test User', email: 'test@test.com', isPremium: true }),
      });
    });

    // Mock transactions list
    await page.route('**/api/transactions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock budgets (needed for sidebar)
    await page.route('**/api/budgets', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock any other dashboard data
    await page.route('**/api/dashboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    // Mock expense categories
    await page.route('**/api/expense-categories**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Navigate to transactions page
    await page.goto('/app/dashboard/transactions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // Allow React to hydrate and render
  });

  test('should show amount input empty by default', async ({ page }) => {
    // Find the primary "Add Transaction" button (header area, first one)
    const addButton = page.getByRole('button', { name: /add transaction/i }).first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Wait for the modal to appear
    const amountInput = page.locator('input#amount');
    await expect(amountInput).toBeVisible({ timeout: 5000 });

    // Verify the amount input is empty (placeholder visible)
    await expect(amountInput).toHaveValue('');
  });

  test('should default category to Other', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add transaction/i }).first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Wait for modal
    const categorySelect = page.locator('select#category');
    await expect(categorySelect).toBeVisible({ timeout: 5000 });

    // Verify default value is Other
    await expect(categorySelect).toHaveValue('Other');
  });

  test('should show error toast when submitting with amount 0', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add transaction/i }).first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Wait for modal
    const amountInput = page.locator('input#amount');
    await expect(amountInput).toBeVisible({ timeout: 5000 });

    // Fill with zero (passes HTML5 validation since input is type="number" min="0")
    await amountInput.fill('0');
    await expect(amountInput).toHaveValue('0');

    // Submit the form — HTML5 validation passes (0 is valid), React catches absAmount === 0
    await page.locator('form').evaluate(form => form.requestSubmit());

    // The error toast should appear
    const toast = page.getByText('Amount cannot be 0').first();
    await expect(toast).toBeVisible({ timeout: 5000 });
  });
});
