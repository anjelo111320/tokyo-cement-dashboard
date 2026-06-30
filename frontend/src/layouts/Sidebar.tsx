import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, BookOpen, Factory, RefreshCw } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useSidebar } from '@/contexts/SidebarContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';
import { useDataRefresh } from '@/hooks/useDataRefresh';

const NAV_ITEMS = [
  { to: ROUTES.HOME,   icon: LayoutDashboard, label: 'Dashboard' },
  { to: ROUTES.MAP,    icon: Map,             label: 'Plant Map' },
  { to: ROUTES.LEDGER, icon: BookOpen,        label: 'Material Ledger' },
];

export function Sidebar() {
  const { isOpen, close } = useSidebar();
  const isMobile = useIsMobile();
  const { isRefreshing, handleRefresh } = useDataRefresh();

  if (isMobile && !isOpen) return null;

  return (
    <>
      {isMobile && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={close} aria-hidden="true" />
      )}
      <aside
        className="fixed top-0 left-0 h-screen w-60 z-50 flex flex-col bg-[#0D1F2D] transition-transform duration-250 ease-in-out"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-[#1B3550]">
          <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
            <Factory size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Tokyo Cement</p>
            <p className="text-[#5BA5C2] text-[10px] leading-tight">Analytics Platform</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-widest text-[#3D8BAD] px-3 mb-3 font-semibold">Main Menu</p>
          <ul className="space-y-1" role="list">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === ROUTES.HOME}
                  onClick={isMobile ? close : undefined}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium',
                    isActive
                      ? 'bg-[#1D4E6B] text-white border-l-[3px] border-[#2E6B8A] pl-2.25'
                      : 'text-[#89BDD3] hover:bg-[#1B3550] hover:text-white',
                  )}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer — sync status and manual refresh trigger */}
        <div className="px-4 py-4 border-t border-[#1B3550] flex items-center justify-between">
          <p className="text-[10px] text-[#3D8BAD]">CSV sync every 15 min</p>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-[#3D8BAD] hover:text-white transition-colors disabled:opacity-50"
            aria-label="Sync data now"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </aside>
    </>
  );
}
