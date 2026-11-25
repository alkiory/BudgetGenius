# BudgetGenius design system

The marketing landing is an Astro site in `apps/landing`. The SPA in
`apps/webClient` is the product; the landing is the place where the brand is
introduced. Keep the two visually related but do not copy app chrome into the
landing.

## Visual world

- **Mode:** Persuade (landing), Read (changelog), Operate (app).
- **World:** dark-first deep navy (`#04070f`) with a drifting teal / violet /
  cyan aurora. The moving background is a product requirement, not decoration
  to be removed by a generic “reduce gradients” pass.
- **Light theme:** opt-in through `[data-theme="light"]`, not a separate
  stylesheet. Both themes must pass contrast checks.
- **Accent:** teal `#2dd4bf` on dark; `#0d9488` on light. Text on accent uses
  `--accent-ink`.
- **Borders:** translucent slate at rest, teal-tinted on emphasis. Depth uses
  offset shadows, never a zero-offset glow or a hard block shadow.

## Typography

| Role | Family | Use |
| --- | --- | --- |
| Display | **Playfair Display** 700/900 + 700 italic | Hero, section headings, page titles |
| Body / UI | **Manrope** 400–800 | Body copy, labels, buttons, nav, changelog entries |

- Load both from the single Google Fonts request in
  `apps/landing/src/layouts/Base.astro`.
- Never use `ui-sans-serif`, `system-ui`, Inter or Arial as the primary body
  face; they are fallbacks only.
- Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.
- Display tracking stays at or above `-0.04em`. Body copy measures 58–65ch in
  the changelog and no wider than 75ch elsewhere.
- Do not use gradient text. Emphasis is size, weight, or the solid accent.
- Do not add a kicker/eyebrow above a heading. The heading carries itself; the
  hero and section badges were removed for this reason.

## Layout tokens

- Container: `min(1120px, 100% - 2.5rem)`.
- Header: 68px, sticky, translucent with `backdrop-filter`.
- Section rhythm: `clamp(3.5rem, 7vw, 6rem)`.
- Radius: cards `18px`; controls `10–12px`; pills `999px`.
- Spacing: tight groups, generous separation; more space above a heading than
  below it.
- Touch targets: controls are at least 38×38px; primary buttons are 48px tall.

## Components and interaction

- **Theme:** one button, one click. Toggle `data-theme`, persist `theme` in
  `localStorage`, swap the sun/moon icon and update `aria-label`. There is no
  theme dropdown or menu.
- **Language:** EN/ES anchors use `alternateLangHref()` in
  `apps/landing/src/i18n.ts`, preserving the current route (`/changelog` ↔
  `/es/changelog/`). Mark the current language with `aria-current="page"`.
- **Cards:** one level only. Chat bubbles inside the Finny card are transcript
  content, not nested cards.
- **Icons:** use [`@animateicons/vanilla/lucide`](https://animateicons.in/icons/lucide)
  and the `<animate-icons>` custom element (`name`, `size`). Icons are
  registered once in `apps/landing/src/layouts/Base.astro`; do not add
  hand-drawn SVG paths. Place the icon beside the heading, not inside a tile
  above it.
- **Navigation:** the landing nav includes Features, How it works, Trust &
  Security, FAQ, Changelog and Get the app. The changelog link is localized
  (`/changelog/` or `/es/changelog/`). Below 1180px the nav collapses into the
  menu button; below 720px the header CTA is also hidden.
- **Reveals:** `data-reveal` + `IntersectionObserver`; respect
  `prefers-reduced-motion`; content is readable with JavaScript disabled.
  AnimateIcons also respects reduced motion automatically.

## Changelog

- Lives at `/changelog/` and `/es/changelog/` as Astro pages under the landing
  `Base` layout (aurora, header, footer).
- Release data is the single source of truth in
  `apps/webClient/src/presentation/data/changelog.ts`; add entries there, not
  in page markup or i18n JSON.
- The SPA does not own a changelog route. Its header, version badge and tour
  link to `landingHref("/changelog")`, which is `http://localhost:4321/changelog`
  in dev and the static page in production.
- The page stamps `changelogLastSeenVersion` so the app's unseen dot clears on
  the next visit.

## Quality gates

Before calling a UI change done:

1. Build the landing (`pnpm --filter landing build`).
2. Typecheck the SPA when its files changed
   (`pnpm --filter frontend-web exec tsc --noEmit`).
3. Check the rendered result at desktop and mobile widths; do not rely on the
   stylesheet alone.
4. Run Impeccable's detector on the changed routes when the assistant has it
   available (it is an account skill, not a project dependency):
   `IMPECCABLE_BROWSER=<chromium> npx impeccable detect <url>`.
5. Treat the aurora, teal/navy palette and italic Playfair hero as intentional
   brand decisions. Treat gradient text, eyebrow kickers, theme dropdowns,
   system-font body copy and duplicate step labels as defects.

## Tooling and repository hygiene

- Impeccable is installed for the assistant, not for this repository. Do not
  commit `.claude/`, `.cursor/`, `.agents/`, `.impeccable/`, screenshots or
  `.cloud-attachments/`; `.gitignore` covers them.
- Commit messages contain only the user's text: no `Co-Authored-By`, no
  `Generated with`, and no other attribution.
