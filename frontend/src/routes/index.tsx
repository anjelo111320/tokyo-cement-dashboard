import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from '@/layouts/RootLayout';
import { ROUTES } from '@/constants/routes';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { RequireAuth } from '@/components/common/RequireAuth';
import { RequireAdmin } from '@/components/common/RequireAdmin';
import { LoginPage } from '@/features/auth/LoginPage';

const HomePage    = lazy(() => import('@/features/home/HomePage').then(m => ({ default: m.HomePage })));
const MapPage     = lazy(() => import('@/features/map/MapPage').then(m => ({ default: m.MapPage })));
const ReportPage  = lazy(() => import('@/features/report/ReportPage').then(m => ({ default: m.ReportPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AdminPage   = lazy(() => import('@/features/admin/AdminPage').then(m => ({ default: m.AdminPage })));

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
    path: ROUTES.LOGIN,
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <RootLayout />
      </RequireAuth>
    ),
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
      {
        path: ROUTES.ADMIN,
        element: (
          <RequireAdmin>
            <Suspense fallback={<PageLoader />}><AdminPage /></Suspense>
          </RequireAdmin>
        ),
      },
    ],
  },
], { basename: import.meta.env.BASE_URL });

export function AppRouter() {
  return <RouterProvider router={router} />;
}
