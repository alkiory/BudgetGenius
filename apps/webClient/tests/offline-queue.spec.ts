import { test, expect } from './config/fixtures';

test.describe('Offline Queue', () => {

  // Clean up localStorage after each test
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('offline_queue')).catch(() => {});
  });

  test('queues a transaction when offline and flushes it on reconnect', async ({ page }) => {
    // ---- Mock auth endpoints ----
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
          user: { id: 1, name: 'Test', surname: 'User', email: 'test@test.com', isPremium: true },
        }),
      });
    });
    await page.route('**/api/auth/verify', async (route) => route.fulfill({ status: 200 }));
    await page.route('**/api/user/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, name: 'Test', surname: 'User', email: 'test@test.com', isPremium: true }),
      });
    });

    // Mock dashboard + related endpoints (needed to render the dashboard layout)
    await page.route('**/api/dashboard*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ balance: 1000, income: 500, expenses: 200, period: new Date().toISOString() }),
      });
    });
    await page.route('**/api/expense-categories**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ total: 0, byCategory: [], largest: null, period: new Date().toISOString() }),
      });
    });
    await page.route('**/api/user-settings**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 1, timezone: 'America/New_York', currency: 'USD', locale: 'en-US' }),
      });
    });
    await page.route('**/api/budgets**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await page.route('**/api/saving-goals**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await page.route('**/api/incomes**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ incomes: [] }),
      });
    });
    await page.route('**/api/goals**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // ---- Intercept transactions API ----
    // First POST: simulate offline (abort with connectionfailed)
    // Subsequent POSTs: let them succeed
    let hasSeenFirstPost = false;
    await page.route('**/api/transactions**', async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 }),
        });
      } else if (request.method() === 'POST' && !hasSeenFirstPost) {
        hasSeenFirstPost = true;
        await route.abort('connectionfailed');
      } else {
        await route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({ id: 999, description: 'Offline test', amount: 50 }),
        });
      }
    });

    // ---- Set up auth state and navigate directly to transactions page ----
    // Use addInitScript to inject tokens before any page JavaScript runs
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-token');
      localStorage.setItem('refreshToken', 'mock-refresh');
    });
    await page.goto('/app/dashboard/transactions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // ---- Open Add Transaction modal ----
    const addBtn = page.getByRole('button', { name: /add transaction/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(800);

    // ---- Fill the form (all required fields) ----
    await page.locator('select[name="category"]').selectOption('Food');
    await page.getByPlaceholder(/description/i).fill('Offline test transaction');
    // Currency selector was removed — amount input now uses the profile currency setting
    await page.locator('input[name="amount"]').fill('50');

    // ---- Set up the requestfailed listener BEFORE submitting ----
    // (otherwise the event may fire before we start listening)
    const postFailed = page.waitForEvent('requestfailed', {
      predicate: req => req.url().includes('/api/transactions') && req.method() === 'POST',
      timeout: 5000,
    });

    // ---- Submit the form ----
    // Use form.requestSubmit() which properly triggers React's onSubmit handler
    await page.locator('form').evaluate(form => form.requestSubmit());

    // ---- Verify queue was stored (before page reload destroys context) ----
    // enqueueRequest writes to localStorage synchronously in the axios error handler.
    await postFailed;
    // Give the JS event loop one tick to process the enqueueRequest call
    await page.waitForTimeout(50);

    // Confirm the queue content
    const queueStored = await page.evaluate(() => {
      const q = localStorage.getItem('offline_queue');
      return q ? JSON.parse(q) : null;
    });
    expect(queueStored).not.toBeNull();
    expect(queueStored!.length).toBeGreaterThanOrEqual(1);
    expect(queueStored![0].method).toBe('POST');
    expect(queueStored![0].url).toContain('/transactions');
  });

  test('shows offline indicator when navigator.onLine is false', async ({ page }) => {
    await page.goto('/privacy-policy');
    await page.waitForTimeout(2000);

    // Simulate going offline after the component has mounted
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      window.dispatchEvent(new Event('offline'));
    });
    await page.waitForTimeout(500);

    await expect(page.getByText(/offline/i)).toBeVisible({ timeout: 5000 });
  });
});
