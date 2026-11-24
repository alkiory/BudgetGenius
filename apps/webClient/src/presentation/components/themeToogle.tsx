import { useTheme } from "@adapters/hooks/themeContext";
import { Moon, Sun } from "lucide-react";
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
    <div className="relative text-primary dark:text-neutral">
      <Button
        variant="ghost"
        onClick={toggleTheme}
        className="h-9 w-9 cursor-pointer rounded-md p-0 inline-flex items-center justify-center text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-400"
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
