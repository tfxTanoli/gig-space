import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="min-h-screen bg-[#0E1422] flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-white font-semibold text-lg">Something went wrong</p>
          <p className="text-slate-400 text-sm">An unexpected error occurred. Please try refreshing the page.</p>
          <a
            href="/"
            className="mt-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Go home
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
