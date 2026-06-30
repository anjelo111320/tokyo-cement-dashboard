import { Factory, RefreshCw } from 'lucide-react';
import { useDataRefresh } from '@/hooks/useDataRefresh';

interface TopBarProps {
  title?: string;
}

/** Mobile-only top bar with the Tokyo Cement logo and a manual CSV sync button. */
export function TopBar({ title = 'Tokyo Cement' }: TopBarProps) {
  const { isRefreshing, handleRefresh } = useDataRefresh();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 bg-[#0D1F2D] flex items-end px-4 gap-3 lg:hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: '12px',
        minHeight: 'calc(56px + env(safe-area-inset-top))',
      }}
    >
      <div className="flex items-center gap-2 flex-1">
        <div className="w-6 h-6 bg-accent-500 rounded flex items-center justify-center">
          <Factory size={14} className="text-white" />
        </div>
        <span className="text-white font-semibold text-sm">{title}</span>
      </div>

      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="text-white p-1 disabled:opacity-50"
        aria-label="Sync data"
      >
        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
      </button>
    </header>
  );
}
