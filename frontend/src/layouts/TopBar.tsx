import { RefreshCw } from 'lucide-react';
import { useDataRefresh } from '@/hooks/useDataRefresh';

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
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <img src="/insee-logo.png" alt="INSEE" className="h-11 w-auto shrink-0" style={{ maxWidth: '80px' }} />
        <div className="w-px h-6 bg-[#1B3550] shrink-0" />
        <p className="text-[#5BA5C2] text-[9px] font-semibold tracking-widest uppercase leading-tight truncate">
          Finished Goods<br />Inventory Hub
        </p>
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
