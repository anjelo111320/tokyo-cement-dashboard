import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(_error: Error, info: ErrorInfo) {
    console.warn('[MapErrorBoundary]', info.componentStack);
  }

  reset() {
    this.setState({ hasError: false, message: '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 gap-4 p-6 text-center">
          <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center">
            <MapPin size={24} className="text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Map failed to load</p>
            <p className="text-xs text-gray-400 max-w-xs">{this.state.message}</p>
          </div>
          <button
            onClick={() => this.reset()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-800 text-white text-sm font-medium rounded-xl hover:bg-primary-900 transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
