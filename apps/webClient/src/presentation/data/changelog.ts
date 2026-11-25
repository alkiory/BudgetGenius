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
    version: "1.11",
    date: "2026-11-25",
    highlight: true,
    title: {
      en: "A livelier interface, down to the details",
      es: "Una interfaz más viva, hasta en los detalles",
    },
    description: {
      en: "Icons across the app and the site now animate when you hover or focus the card, button, or link that holds them, and the new typeface makes every screen easier to read. The creator’s name in the footer also answers your cursor with a small animated coffee cup.",
      es: "Los iconos de la app y de la web ahora se animan al pasar el cursor o enfocar la tarjeta, el botón o el enlace que los contiene, y la nueva tipografía hace que cada pantalla se lea mejor. El nombre del creador en el pie de página también responde a tu cursor con una pequeña taza de café animada.",
    },
  },
  {
    version: "1.10",
    date: "2026-11-24",
    title: {
      en: "Every expense lands in the right budget",
      es: "Cada gasto cae en el presupuesto correcto",
    },
    description: {
      en: "Expenses are linked to a budget category automatically, and when a row can’t be matched you get a short review list to assign it yourself, so totals never drift. Importing the same file twice no longer duplicates anything. The dashboard also wears a calmer new look with clearer loading states.",
      es: "Los gastos se vinculan automáticamente a una categoría del presupuesto y, cuando una fila no se puede asociar, aparece una breve lista de revisión para asignarla tú, así los totales no se desvían. Importar el mismo archivo dos veces ya no duplica nada. El panel también estrena un look más sereno, con estados de carga más claros.",
    },
  },
  {
    version: "1.9",
    date: "2026-11-23",
    title: {
      en: "Your account and data, better protected",
      es: "Tu cuenta y tus datos, mejor protegidos",
    },
    description: {
      en: "On the web, your session no longer keeps tokens in local storage — it relies on secure cookies instead. Account responses only include the fields the app needs, every request passes stricter security rules, and emails are stored in a single normalised form so signing in works regardless of capitalization.",
      es: "En la web, tu sesión ya no guarda tokens en el almacenamiento local — usa cookies seguras. Las respuestas de tu cuenta solo incluyen los campos que la app necesita, cada petición pasa reglas de seguridad más estrictas y los correos se guardan en una única forma normalizada, así que iniciar sesión funciona sin importar las mayúsculas.",
    },
  },
  {
    version: "1.8",
    date: "2026-11-13",
    title: {
      en: "Clearer numbers, simpler forms, and budgets that fit",
      es: "Números más claros, formularios más simples y presupuestos a tu medida",
    },
    description: {
      en: "Everything works in your own currency (€, $ or COP) without external conversions, and dashboard figures always show two decimals. Transaction forms now include a date field and keep your data when you switch types. You can choose between a spending budget and a savings goal, bring in transactions from your finance exports, and read reports for the period you select.",
      es: "Todo funciona en tu propia moneda (€, $ o COP) sin conversiones externas, y las cifras del panel muestran siempre dos decimales. Los formularios de movimientos incluyen fecha y conservan tus datos al cambiar de tipo. Puedes elegir entre un presupuesto de gasto y una meta de ahorro, importar movimientos desde tus archivos financieros y consultar informes del período que selecciones.",
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
