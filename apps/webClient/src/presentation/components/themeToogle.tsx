import { useTheme } from "@adapters/hooks/themeContext";
import { Moon, Sun } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative text-primary dark:text-neutral" ref={menuRef}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 w-9 cursor-pointer rounded-md p-0 inline-flex items-center justify-center text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-400"
        aria-label="Toggle theme"
      >
        {theme === "light" ? (
          <Sun className="absolute h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        ) : (
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-md focus:outline-none dark:bg-slate-800 dark:ring-slate-700">
          <div className="py-1">
            <Button
              onClick={() => {
                toggleTheme();
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 cursor-pointer text-left text-sm hover:bg-slate-500 dark:hover:bg-slate-700 ${theme === "light" ? "bg-slate-700 dark:bg-slate-700" : ""
                }`}
            >
              {t("theme.light")}
            </Button>
            <Button
              onClick={() => {
                toggleTheme();
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 cursor-pointer text-left text-sm hover:bg-slate-500 dark:hover:bg-slate-500 ${theme === "dark" ? "bg-slate-100 dark:bg-slate-700" : ""
                }`}
            >
              {t("theme.dark")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
