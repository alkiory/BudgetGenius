/**
 * Public marketing site.
 *
 * In production the SPA lives under `/app/`, so routing to "/" re-enters the
 * app router and bounces a signed-out visitor straight back to `/auth/login`.
 * A full page load to the landing origin actually leaves the app. In dev the
 * Astro site runs on its own port (see VITE_LANDING_URL).
 */

/**
 * Normalise the configured landing origin.
 *
 * `VITE_LANDING_URL` is deployment configuration and used to be interpolated
 * into anchors untouched, so a malformed value such as
 * `VITE_LANDING_URL=https://changelog` produced links to `https://changelog`.
 * Only a path (`/`, `/foo`) or an absolute http(s) URL whose host is
 * `localhost` or contains a dot is accepted; anything else falls back to the
 * same origin in production (or the Astro dev server while developing).
 */
export function resolveLandingBase(
  value: string | undefined,
  isDev: boolean,
): string {
  const candidate = value?.trim();

  if (candidate?.startsWith("/")) {
    // `"/"` collapses to the empty string, i.e. same origin.
    return candidate.replace(/\/+$/, "");
  }

  if (candidate) {
    try {
      const url = new URL(candidate);
      const isHttp = url.protocol === "https:" || url.protocol === "http:";
      const isRealHost =
        url.hostname === "localhost" || url.hostname.includes(".");
      if (isHttp && isRealHost) return candidate.replace(/\/+$/, "");
    } catch {
      // Not an absolute URL: fall through to the default.
    }
  }

  return isDev ? "http://localhost:4321" : "";
}

export const LANDING_URL =
  resolveLandingBase(
    import.meta.env?.VITE_LANDING_URL,
    import.meta.env?.DEV ?? false,
  ) || "/";

export function goToLanding(): void {
  window.location.assign(LANDING_URL);
}
