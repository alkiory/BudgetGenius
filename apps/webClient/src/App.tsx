import { useBackendOAuthReturn } from "@adapters/hooks/useBackendOAuthReturn";
import { useFirebaseRedirectReturn } from "@adapters/hooks/useFirebaseRedirectReturn";
import useRestoreSession from "@adapters/hooks/useLoadUser";
import ErrorBoundary from "@infrastructure/errorBoundary";
import { LocaleProvider } from "@infrastructure/i18n/LocaleProvider";
import ToastConfig from "@infrastructure/toast.config";
import { OfflineIndicator } from "@presentation/components/offline-indicator";
import RouteConfig from "@presentation/routes/route-config";

function App() {
  useRestoreSession();
  useFirebaseRedirectReturn();
  useBackendOAuthReturn();
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
