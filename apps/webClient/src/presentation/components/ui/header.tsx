import { RootState } from "@adapters/store/rootStore";
import { RoutePaths } from "@presentation/utils/routes";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router";
import { LanguageSwitcher } from "../dashboard/language-switcher";
import { Logo } from "../logo";
import { ThemeToggle } from "../themeToogle";
import { Button } from "./button";

/**
 * Top navigation bar.
 *
 * Responsive behaviour (md = 768px breakpoint per Tailwind defaults):
 *  - Mobile (< md): only the logo + a "Sign up" CTA (logged-out only)
 *    + a hamburger button are visible. Tapping the hamburger toggles a
 *    dropdown panel that lists every secondary nav item — preventing
 *    the whitespace-on-the-right horizontal overflow that occurred
 *    when all desktop items rendered inline at 320-414px.
 *  - Desktop (>= md): all items render inline in a single <nav> row,
 *    identical to the pre-mobile-fix layout.
 *
 * Drawer UX:
 *  - Closes on Escape key.
 *  - Closes on click outside the header element.
 *  - Closes on route change (pathname effect).
 *  - Closes on tapping any link inside the drawer.
 *
 * a11y:
 *  - Hamburger button exposes `aria-expanded` + `aria-controls` and
 *    reads "Open menu" / "Close menu" depending on state.
 *  - Drawer is wrapped in a labelled `<nav aria-label="…">` landmark.
 */
export default function HeaderComponent() {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleBack = () => {
    const currentPath = window.location.pathname;
    const isOnDashboard = currentPath.includes(
      `${RoutePaths.App}/${RoutePaths.Dashboard}`,
    );
    if (isOnDashboard) {
      navigate(`${RoutePaths.App}`);
    } else {
      navigate(`${RoutePaths.App}/${RoutePaths.Dashboard}`);
    }

    if (!user) {
      navigate("/");
    }
  };

  // Close on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Close on outside tap.
  //
  // Uses `pointerdown` instead of `click` because:
  //   1. `pointerdown` fires BEFORE React's click-event-delegation phase,
  //      eliminating the race where the hamburger button's onClick toggle
  //      and a document-level `click` listener can both fire in the same
  //      tap — the documented bug class for "the hamburger button does
  //      nothing on click" reports on this project's mobile layout.
  //   2. `pointerdown` covers mouse, touch, and pen input uniformly, so
  //      one listener handles all input modalities on responsive designs
  //      without separate touchstart / mousedown hooks.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: Event) => {
      const root = headerRef.current;
      const target = e.target as Node | null;
      if (root && target && !root.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  // Close on route change (so navigating from a hamburger tap auto-clears).
  useEffect(() => {
    return () => setMenuOpen(false);
  }, [window.location.pathname]);

  return (
    <header
      ref={headerRef}
      className="relative border-b bg-slate-50 dark:bg-slate-800 pt-[max(env(safe-area-inset-top),0rem)]"
    >
      <div className="container mx-auto flex min-h-16 items-center justify-between gap-3 px-4">
        {/* Logo — always visible, clickable to navigate home/dashboard */}
        <div
          onClick={handleBack}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Logo size="md" variant="default" />
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile-only: keep Sign up CTA visible alongside hamburger
              so primary conversion is not buried in a drawer. */}
          {!user && (
            <Button size="sm" className="md:hidden">
              <Link to="/auth/signup">{t("auth.signUp")}</Link>
            </Button>
          )}

          {/* Hamburger (only < md) */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-700/60 md:hidden"
            aria-label={
              menuOpen
                ? t("landing.hamburger.close")
                : t("landing.hamburger.open")
            }
            aria-expanded={menuOpen}
            aria-controls="mobile-primary-menu"
            // No stopPropagation() here on purpose: a future
            // document-level delegated click-tracker attached in
            // capture phase (e.g. analytics, telemetry) should still
            // observe this tap. Outside-tap detection uses
            // `pointerdown` (which fires before click and is therefore
            // immune to the click-bubble race), so removing
            // stopPropagation costs us nothing and keeps the click
            // event available to any observatory we wire up later.
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          {/* Desktop nav (hidden < md) */}
          <nav className="hidden md:flex md:items-center md:gap-4">
            <ThemeToggle />
            <LanguageSwitcher />
            <Link
              to={RoutePaths.Changelog}
              className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              {t("landing.changelog.footerLink")}
            </Link>
            {user ? (
              <div className="relative ml-3">
                <div>
                  <button
                    type="button"
                    className="flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:bg-slate-950"
                    id="user-menu-button"
                  >
                    <span className="sr-only">
                      {t("dashboard.openUserMenu")}
                    </span>
                    <Link
                      to={RoutePaths.App + "/" + RoutePaths.Profile}
                      className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 dark:bg-purple-900 dark:text-purple-400 font-medium"
                    >
                      {(user?.name?.charAt(0)?.toUpperCase() || "") +
                        (user?.surname?.charAt(0)?.toUpperCase() || "")}
                    </Link>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  className="text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                  {t("auth.logIn")}
                </Link>
                <Button size="sm">
                  <Link to="/auth/signup">{t("auth.signUp")}</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Mobile drawer (only < md, only when open) */}
      {menuOpen && (
        <nav
          id="mobile-primary-menu"
          aria-label={t("landing.hamburger.label")}
          className="md:hidden border-t bg-slate-50 dark:bg-slate-800 shadow-lg"
        >
          <div className="container mx-auto flex flex-col gap-1 px-4 py-3">
            <Link
              to={RoutePaths.Changelog}
              onClick={closeMenu}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-700/60"
            >
              {t("landing.changelog.footerLink")}
            </Link>

            {user ? (
              <Link
                to={RoutePaths.App + "/" + RoutePaths.Profile}
                onClick={closeMenu}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-700/60"
              >
                {t("profile.accountSettings")}
              </Link>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  onClick={closeMenu}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-700/60"
                >
                  {t("auth.logIn")}
                </Link>
                <Link
                  to="/auth/signup"
                  onClick={closeMenu}
                  className="rounded-md px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-900/30"
                >
                  {t("auth.signUp")}
                </Link>
              </>
            )}

            <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200/70 pt-3 dark:border-slate-700/60">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
