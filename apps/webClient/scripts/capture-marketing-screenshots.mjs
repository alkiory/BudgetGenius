#!/usr/bin/env node
/**
 * capture-marketing-screenshots.mjs
 *
 * Generates two PNGs used by the new marketing landing sections
 * (`hero.tsx`, `showcase.tsx`, `final-cta.tsx`) without depending on
 * the full backend stack (Postgres + Redis + NestJS API). We boot
 * Playwright headless Chromium, point it at the running Vite dev
 * server on :5173, and intercept the dashboard's HTTP surface with
 * `page.route()` so the live `<OverviewCard />` +
 * `<RecentTransactions />` components paint against a deterministic,
 * "100% free" payload.
 *
 * Outputs (preview, NOT yet swapped into the asset folder):
 *   /tmp/budgetgenius-marketing-shots/dashboard_mobile.png
 *   /tmp/budgetgenius-marketing-shots/presentation_dashboard.png
 *
 * Run from the repo root:
 *   node apps/webClient/scripts/capture-marketing-screenshots.mjs
 *
 * See ./capture-marketing-screenshots.README.md for the synthetic
 * disclosure + swap-to-assets commands.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Configuration ─────────────────────────────────────────────────
// Where the dev server is reachable. The webClient uses 5173 — the
// Playwright config (`apps/webClient/playwright.config.ts`) sets the
// same baseURL — so authors running `pnpm --filter frontend-web dev`
// don't need to remember another port.
const BASE_URL = process.env.BG_CAPTURE_BASE_URL || "http://localhost:5173";

// Targets match the dim the existing landing sections were authored
// against (`dashboard_mobile.png` is consumed at 1280×2856 inside
// `MockupFrame`; `presentation_dashboard.png` at 1793×1234 inside
// the showcase card). The viewport HEIGHT is set to the target dim
// (not 800 + fullPage) so we avoid Playwright's fullPage stitching
// pipeline — which can fail with "unsupported mime type 'null'" when
// combined with `animations: "disabled"` on long documents in WSL.
const TARGETS = {
  mobile: { width: 1280, height: 2856, label: "1280 mobile" },
  desktop: { width: 1793, height: 1234, label: "1793 desktop" },
};

// Capture targets — temp dir until the operator approves the swap.
const OUTPUT_DIR = "/tmp/budgetgenius-marketing-shots";

// ─── Synthetic payloads ────────────────────────────────────────────
// Every value matches what the real components destructure from. If a
// field is missing, the React tree explodes with a TypeError on first
// render — pay close attention to the schema below.

const PROFILE = {
  id: 1,
  name: "Sarah",
  surname: "Chen",
  email: "sarah@example.com",
  password: "redacted", // users/profile dashboard never echoes the hash
  authProvider: "email",
  role: "user",
  refreshToken: null,
  // isPremium is intentionally omitted — the v1.5 migration made
  // every user default to premium=true, AND removed any "upgrade"
  // affordance from the UI. Explicit omission keeps the mock honest:
  // no premium gating shows up because there's nothing to gate.
};

const SETTINGS = {
  id: 1,
  timezone: "America/New_York",
  currency: "USD",
  locale: "en-US",
};

const OVERVIEW = {
  balance: 4823.5,
  income: 5200,
  expenses: 3235.5,
  // ISO timestamp + 1 month buffer so `new Date(period).toLocale...`
  // renders a sensible "long-month-year" form (e.g. "June 15, 2026").
  period: "2026-06-15T00:00:00.000Z",
};

const RECENT_SUMMARY = {
  transactions: [
    {
      id: 1,
      date: "2026-06-28T13:42:00.000Z",
      description: "Whole Foods Market",
      category: "Groceries",
      amount: -84.32,
    },
    {
      id: 2,
      date: "2026-06-28T09:00:00.000Z",
      description: "Payroll deposit — Acme Corp",
      category: "Salary",
      amount: 3200,
    },
    {
      id: 3,
      date: "2026-06-27T18:15:00.000Z",
      description: "Pacific Gas & Electric",
      category: "Utilities",
      amount: -76.41,
    },
    {
      id: 4,
      date: "2026-06-27T07:50:00.000Z",
      description: "Spotify Premium",
      category: "Entertainment",
      amount: -10.99,
    },
    {
      id: 5,
      date: "2026-06-26T12:08:00.000Z",
      description: "Trader Joe's",
      category: "Groceries",
      amount: -52.18,
    },
    {
      id: 6,
      date: "2026-06-25T17:32:00.000Z",
      description: "Uber",
      category: "Transportation",
      amount: -18.4,
    },
    {
      id: 7,
      date: "2026-06-24T20:01:00.000Z",
      description: "Sweetgreen",
      category: "Dining",
      amount: -14.5,
    },
    {
      id: 8,
      date: "2026-06-23T08:24:00.000Z",
      description: "Rent — 221B Baker St",
      category: "Rent",
      amount: -1850,
    },
  ],
};

// ExpenseBreakdown is included in the page render but the marketing
// mock captures stop above the fold — an empty shapes array is enough
// to keep the <ExpenseCategories /> branch from blowing up.
const EXPENSE_BREAKDOWN = {
  byCategory: [],
  total: 0,
  largest: { name: "", value: 0 },
  period: "2026-06",
};

const BUDGETS = [];

// ─── Helpers ───────────────────────────────────────────────────────

function jsonResponse(route, payload) {
  // The webClient axios instance has `withCredentials: true` AND
  // emits a custom `Authorization: Bearer ...` + `X-Device-Id`
  // header on every request, which triggers a CORS preflight.
  // The browser validates that preflight *before* the actual
  // request reaches Playwright's network layer — without
  // Access-Control-Allow-* headers in the fulfill response, the
  // browser blocks the preflight silently and axios throws a
  // Network Error. React Query then retries 3× before settling
  // with `data = undefined`, leaving the dashboard stuck on
  // `<DashboardLoading />` and breaking the capture (no "4,823"
  // ever appears in `body.innerText`).
  //
  // Origin-locked because `withCredentials: true` makes wildcard
  // `Access-Control-Allow-Origin: *` invalid per the CORS spec
  // (w3c/cors#credentialed-requests); use the dev server origin.
  return route.fulfill({
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": BASE_URL,
      "Access-Control-Allow-Methods":
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, X-Device-Id, Accept, Origin",
      "Access-Control-Allow-Credentials": "true",
    },
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload),
  });
}

async function snapshot(browser, target) {
  const ctx = await browser.newContext({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/New_York",
    colorScheme: "light",
    // Storage state is set per-navigation below via `addInitScript`,
    // since we want the same captured screenshot regardless of any
    // auth state left over from prior runs.
  });

  // Inject tokens + X-Device-Id header stub BEFORE any page script
  // runs. The request interceptor in infrastructure/api.config.ts
  // reads `localStorage.accessToken` to attach Authorization. We
  // don't need a real JWT — the mocks below short-circuit the
  // backend's verify path.
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("accessToken", "mock-access-token");
      window.localStorage.setItem("refreshToken", "mock-refresh-token");
      localStorage.setItem("bgDeviceId", "capture-script-device-id");
    } catch {
      // ignore — localStorage unavailable
    }
  });

  // Mocks. Keep route patterns tight so we don't accidentally swallow
  // a Future endpoint that the dev server proxies to.
  await ctx.route("**/api/auth/verify", (route) => jsonResponse(route, {}));
  await ctx.route("**/api/user/profile", (route) => jsonResponse(route, PROFILE));
  await ctx.route("**/api/user-settings", (route) => jsonResponse(route, SETTINGS));
  await ctx.route("**/api/dashboard/overview", (route) =>
    jsonResponse(route, OVERVIEW),
  );
  await ctx.route("**/api/dashboard/recent-summary**", (route) =>
    jsonResponse(route, RECENT_SUMMARY),
  );
  await ctx.route("**/api/dashboard/expense-breakdown", (route) =>
    jsonResponse(route, EXPENSE_BREAKDOWN),
  );
  await ctx.route("**/api/budgets**", (route) => jsonResponse(route, BUDGETS));

  // Capture browser console for diagnostics.
  ctx.on("weberror", (event) => {
    console.warn(`[browser] uncaught error on ${target.label}:`, event.error());
  });

  const page = await ctx.newPage();
  // Aggregate page-level errors and refuse to ship a half-rendered
  // screenshot if any fire — a JS explosion on the dashboard is
  // worse than no mockup at all (the operator will see broken
  // captured PNGs and assume the marketing site is broken).
  let fatalError = null;
  page.on("pageerror", (err) => {
    console.warn(`[pageerror] ${target.label}:`, err.message);
    fatalError = err;
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.warn(`[console.${msg.type()}] ${target.label}: ${msg.text()}`);
    }
  });

  // Hit `/` first so useRestoreSession's initial boot sequence
  // completes before we ask for the protected route. This avoids
  // `ProtectedRoute`'s loading screen taking over the frame.
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  // Wait for the splash-to-landing transition to settle.
  await page.waitForLoadState("networkidle").catch(() => {
    /* networkidle can hang if a mock never resolves — ignore */
  });

  // Navigate to the protected dashboard. useRestoreSession kicks off
  // /auth/verify → /user/profile → setUser/loginAction, both
  // intercepted; ProtectedRoute then flips isAuthenticated=true and
  // the <OverviewCard /> + <RecentTransactions /> render fires.
  await page.goto(`${BASE_URL}/app/dashboard`, { waitUntil: "domcontentloaded" });

  // Locale-stable wait: the bare digit substring "4823" is invariant
  // across every locale's `Intl.NumberFormat` output because the
  // mocked balance source value is `4823.5` — `en-US` ($4,823.50),
  // `es-CO` (US$ 4.823,50), `fr-FR` (4 823,50) and any future
  // locale all encode the digits `4823` as a contiguous run.
  await page
    .waitForFunction(
      () => document.body && document.body.innerText.includes("4823"),
      null,
      { timeout: 12_000 },
    )
    .catch(async (err) => {
      const headings = await page.$$eval("h1, h2, h3", (els) =>
        els.map((e) => e.textContent?.trim()).slice(0, 8),
      );
      throw new Error(
        `Balance digits "4823" never rendered on ${target.label}. ` +
          `Either the mock chain is mis-wired or the overview query never settled. ` +
          `Visible headings: ${JSON.stringify(headings)}. ${err.message}`,
      );
    });

  // Fail fast if the page produced a JS error during the run —
  // shipping a half-rendered screenshot would mislead visitors.
  if (fatalError) {
    await ctx.close();
    throw new Error(
      `Browser pageerror during capture on ${target.label}: ${fatalError.message}. ` +
        `Refusing to write a broken screenshot.`,
    );
  }

  const out = `${join(OUTPUT_DIR, target.id)}.png`;
  // `type: "png"` is required — without it Playwright tries to infer
  // the mime type from the path's file extension and, on first build
  // when the file doesn't exist, falls back to a "null" mime type
  // that throws "Error: path: unsupported mime type 'null'".
  // Pinning the type makes the screenshot pipeline deterministic.
  await page.screenshot({
    path: out,
    type: "png",
    fullPage: false,
  });
  await ctx.close();
  return out;
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  // WSL2 / sandboxed-container compat: chromium's default sandbox
  // requires either user-namespaces or running as root; we run as
  // a normal user inside WSL2 so --no-sandbox + --disable-dev-shm-usage
  // is the lowest-friction path. See playwright #14437/WSL quirks.
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const labelByTarget = {
      mobile: "dashboard_mobile",
      desktop: "presentation_dashboard",
    };
    const manifest = [];
    for (const key of ["mobile", "desktop"]) {
      const target = { ...TARGETS[key], id: labelByTarget[key] };
      const out = await snapshot(browser, target);
      manifest.push({ label: target.id, path: out });
      console.log(`[capture] ${target.label} -> ${out}`);
    }

    console.log("\nManifest:");
    for (const m of manifest) {
      console.log(`  ${m.label}: ${m.path}`);
    }
    console.log(
      "\nInspect each PNG, then swap on approval:\n" +
        "  mv /tmp/budgetgenius-marketing-shots/dashboard_mobile.png \\\n" +
        "     apps/webClient/src/presentation/assets/dashboard_mobile.png\n" +
        "  mv /tmp/budgetgenius-marketing-shots/presentation_dashboard.png \\\n" +
        "     apps/webClient/src/presentation/assets/presentation_dashboard.png\n",
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[capture] fatal:", err);
  process.exitCode = 1;
});
