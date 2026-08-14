import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class YouTubeErrorBoundary extends (Component as any)<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('YouTubeErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center space-y-4 my-2">
          <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-800/80 flex items-center justify-center text-red-400 mx-auto">
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">⚠️ Error en el módulo de YouTube</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              El reproductor de YouTube ha experimentado un problema inesperado. La aplicación principal, el gestor de tickets y la red WebSocket siguen funcionando con total normalidad.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            type="button"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            <RotateCcw size={14} />
            <span>Reinstanciar módulo de YouTube</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
