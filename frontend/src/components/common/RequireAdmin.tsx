import { useAuth } from '@/features/auth/AuthContext';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-4xl mb-4">🔒</p>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Admin access required</h2>
        <p className="text-sm text-gray-500">Contact your administrator to request access.</p>
      </div>
    );
  }

  return <>{children}</>;
}
