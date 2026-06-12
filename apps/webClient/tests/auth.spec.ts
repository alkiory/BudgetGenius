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
      body: JSON.stringify({ id: '1', name: 'Mocked User', email: 'mock@example.com', isPremium: true }),
    });
  });

  await page.goto('/app/dashboard');
  // Now verify that the mocked data is rendered correctly:
  await expect(page.getByText('Mocked User')).toBeVisible({ timeout: 10000 });
});
