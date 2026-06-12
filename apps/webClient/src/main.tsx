import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import { Provider } from 'react-redux'
import { ThemeProvider } from '@adapters/hooks/themeContext'
import { store } from '@adapters/store/rootStore'
import './infrastructure/i18n/i18n';
import { app, analytics } from '@infrastructure/firebaseConfig'

const queryClient = new QueryClient()

// Opcional: Para verificar que Firebase se inicializó correctamente
console.debug("Firebase App initialized:", app);
if (analytics) {
  console.debug("Firebase Analytics initialized.");
}

createRoot(document.getElementById('root')!).render(
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
)
