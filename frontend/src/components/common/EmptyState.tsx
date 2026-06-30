import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({ title = 'No data available', description = 'Data will appear once CSV files are loaded.' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox size={40} className="text-gray-300 mb-3" aria-hidden="true" />
      <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
      <p className="text-xs text-gray-400">{description}</p>
    </div>
  );
}
