import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { TopBar } from './TopBar';
import { config } from '@/constants/config';

const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 min — keeps Render free tier awake

export function RootLayout() {
  useEffect(() => {
    const ping = () => fetch(`${config.apiBaseUrl}/health`).catch(() => {});
    ping();
    const id = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar — desktop only */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Top bar — mobile only */}
      <TopBar />

      {/* Main content
          pt uses calc() to cover the TopBar (56px) + iOS safe-area-inset-top.
          On non-iOS or browser mode this resolves to plain pt-14. */}
      <main
        className="lg:ml-60 min-h-screen lg:pt-0 pb-16 lg:pb-0"
        style={{ paddingTop: 'calc(56px + env(safe-area-inset-top))' }}
        id="main-content"
      >
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  );
}
