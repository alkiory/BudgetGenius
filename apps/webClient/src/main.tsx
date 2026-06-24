import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App";
import { ThemeProvider } from "@adapters/hooks/themeContext";
import { store } from "@adapters/store/rootStore";
import "./infrastructure/i18n/i18n";
import { app, analytics } from "@infrastructure/firebaseConfig";
// Explicitly import @capacitor/core so Vite keeps it in the bundle even when
// no other module imports it from the main entry. The Capacitor native bridge
// injects `window.Capacitor` before our scripts run, but only if `@capacitor/
// core` is actually present in the bundle. Without this, the platform detection
// fallback in `@infrastructure/platform` kicks in (URL + UA heuristics) which
// works but is less robust than querying `Capacitor.isNativePlatform()`.
import "@capacitor/core";

const queryClient = new QueryClient();

// Opcional: Para verificar que Firebase se inicializó correctamente
console.debug("Firebase App initialized:", app);
if (analytics) {
  console.debug("Firebase Analytics initialized.");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ReactQueryDevtools initialIsOpen={false} />
      <Provider store={store}>
        <BrowserRouter>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </BrowserRouter>
      </Provider>
    </QueryClientProvider>
  </StrictMode>,
);
