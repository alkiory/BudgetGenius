// ────────────────────────────────────────────────────────────────────
//  HOW TO ADD A NEW CHANGELOG ENTRY (read this first)
//
//  1. Copy the entry at the BOTTOM of this array (the "Where we started"
//     one is the neutral template — copy that one for fresh-from-scratch
//     entries).
//  2. Set `version` to the new minor (e.g. "1.7").
//  3. Set `date` to today's ISO date (YYYY-MM-DD).
//  4. Write `title` and `description` in BOTH English and Spanish.
//     description MUST be user-language: "what you can now do", never
//     implementation jargon. No "GitHub", no "API", no "parity", no
//     "locale" — describe the benefit.
//  5. PUT YOUR NEW ENTRY AT THE TOP of the array — newest first.
//  6. Set `highlight: true` ONLY on the most recent material change.
//     On the next release, move the flag to the new top entry and
//     remove it from the previous one — only one highlighted at a time.
//
//  Save the file. The /changelog page updates automatically — no JSX
//  edits, no i18n JSON edits, no extra wiring.
// ────────────────────────────────────────────────────────────────────

/**
 * A string pre-translated for both supported languages. The
 * `/changelog` page picks the right field at render time using the
 * `i18n.language` value (`en` or anything starting with `es`).
 */
export type LocalizedString = {
  en: string;
  es: string;
};

/**
 * One release entry. The page renders a vertical timeline ordered by
 * array index (newest first). Date is ISO so the page can format it
 * through `Intl.DateTimeFormat(i18n.language, …)` for locale-accurate
 * display — never pre-format the date string in this file, otherwise
 * Spanish users would see English month abbreviations.
 */
export interface ChangelogEntry {
  /** Semantic version — displayed as `v{version}` in the timeline pill. Use major.minor only. */
  version: string;
  /** ISO date YYYY-MM-DD. Drives the `<time dateTime>` attribute for SEO + a11y. */
  date: string;
  /** Short, plain-language title. ≤ 60 chars if you can. */
  title: LocalizedString;
  /** One short paragraph describing the BENEFIT, not the implementation. Jargon-free. */
  description: LocalizedString;
  /** Optional — render a small "new" pill next to the version badge. Remove on the next release. */
  highlight?: boolean;
}

/**
 * Source of truth for the public `/changelog` timeline. Newest first.
 * Adding an entry is a single-block edit at the top of this array —
 * see the comment block above.
 */
export const changelog: ChangelogEntry[] = [
  {
    version: "1.7",
    date: "2026-07-01",
    highlight: true,
    title: {
      en: "Set up your experience from day one",
      es: "Configura tu experiencia desde el primer momento",
    },
    description: {
      en: "When you create your account, BudgetGenius now asks for your timezone, your preferred currency, and your language — so everything is ready for you from your first session, without having to dig through settings later.",
      es: "Al crear tu cuenta, BudgetGenius ahora te pregunta tu zona horaria, tu moneda preferida y el idioma — así todo está listo para ti desde tu primera sesión, sin tener que buscar ajustes después.",
    },
  },
  {
    version: "1.7",
    date: "2026-07-01",
    title: {
      en: "More reliable account deletion",
      es: "Eliminación de cuenta más confiable",
    },
    description: {
      en: "The delete-account confirmation button now responds the moment you type the confirmation phrase — capitalization or stray spaces no longer block it.",
      es: "El botón de confirmación para eliminar tu cuenta ahora responde en cuanto escribes la frase de confirmación — mayúsculas iniciales o espacios extra ya no lo bloquean.",
    },
  },
  {
    version: "1.6",
    date: "2026-06-30",
    title: {
      en: "Android app is now available",
      es: "La app para Android ya está disponible",
    },
    description: {
      en: "You can now install BudgetGenius on your Android phone. Get the same BudgetGenius you use on the web, optimized for your phone. The iOS version is on the way.",
      es: "Ahora puedes instalar BudgetGenius en tu teléfono Android. Disfruta de la misma experiencia que ya conoces en la web, ahora optimizada para tu móvil. La versión para iOS viene en camino.",
    },
  },
  {
    version: "1.4",
    date: "2026-06-27",
    title: {
      en: "Easier way to type amounts",
      es: "Maneras más fáciles de escribir montos",
    },
    description: {
      en: "Type your amounts however you naturally write them. Whether you use a comma or a period for decimals, BudgetGenius understands your format and saves the correct value.",
      es: "Escribe tus montos como los escribes normalmente, ya uses coma o punto como separador decimal. BudgetGenius entiende tu formato y guarda el valor correcto.",
    },
  },
  {
    version: "1.4",
    date: "2026-06-27",
    title: {
      en: "Mix currencies in the same budget",
      es: "Combina monedas en un mismo presupuesto",
    },
    description: {
      en: "Use different currencies in different categories — dollars, euros, pesos, whatever works for each — and your total reflects your actual money, not a confusing sum of mixed numbers.",
      es: "Usa distintas monedas en tus categorías — dólares, euros, pesos, lo que tenga sentido para cada una — y el total refleja tu dinero real, sin confusiones al sumar cantidades en monedas diferentes.",
    },
  },
  {
    version: "1.3",
    date: "2026-06-26",
    title: {
      en: "Stay signed in on your phone",
      es: "Mantente conectado en tu teléfono",
    },
    description: {
      en: "Sign in once and you're set. Your session stays active when you reopen the app, even if you've been offline for a few minutes.",
      es: "Inicia sesión una vez y listo. Tu sesión sigue activa cuando vuelves a abrir la app, incluso si estuviste sin conexión por unos minutos.",
    },
  },
  {
    version: "1.2",
    date: "2026-06-26",
    title: {
      en: "Sign in with Google in one tap",
      es: "Entra con Google en un toque",
    },
    description: {
      en: "Sign in with your Google account directly from the app — quick, in just a couple of taps, with no extra steps.",
      es: "Entra con tu cuenta de Google directamente desde la app — rápido, en un par de toques, sin pasos extra.",
    },
  },
  {
    version: "1.0",
    date: "2026-06-25",
    title: {
      en: "Where we started",
      es: "Donde empezamos",
    },
    description: {
      en: "Track income, plan budgets, hit your goals, and chat with Finny — all in one place, 100% free, no card required.",
      es: "Registra ingresos, planifica presupuestos, alcanza tus metas y conversa con Finny — todo en un mismo lugar, 100% gratis, sin tarjeta.",
    },
  },
];
