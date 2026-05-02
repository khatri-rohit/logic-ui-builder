"use client";

import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Canvas error boundary caught an error:", error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    toast.error("Something went wrong with the canvas", {
      description: error.message,
      duration: 5000,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-semibold">Canvas Error</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred. Please try refreshing the canvas."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.handleReset}>
              <RefreshCw className="mr-2 size-4" />
              Try Again
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withCanvasErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<Props>
) {
  return function WrappedComponent(props: P) {
    return (
      <CanvasErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </CanvasErrorBoundary>
    );
  };
}