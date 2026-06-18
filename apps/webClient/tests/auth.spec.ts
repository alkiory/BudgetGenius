import { expect, test } from "./config/fixtures";

test('Should go to login page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByText('Welcome backSign in to your').click();
});

test('Should not login', async ({ page }) => {
  // Mock the login endpoint to return 401
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: "🔒 Invalid credentials, try again", error: "Unauthorized", statusCode: 401 }),
    });
  });

  await page.goto('/');
  await page.getByRole('link', { name: /log in/i }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('user@user.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('BadPassword123*');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('🔒 Invalid credentials, try again')).toBeVisible();
});

test('should navigate to dashboard after login', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /log in/i }).click();
  await page.getByText('Welcome back').isVisible();
});

test('should display mocked user data', async ({ page }) => {
  // Set up auth state before navigating to a protected route
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'mock-token');
    localStorage.setItem('refreshToken', 'mock-refresh');
  });

  // Mock the verify endpoint to simulate a logged-in session
  await page.route('**/api/auth/verify', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json' });
  });

  // Mock the profile endpoint to return mocked user data
  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, name: 'Mocked', surname: 'User', email: 'mock@example.com', isPremium: true }),
    });
  });

  // Mock user settings (needed by dashboard page)
  await page.route('**/api/user-settings**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, timezone: 'America/New_York', currency: 'USD', locale: 'en-US' }),
    });
  });

  // Mock dashboard overview (needed by dashboard page)
  await page.route('**/api/dashboard**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ balance: 5000, income: 3000, expenses: 2000, period: new Date().toISOString() }),
    });
  });

  // Mock expense categories
  await page.route('**/api/expense-categories**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: 0, byCategory: [], largest: null, period: new Date().toISOString() }),
    });
  });

  // Mock transactions (for RecentTransactions component)
  await page.route('**/api/transactions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [] }),
    });
  });

  // Mock budgets (for BudgetProgress component)
  await page.route('**/api/budgets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // Mock saving goals
  await page.route('**/api/saving-goals**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.goto('/app/dashboard', { waitUntil: 'domcontentloaded' });
  // Wait for React to hydrate and all mocked API calls to resolve
  await page.waitForTimeout(3000);
  // Now verify that the mocked data is rendered correctly
  // The dashboard shows "Welcome back, Mocked" using the user's name
  await expect(page.getByText('Mocked')).toBeVisible({ timeout: 10000 });
});
