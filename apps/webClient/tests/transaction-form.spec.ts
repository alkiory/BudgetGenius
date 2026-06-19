import { test, expect } from "./config/fixtures";

test.describe("Transaction form smoke test", () => {
  test.beforeEach(async ({ page }) => {
    // Set up auth state before navigating to protected routes.
    // Phase 5 (T5.6): addInitScript runs BEFORE any page script so
    // i18next's module-level detector cannot race against our setter
    // when navigating from `/` to a protected route.
    await page.addInitScript(() => {
      localStorage.setItem("i18nextLng", "en");
    });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("accessToken", "mock-token");
      localStorage.setItem("refreshToken", "mock-refresh");
    });

    // Mock auth verify
    await page.route("**/api/auth/verify", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json" });
    });

    // Mock user profile
    await page.route("**/api/user/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@test.com",
          isPremium: true,
        }),
      });
    });

    // Mock transactions list
    await page.route("**/api/transactions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // Mock budgets (needed for sidebar)
    await page.route("**/api/budgets", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // Mock any other dashboard data
    await page.route("**/api/dashboard**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    // Mock expense categories
    await page.route("**/api/expense-categories**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // Navigate to transactions page
    await page.goto("/app/dashboard/transactions", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000); // Allow React to hydrate and render
  });

  test("should show amount input empty by default", async ({ page }) => {
    // Find the primary "Add Transaction" button (header area, first one)
    const addButton = page
      .getByRole("button", { name: /add transaction/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Wait for the modal to appear
    const amountInput = page.locator("input#amount");
    await expect(amountInput).toBeVisible({ timeout: 5000 });

    // Verify the amount input is empty (placeholder visible)
    await expect(amountInput).toHaveValue("");
  });

  test("should default category to Other", async ({ page }) => {
    const addButton = page
      .getByRole("button", { name: /add transaction/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Wait for modal
    const categorySelect = page.locator("select#category");
    await expect(categorySelect).toBeVisible({ timeout: 5000 });

    // Verify default value is Other
    await expect(categorySelect).toHaveValue("Other");
  });

  test("should show error toast when submitting with amount 0", async ({
    page,
  }) => {
    const addButton = page
      .getByRole("button", { name: /add transaction/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Wait for modal
    const amountInput = page.locator("input#amount");
    await expect(amountInput).toBeVisible({ timeout: 5000 });

    // Fill with zero (passes HTML5 validation since input is type="number" min="0")
    await amountInput.fill("0");
    await expect(amountInput).toHaveValue("0");

    // Submit the form — HTML5 validation passes (0 is valid), React catches absAmount === 0
    await page.locator("form").evaluate((form) => form.requestSubmit());

    // The error toast should appear
    const toast = page.getByText("Amount cannot be 0").first();
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  // Phase 5 (T5.6): assert that selecting a recurrence on the income
  // path persists across the form-to-submit roundtrip. The recurrence
  // field only renders when transactionType==='income', so this test
  // also exercises the type-toggle's effect on the form surface.
  test("should select recurrence on income row and persist it through submit", async ({
    page,
  }) => {
    // Intercept POST /transactions so we can capture the body the form
    // assembled at submit time. The intercepted response stands in for
    // a real backend create; the goal here is to verify the form's
    // serialization includes the chosen recurrence.
    let postedBody: unknown = null;
    await page.route("**/api/transactions", async (route) => {
      if (route.request().method() === "POST") {
        try {
          postedBody = JSON.parse(route.request().postData() ?? "{}");
        } catch {
          postedBody = route.request().postData();
        }
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ message: "Transaction created successfully" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
    });

    const addButton = page
      .getByRole("button", { name: /add transaction/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Toggle to income so the recurrence picker is rendered. Locale-agnostic
    // via data-testid (Phase 5 fix: the previous `/^income$/i` regex match
    // failed when i18n resolved to Spanish "Ingreso").
    const incomeToggle = page.getByTestId("type-income");
    await incomeToggle.click();

    // Recurrence picker should now be visible; default value is 'One-time'.
    const recurrenceSelect = page.locator("select#recurrence");
    await expect(recurrenceSelect).toBeVisible({ timeout: 5000 });
    await expect(recurrenceSelect).toHaveValue("One-time");

    // Select 'Monthly' and verify the value persists in the DOM (no
    // submit needed — the form component never re-renders this select).
    await recurrenceSelect.selectOption("Monthly");
    await expect(recurrenceSelect).toHaveValue("Monthly");

    // Fill the rest of the form so HTML5 validation passes.
    await page.locator("input#description").fill("Recurring paycheck");
    await page.locator("input#amount").fill("1500");
    await page.locator("select#category").selectOption("Salary");

    await page.locator("form").evaluate((form) => form.requestSubmit());

    // Verify the request body carried recurrence: 'Monthly' (positive
    // path of the form->submit roundtrip).
    await page.waitForTimeout(500);
    expect(postedBody).toMatchObject({
      amount: 1500,
      category: "Salary",
      recurrence: "Monthly",
    });
  });

  // Regression: transaction form should accept both `10.5` (dot) and
  // `23,15` (comma) decimal inputs. Before this fix, two bugs combined
  // to block floats:
  //   1. `currencyService.parseAmountInput` collapsed the only dot and
  //      returned `105` for "10.5" (`safe = "10" + "5"`).
  //   2. The amount input was controlled by a parsed number, so the
  //      React state update wiped the literal `.` or `,` keystroke on
  //      every render, making decimal entry feel broken keystroke by
  //      keystroke.
  // The fix introduces a raw `amountInput` string buffer that mirrors
  // exactly what the user typed, with a single parse happening at
  // submit time.
  test("should accept dot and comma decimal separators in the amount input", async ({
    page,
  }) => {
    // Capture every POST /transactions body so we can assert both
    // decimal-flavored submissions serialized correctly.
    const submittedBodies: Array<Record<string, unknown>> = [];
    await page.route("**/api/transactions", async (route) => {
      if (route.request().method() === "POST") {
        try {
          submittedBodies.push(
            JSON.parse(route.request().postData() ?? "{}"),
          );
        } catch {
          submittedBodies.push({
            raw: route.request().postData(),
          });
        }
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ message: "Transaction created successfully" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
    });

    // ---------- Sub-case 1: dot decimal "10.5" ----------
    const addButton = page
      .getByRole("button", { name: /add transaction/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    const amountInput = page.locator("input#amount");
    await expect(amountInput).toBeVisible({ timeout: 5000 });

    // The input is now controlled by an exact-string buffer so what
    // we type must show up verbatim in the DOM.
    await amountInput.fill("10.5");
    await expect(amountInput).toHaveValue("10.5");

    await page.locator("input#description").fill("Dot decimal coffee");
    await page.locator("select#category").selectOption("Food");

    await page.locator("form").evaluate((form) => form.requestSubmit());
    await page.waitForTimeout(500);

    // ---------- Sub-case 2: comma decimal "23,15" ----------
    await page
      .getByRole("button", { name: /add transaction/i })
      .first()
      .click();
    const amountInput2 = page.locator("input#amount");
    await expect(amountInput2).toBeVisible({ timeout: 5000 });

    await amountInput2.fill("23,15");
    // Comma is preserved character-for-character in the displayed
    // buffer until submit.
    await expect(amountInput2).toHaveValue("23,15");

    await page.locator("input#description").fill("Comma decimal lunch");
    await page.locator("select#category").selectOption("Food");

    await page.locator("form").evaluate((form) => form.requestSubmit());
    await page.waitForTimeout(500);

    // Both decimal inputs must serialize to their parsed numeric value.
    expect(submittedBodies.length).toBe(2);
    expect(submittedBodies[0]).toMatchObject({
      amount: 10.5,
      description: "Dot decimal coffee",
    });
    expect(submittedBodies[1]).toMatchObject({
      amount: 23.15,
      description: "Comma decimal lunch",
    });
  });

  // Edit-form regression: transaction-form.tsx (used by EditTransaction)
  // shares the same `amountInput` raw-string-buffer pattern as the add
  // form. Open the edit modal against a pre-existing transaction row
  // and verify that pressing keystrokes (one at a time) for a comma
  // decimal still produces the right parsed amount at submit.
  test("should accept comma decimal in edit form keystroke-by-keystroke", async ({
    page,
  }) => {
    // Capture the PUT body via the request event so we don't read
    // parseAmount mirrors (this is on the network wire, not React state).
    const updatedBodyPromise = new Promise<unknown>((resolve) => {
      page.on("request", (req) => {
        if (
          req.method() === "PUT" &&
          /\/api\/transactions\/\d+/.test(req.url())
        ) {
          try {
            resolve(JSON.parse(req.postData() ?? "{}"));
          } catch {
            resolve(req.postData());
          }
        }
      });
    });

    // Seed a transaction so the edit modal mounts with a recognizable row.
    await page.route("**/api/transactions**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            transactions: [
              {
                id: 1,
                date: new Date().toISOString(),
                description: "Pre-existing",
                category: "Food",
                amount: 100,
                currency: "USD",
                recurrence: null,
              },
            ],
            meta: { total: 1, offset: "0", limit: "50", nextOffset: null },
          }),
        });
        return;
      }
      if (method === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Updated" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    const listPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/transactions") &&
        resp.request().method() === "GET",
      { timeout: 15000 },
    );

    await page.goto("/app/dashboard/transactions", {
      waitUntil: "domcontentloaded",
    });
    await listPromise;

    const editButton = page.getByRole("button", { name: /edit/i }).first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // Wait for the edit modal + amount input. On mount, useEffect seeds
    // amountInput with the original amount as a string.
    const amountInput = page.locator("input#amount");
    await expect(amountInput).toBeVisible({ timeout: 5000 });

    // Type comma decimal keystroke-by-keystroke (the strongest form of
    // regression coverage — `fill()` skips this path).
    await amountInput.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("23,15", { delay: 50 });

    // The keyed-in comma must still be visible in the DOM buffer.
    await expect(amountInput).toHaveValue("23,15");

    await page.locator("input#description").fill("Comma decimal edit");
    await page.locator("select#category").selectOption("Food");

    await page.locator("form").evaluate((form) => form.requestSubmit());

    const updatedBody = await updatedBodyPromise;
    expect(updatedBody).toMatchObject({ amount: 23.15 });
  });
});
