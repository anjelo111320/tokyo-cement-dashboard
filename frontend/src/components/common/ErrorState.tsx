import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Something went wrong', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle size={40} className="text-red-400 mb-3" aria-hidden="true" />
      <p className="text-sm font-medium text-gray-700 mb-1">{message}</p>
      <p className="text-xs text-gray-500 mb-4">Check backend connection or CSV file status</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-700 rounded-lg hover:bg-primary-800 transition-colors"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}
