import { Bell, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api.client';
import { useDataRefresh } from '@/hooks/useDataRefresh';

function useUnreadCount() {
  const { data } = useQuery({
    queryKey: ['notifications', 'me'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data: { is_read: boolean }[] }>('/notifications/me');
        return res.data.data.filter((n: { is_read: boolean }) => !n.is_read).length;
      } catch {
        return 0;
      }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  return data ?? 0;
}

export function TopBar() {
  const { isRefreshing, handleRefresh } = useDataRefresh();
  const unread = useUnreadCount();

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

      {/* Notification bell (stub — badge always 0 until push is wired) */}
      <button className="relative text-white p-1" aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#E05540] text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

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
