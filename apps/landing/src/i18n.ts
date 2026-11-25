import en from "../../webClient/src/infrastructure/i18n/locales/en.json";
import es from "../../webClient/src/infrastructure/i18n/locales/es.json";

export type Lang = "en" | "es";

const locales = { en, es } as const;

/**
 * Landing copy comes from the SPA catalogue (`landing.*`) so the marketing
 * site and the app never drift. When the i18n catalogue is extracted into a
 * shared workspace package this import becomes a package specifier.
 */
export const getCopy = (lang: Lang) => locales[lang].landing;

/** Small strings that only exist on the static landing. */
export const ui = {
  en: {
    nav: "Primary navigation",
    theme: "Theme",
    themeToLight: "Switch to light theme",
    themeToDark: "Switch to dark theme",
    light: "Light",
    dark: "Dark",
    menu: "Open menu",
    close: "Close menu",
    language: "Language",
    footerNav: "Footer",
    privacy: "Privacy",
    terms: "Terms",
    support: "Support",
    skip: "Skip to content",
    finnyAlt: "Finny, the BudgetGenius AI financial sidekick",
    screenshots: "BudgetGenius dashboard and mobile app screenshots",
    desktop: "Desktop",
    mobile: "Mobile",
  },
  es: {
    nav: "Navegación principal",
    theme: "Tema",
    themeToLight: "Cambiar al tema claro",
    themeToDark: "Cambiar al tema oscuro",
    light: "Claro",
    dark: "Oscuro",
    menu: "Abrir menú",
    close: "Cerrar menú",
    language: "Idioma",
    footerNav: "Pie de página",
    privacy: "Privacidad",
    terms: "Términos",
    support: "Soporte",
    skip: "Ir al contenido",
    finnyAlt: "Finny, el asistente financiero con IA de BudgetGenius",
    screenshots: "Capturas del panel y de la app móvil de BudgetGenius",
    desktop: "Escritorio",
    mobile: "Móvil",
  },
} as const;

/**
 * Same-origin in production (the SPA is mounted at /app/). In local dev the
 * landing runs on :4321 and the SPA on :5173, so point the CTAs there unless
 * PUBLIC_APP_URL says otherwise.
 */
const appBase =
  import.meta.env.PUBLIC_APP_URL ??
  (import.meta.env.DEV ? "http://localhost:5173" : "");

export const appHref = (path: string) => `${appBase}${path}`;

/**
 * Language counterparts for a landing path. `pathname` is the current
 * Astro pathname; unknown paths (e.g. /404) fall back to the home page so
 * the language switch never sends a visitor to a missing translation.
 */
export function alternateLangHref(pathname: string): {
  en: string;
  es: string;
} {
  const bare =
    pathname.replace(/^\/es(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  const base = bare === "/" || bare === "/changelog" ? bare : "/";
  return {
    en: base,
    es: base === "/" ? "/es/" : `/es${base}/`,
  };
}

export const apkHref =
  import.meta.env.PUBLIC_APK_URL ??
  "https://github.com/alkiory/BudgetGenius/releases/latest";
