import { initializeGoogleAuth } from "@adapters/auth";
import useRestoreSession from "@adapters/hooks/useLoadUser";
import ErrorBoundary from "@infrastructure/errorBoundary";
import { LocaleProvider } from "@infrastructure/i18n/LocaleProvider";
import ToastConfig from "@infrastructure/toast.config";
import { OfflineIndicator } from "@presentation/components/offline-indicator";
import RouteConfig from "@presentation/routes/route-config";
import { useEffect } from "react";

function App() {
  useRestoreSession();
  // Initialize the Google Credential Manager plugin exactly once at
  // startup so the bottom-sheet UI is instant on the first tap of the
  // Google button. `initializeGoogleAuth()` is idempotent at module
  // scope — sequential renders of this hook (including React StrictMode
  // double-mount) share the same memoised promise.
  useEffect(() => {
    initializeGoogleAuth().catch((err) => {
      // Non-fatal: if init fails (e.g. VITE_GOOGLE_WEB_CLIENT_ID
      // missing in this build), the fallback ladder in
      // HybridGoogleLoginStrategy will silently swap to the Web SDK.
      console.warn("Google native plugin initialization failed:", err);
    });
  }, []);
  return (
    <div className="App">
      <OfflineIndicator />
      <ErrorBoundary>
        <LocaleProvider>
          <RouteConfig />
        </LocaleProvider>
      </ErrorBoundary>
      <ToastConfig />
    </div>
  );
}

export default App;
