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

    // Mock dashboard + expense categories (needed to render the page)
    await page.route('**/api/dashboard*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ balance: 1000, income: 500, expenses: 200 }),
      });
    });
    await page.route('**/api/expense-categories', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Food', value: 'food' },
          { id: 2, name: 'Transport', value: 'transport' },
        ]),
      });
    });

    // ---- Intercept transactions API ----
    // First POST: simulate offline (abort with connectionfailed)
    // Subsequent POSTs: let them succeed
    let hasSeenFirstPost = false;
    await page.route('**/api/transactions', async (route, request) => {
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

    // ---- Log in ----
    await page.goto('/auth/login');
    await page.waitForTimeout(2000);
    await page.getByRole('textbox', { name: /email/i }).fill('test@test.com');
    await page.getByRole('textbox', { name: /password/i }).fill('Password123*');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(2000);
    await page.waitForURL('**/app/dashboard', { timeout: 10000 }).catch(() => {});

    // ---- Navigate to transactions page ----
    await page.goto('/app/dashboard/transactions');
    await page.waitForTimeout(2000);

    // ---- Open Add Transaction modal ----
    const addBtn = page.getByRole('button', { name: /add transaction/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();
    await page.waitForTimeout(500);

    // ---- Fill the form (all required fields) ----
    await page.locator('select[name="category"]').selectOption('Food');
    await page.getByPlaceholder(/description/i).fill('Offline test transaction');
    await page.locator('select[name="currency"]').selectOption('USD');
    await page.locator('input[name="amount"]').fill('50');

    // ---- Submit ----
    const submitBtn = page.locator('form button[type="submit"]');
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    // force: true — the modal backdrop overlays the form and intercepts pointer events
    await submitBtn.click({ force: true });

    // ---- Verify queue was stored (before page reload destroys context) ----
    // enqueueRequest writes to localStorage synchronously in the axios error handler.
    // Use the requestfailed event as a signal that the error has been delivered to JS.
    const postFailed = page.waitForEvent('requestfailed', {
      predicate: req => req.url().includes('/api/transactions') && req.method() === 'POST',
      timeout: 5000,
    });
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

    // ---- Let the page reload and auto-flush finish ----
    // The reload triggers registerOnlineListener to auto-flush the queue.
    // Poll for the queue to be empty instead of using a hardcoded wait.
    await page.waitForFunction(() => {
      const q = localStorage.getItem('offline_queue');
      if (!q) return true;
      try { return JSON.parse(q).length === 0; }
      catch { return false; }
    }, { timeout: 10000, polling: 300 });


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
