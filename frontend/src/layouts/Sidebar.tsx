import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, FileBarChart2, RefreshCw, Settings, ShieldCheck, LogOut } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useSidebar } from '@/contexts/SidebarContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';
import { useDataRefresh } from '@/hooks/useDataRefresh';
import { useAuth } from '@/features/auth/AuthContext';

const NAV_ITEMS = [
  { to: ROUTES.HOME,     icon: LayoutDashboard, label: 'Dashboard' },
  { to: ROUTES.MAP,      icon: Map,             label: 'Plant Map' },
  { to: ROUTES.LEDGER,   icon: FileBarChart2,   label: 'Stock Sheet' },
  { to: ROUTES.SETTINGS, icon: Settings,        label: 'Settings' },
];

export function Sidebar() {
  const { isOpen, close } = useSidebar();
  const isMobile = useIsMobile();
  const { isRefreshing, handleRefresh } = useDataRefresh();
  const { user, isAdmin, logout } = useAuth();

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
        <div className="px-5 py-4 border-b border-[#1B3550]">
          <img src="/insee-logo.png" alt="INSEE" className="h-7 w-auto" />
          <p className="text-[#5BA5C2] text-[9px] mt-2 font-semibold tracking-widest uppercase">Finished Goods Inventory Hub</p>
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

            {/* Admin link — only shown to admin role */}
            {isAdmin && (
              <li>
                <NavLink
                  to={ROUTES.ADMIN}
                  onClick={isMobile ? close : undefined}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium',
                    isActive
                      ? 'bg-[#E05540]/20 text-[#E05540] border-l-[3px] border-[#E05540] pl-2.25'
                      : 'text-[#E05540]/70 hover:bg-[#1B3550] hover:text-[#E05540]',
                  )}
                >
                  <ShieldCheck size={18} aria-hidden="true" />
                  Admin Panel
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#1B3550] space-y-2">
          {/* User info */}
          {user && (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] text-[#89BDD3] truncate">{user.email}</p>
                <p className="text-[9px] text-[#3D8BAD] uppercase tracking-widest">{user.role}</p>
              </div>
              <button onClick={() => logout()} className="text-[#3D8BAD] hover:text-[#E05540] transition-colors ml-2" title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
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
        </div>
      </aside>
    </>
  );
}
