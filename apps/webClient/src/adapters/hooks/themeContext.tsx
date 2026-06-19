import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<
  { theme: Theme; toggleTheme: () => void } | undefined
>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const storedTheme = localStorage.getItem("theme") as Theme | null;
  const [theme, setTheme] = useState<Theme>(storedTheme || "light");

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  useEffect(() => {
    if (storedTheme) {
      document.querySelector("body")?.setAttribute("data-theme", storedTheme);
    }
  }, [storedTheme]);

  useEffect(() => {
    const root = document.querySelector("body") as HTMLElement;

    // Remover transiciones iniciales
    root.classList.remove("transition-all", "duration-500");

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Añadir transiciones después del cambio inicial
    setTimeout(() => {
      root.classList.add("transition-all", "duration-500");
    }, 10);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
