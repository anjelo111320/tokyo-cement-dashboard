/**
 * useDataRefresh — Shared hook for the manual CSV sync + React Query invalidation flow.
 *
 * Used by Sidebar (desktop) and TopBar (mobile) so the refresh logic lives in
 * exactly one place. Calling triggerIngestion() tells the backend to re-read
 * all CSV files from disk before the query cache is cleared.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { settingsService } from '@/services/settings.service';

export interface UseDataRefreshResult {
  isRefreshing: boolean;
  handleRefresh: () => Promise<void>;
}

export function useDataRefresh(): UseDataRefreshResult {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await settingsService.triggerIngestion();
    } finally {
      await queryClient.invalidateQueries();
      setIsRefreshing(false);
    }
  }

  return { isRefreshing, handleRefresh };
}
