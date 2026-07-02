import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, FileBarChart2, Settings } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

const NAV_ITEMS = [
  { to: ROUTES.HOME,     icon: LayoutDashboard, label: 'Home' },
  { to: ROUTES.MAP,      icon: Map,             label: 'Map' },
  { to: ROUTES.LEDGER,   icon: FileBarChart2,   label: 'Stocks' },
  { to: ROUTES.SETTINGS, icon: Settings,        label: 'Settings' },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      <ul className="flex h-16" role="list">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === ROUTES.HOME}
              className={({ isActive }) => cn(
                'flex flex-col items-center justify-center h-full gap-1 transition-colors duration-150',
                isActive ? 'text-[#2E6B8A]' : 'text-gray-400',
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} aria-hidden="true" strokeWidth={isActive ? 2.5 : 1.5} />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
