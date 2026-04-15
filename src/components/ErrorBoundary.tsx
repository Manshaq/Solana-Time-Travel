import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in application:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 space-y-4 bg-[var(--background)] text-[var(--foreground)]">
          <AlertCircle className="w-12 h-12 text-red-500 opacity-80" />
          <h2 className="text-2xl font-serif italic text-red-500">Terminal Failure</h2>
          <p className="text-sm font-mono opacity-60 max-w-md text-center">
            An unexpected visual anomaly occurred while parsing the timeline.
          </p>
          <div className="mt-8 pt-4 border-t border-[var(--line)]">
            <Link 
              to="/" 
              onClick={() => this.setState({ hasError: false })}
              className="text-xs uppercase tracking-widest underline hover:text-red-500 transition-colors"
            >
              Restart Simulation
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
