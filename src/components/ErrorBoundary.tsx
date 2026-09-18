import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
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
    console.error("Uncaught Audenic UI Error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetState = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0A0A0D] p-6 text-white text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--accent,#C8F249)]/15 text-3xl text-[var(--accent,#C8F249)]">
            🎵
          </div>
          <h1 className="text-2xl font-bold text-white">Audenic Error Recovery</h1>
          <p className="mt-2 max-w-md text-sm text-white/60">
            An unexpected error occurred while rendering the player interface.
          </p>
          {this.state.error?.message && (
            <div className="mt-4 max-w-lg overflow-x-auto rounded-xl border border-rose-500/20 bg-rose-950/20 p-3 text-xs font-mono text-rose-300">
              {this.state.error.message}
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="rounded-full bg-[var(--accent,#C8F249)] px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90 active:scale-95 transition"
            >
              Reload Application
            </button>
            <button
              onClick={this.handleResetState}
              className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 active:scale-95 transition"
            >
              Reset Cached Data
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
