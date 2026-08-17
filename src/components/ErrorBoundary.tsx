import React, { Component, ErrorInfo, ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    reportLovableError(error, { 
      boundary: "global_error_boundary",
      componentStack: errorInfo.componentStack 
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-10 w-10" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
            Ops! Algo deu errado
          </h1>
          <p className="mb-8 max-w-md text-muted-foreground">
            Ocorreu um erro inesperado que impediu o carregamento desta parte do sistema. 
            Nossa equipe técnica já foi notificada.
          </p>
          
          {process.env['NODE_ENV'] === 'development' && this.state.error && (
            <div className="mb-8 max-w-2xl overflow-auto rounded-lg bg-muted p-4 text-left font-mono text-xs text-muted-foreground">
              <p className="mb-2 font-bold text-destructive">{this.state.error.toString()}</p>
              <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button 
              onClick={this.handleReset}
              className="bg-primary text-primary-foreground"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
            <Button 
              variant="outline" 
              onClick={this.handleGoHome}
            >
              <Home className="mr-2 h-4 w-4" />
              Ir para o Início
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
