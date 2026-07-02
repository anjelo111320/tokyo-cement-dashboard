import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from '@/layouts/RootLayout';
import { ROUTES } from '@/constants/routes';
import { Skeleton } from '@/components/common/LoadingSkeleton';

const HomePage   = lazy(() => import('@/features/home/HomePage').then((m) => ({ default: m.HomePage })));
const MapPage    = lazy(() => import('@/features/map/MapPage').then((m) => ({ default: m.MapPage })));
const ReportPage = lazy(() => import('@/features/report/ReportPage').then((m) => ({ default: m.ReportPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Suspense fallback={<PageLoader />}><HomePage /></Suspense>,
      },
      {
        path: ROUTES.MAP,
        element: <Suspense fallback={<PageLoader />}><MapPage /></Suspense>,
      },
      {
        path: ROUTES.LEDGER,
        element: <Suspense fallback={<PageLoader />}><ReportPage /></Suspense>,
      },
      {
        path: ROUTES.SETTINGS,
        element: <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>,
      },
    ],
  },
], { basename: import.meta.env.BASE_URL });

export function AppRouter() {
  return <RouterProvider router={router} />;
}
