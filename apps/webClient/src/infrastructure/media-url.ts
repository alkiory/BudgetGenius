/**
 * Catalogue images uploaded from the backoffice are stored by the API and
 * saved as `/api/media/<file>`. An `<img src>` resolves that path against the
 * document origin (Firebase Hosting, Vite, Capacitor), not against the API
 * origin, so hosted pages and the editor preview would request a file that
 * only exists on the API. Resolve API-relative media against the configured
 * API origin and leave every other URL untouched.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

export function resolveMediaUrl(value: string): string {
  const src = value.trim();
  if (!src || !src.startsWith("/api/")) return src;
  if (!API_BASE) return src;

  try {
    const fallbackOrigin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost";
    return `${new URL(API_BASE, fallbackOrigin).origin}${src}`;
  } catch {
    return src;
  }
}
