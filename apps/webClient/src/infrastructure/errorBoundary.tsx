import ErrorPage from "@presentation/pages/errorPage";
import React, { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // Actualiza el estado para renderizar el fallback UI cuando ocurra un error
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  // Captura información adicional del error y/o lo registra en un servicio de logging
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    // Aquí puedes enviar el error a un servicio de monitoreo (Sentry, LogRocket, etc.)
  }

  // Función para resetear el error (por ejemplo, al hacer clic en "Try again")
  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorPage error={this.state.error} reset={this.resetErrorBoundary} />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
