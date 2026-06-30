import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Database, RefreshCw, Moon, Sun, CheckCircle2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { settingsService } from '@/services/settings.service';
import { queryKeys } from '@/constants/queryKeys';
import { useTheme } from '@/contexts/ThemeContext';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { cn } from '@/utils/cn';

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <span className="text-primary-600">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [triggerStatus, setTriggerStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: csvConfig, isLoading } = useQuery({
    queryKey: queryKeys.settings.csvConfig(),
    queryFn: () => settingsService.getCsvConfig(),
    staleTime: 60_000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => settingsService.triggerIngestion(),
    onSuccess: () => {
      setTriggerStatus('success');
      queryClient.invalidateQueries({ queryKey: queryKeys.systemStatus() });
      setTimeout(() => setTriggerStatus('idle'), 3000);
    },
    onError: () => {
      setTriggerStatus('error');
      setTimeout(() => setTriggerStatus('idle'), 3000);
    },
  });

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" subtitle="Configure data sources, appearance, and preferences" />

      <div className="space-y-4">
        {/* CSV Configuration */}
        <SectionCard title="CSV Data Sources" icon={<Database size={16} />}>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : csvConfig ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Base Path</label>
                <p className="mt-1 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800">
                  {csvConfig.csv_base_path}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Refresh Interval</label>
                <p className="mt-1 text-sm text-gray-800">
                  Every {csvConfig.refresh_interval_seconds / 60} minutes
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">CSV Files</label>
                <div className="space-y-2">
                  {Object.entries(csvConfig.files).map(([name, file]) => (
                    <div key={name} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {file.enabled
                          ? <CheckCircle2 size={14} className="text-green-500" />
                          : <AlertCircle size={14} className="text-gray-400" />
                        }
                        <span className="text-sm text-gray-700 font-mono">{file.filename}</span>
                      </div>
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        file.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                      )}>
                        {file.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => triggerMutation.mutate()}
                  disabled={triggerMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-800 hover:bg-primary-900 rounded-lg transition-colors disabled:opacity-60"
                >
                  <RefreshCw size={14} className={triggerMutation.isPending ? 'animate-spin' : ''} aria-hidden="true" />
                  {triggerMutation.isPending ? 'Triggering...' : 'Trigger Manual Import'}
                </button>
                {triggerStatus === 'success' && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Import job queued successfully
                  </p>
                )}
                {triggerStatus === 'error' && (
                  <p className="text-xs text-red-600 mt-2">Failed to trigger import. Check backend.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No configuration loaded. Check backend connection.</p>
          )}
        </SectionCard>

        {/* Appearance */}
        <SectionCard title="Appearance" icon={<Settings size={16} />}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Theme</p>
              <p className="text-xs text-gray-500 mt-0.5">Switch between light and dark mode</p>
            </div>
            <button
              onClick={toggleTheme}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                theme === 'dark'
                  ? 'bg-primary-900 text-white border border-primary-700'
                  : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200',
              )}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
              {theme === 'dark' ? 'Dark' : 'Light'} Mode
            </button>
          </div>
        </SectionCard>

      </div>
    </div>
  );
}
