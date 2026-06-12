import useRestoreSession from "@adapters/hooks/useLoadUser";
import ErrorBoundary from "@infrastructure/errorBoundary"
import ToastConfig from "@infrastructure/toast.config"
import RouteConfig from "@presentation/routes/route-config"
import { LocaleProvider } from "@infrastructure/i18n/LocaleProvider"
import { OfflineIndicator } from "@presentation/components/offline-indicator"

function App() {
  useRestoreSession();
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
  )
}

export default App
