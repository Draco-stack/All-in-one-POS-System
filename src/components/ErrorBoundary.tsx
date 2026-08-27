import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[POS ErrorBoundary Caught Error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-stone-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-stone-100 mb-2">
              {this.props.fallbackTitle || 'POS Terminal Runtime Warning'}
            </h2>
            <p className="text-stone-400 text-sm mb-6">
              An unexpected interface error was safely isolated to protect active database transactions and register records.
            </p>
            {this.state.error && (
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 mb-6 text-left overflow-auto max-h-32 text-xs font-mono text-red-300">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full py-3 bg-[#00897b] hover:bg-[#00796b] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload POS Terminal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
