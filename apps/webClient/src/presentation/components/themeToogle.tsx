import { useTheme } from "@adapters/hooks/themeContext";
import { Moon, Sun } from "@presentation/components/ui/animated-icons";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";

/**
 * Single-action theme switch: pressing the button flips between light and
 * dark immediately. It used to open a two-item dropdown, which added a
 * click and could leave a stray menu open over the page.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="relative text-slate-600 dark:text-slate-300">
      <Button
        variant="ghost"
        onClick={toggleTheme}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg p-0 text-sm font-medium transition-colors hover:bg-teal-500/10 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 dark:hover:bg-white/[0.06] dark:hover:text-teal-300"
        aria-label={
          theme === "light" ? t("theme.switchToDark") : t("theme.switchToLight")
        }
      >
        {theme === "light" ? (
          <Sun className="absolute h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        ) : (
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        )}
      </Button>
    </div>
  );
}
