import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";

export const SUPPORTED_LOCALES = ["en-US", "es-CO"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Map locale codes to the translation key
const localeToLang: Record<string, string> = {
  "en-US": "en",
  "es-CO": "es",
};

/**
 * Detect the best-matching supported locale from the browser's language.
 * e.g. navigator.language = 'es-ES' → 'es-CO' (Spanish), 'en-GB' → 'en-US' (English)
 */
export function detectBrowserLocale(): SupportedLocale {
  if (typeof navigator === "undefined") return "en-US";
  const browserLang = navigator.language;
  // If browser lang starts with 'es', match to Spanish; everything else defaults to English
  if (browserLang.startsWith("es")) return "es-CO";
  return "en-US";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: localeToLang[detectBrowserLocale()] || "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  returnNull: false,
  returnEmptyString: false,
});

/**
 * Switch the active language based on the user's locale setting.
 * e.g. "en-US" → "en", "es-CO" → "es"
 */
export function switchLanguage(locale: string) {
  const lang = localeToLang[locale] || "en";
  if (i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }
}

export default i18n;
