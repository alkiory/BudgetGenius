/**
 * Public marketing site.
 *
 * In production the SPA lives under `/app/`, so routing to "/" re-enters the
 * app router and bounces a signed-out visitor straight back to `/auth/login`.
 * A full page load to the landing origin actually leaves the app. In dev the
 * Astro site runs on its own port (see VITE_LANDING_URL).
 */
export const LANDING_URL =
  import.meta.env.VITE_LANDING_URL ||
  (import.meta.env.DEV ? "http://localhost:4321" : "/");

export function goToLanding(): void {
  window.location.assign(LANDING_URL);
}