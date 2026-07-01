import { RefreshCw } from 'lucide-react';
import { useDataRefresh } from '@/hooks/useDataRefresh';


/** Mobile-only top bar with the INSEE logo and a manual CSV sync button. */
export function TopBar() {
  const { isRefreshing, handleRefresh } = useDataRefresh();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 bg-[#0D1F2D] flex items-end px-4 gap-3 lg:hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: '8px',
        minHeight: 'calc(60px + env(safe-area-inset-top))',
      }}
    >
      <div className="flex items-center gap-4 flex-1">
        <img src="/insee-logo.png" alt="INSEE" className="h-11 w-auto" />
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
