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
//     The "new" pill is per visitor: /changelog marks every version
//     newer than the one they last saw, and uses `highlight` only as
//     the first-visit announcement.
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
  /**
   * Marks the release announced to first-time visitors. The "new" pill is
   * per visitor: `/changelog` also badges every version newer than the one
   * they last saw. Keep it on the newest entry only.
   */
  highlight?: boolean;
}

/**
 * Source of truth for the public `/changelog` timeline. Newest first.
 * Adding an entry is a single-block edit at the top of this array —
 * see the comment block above.
 */
export const changelog: ChangelogEntry[] = [
  {
    version: "1.9",
    date: "2026-10-22",
    highlight: true,
    title: {
      en: "Budgets for spending and saving",
      es: "Presupuestos para gastar y ahorrar",
    },
    description: {
      en: "You can now choose between a spending budget and a savings goal. Spending limits are filled automatically from your transactions, while savings goals grow as you add money. The budget form is simpler: just pick a category and set its limit or goal.",
      es: "Ahora puedes elegir entre un presupuesto de gasto y una meta de ahorro. Los límites de gasto se completan automáticamente con tus transacciones, mientras que las metas de ahorro crecen a medida que añades dinero. El formulario es más sencillo: solo eliges la categoría y defines su límite u objetivo.",
    },
  },
  {
    version: "1.8",
    date: "2026-10-22",
    title: {
      en: "Better numbers, forms, and a fresh look",
      es: "Mejores números, formularios y un nuevo look",
    },
    description: {
      en: "Everything now works in euros (€) without external conversions. Dashboard numbers always show two decimals, and chart labels no longer overlap. Transaction forms now include a date field, retain your data when switching types, and scroll neatly. Plus, the registration screen has a fresh new look with a full animated background.",
      es: "Todo funciona ahora en euros (€) sin conversiones externas. Los números del panel siempre muestran dos decimales y las etiquetas del gráfico ya no se superponen. Los formularios de transacciones ahora incluyen fecha, mantienen tus datos al cambiar de tipo y se desplazan correctamente. Además, la pantalla de registro tiene un nuevo look con fondo animado a pantalla completa.",
    },
  },
  {
    version: "1.7",
    date: "2026-07-01",
    title: {
      en: "A smoother start and safer account deletion",
      es: "Un comienzo más fluido y una eliminación de cuenta más segura",
    },
    description: {
      en: "When you create your account, BudgetGenius asks for your timezone, your preferred currency, and your language — so everything is ready from your first session. The delete-account confirmation button also responds the moment you type the phrase — capitalization or stray spaces no longer block it.",
      es: "Al crear tu cuenta, BudgetGenius te pregunta tu zona horaria, tu moneda preferida y tu idioma — así todo está listo desde tu primera sesión. Además, el botón de confirmación para eliminar tu cuenta responde en cuanto escribes la frase — mayúsculas iniciales o espacios extra ya no lo bloquean.",
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
      en: "Easier amounts and mixed currencies",
      es: "Montos más fáciles y monedas combinadas",
    },
    description: {
      en: "Type your amounts however you naturally write them — a comma or a period for decimals is understood and saved correctly. You can also use different currencies in different categories, so each one reflects the money you actually spend.",
      es: "Escribe tus montos como los escribes normalmente — la coma o el punto decimal se entienden y se guardan correctamente. También puedes usar distintas monedas en tus categorías, para que cada una refleje el dinero que realmente gastas.",
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
