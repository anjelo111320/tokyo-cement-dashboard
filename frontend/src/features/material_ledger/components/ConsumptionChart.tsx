import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartCardSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useLedgerConsumption } from '../hooks/useLedger';
import { formatNumber } from '@/utils/formatters';
import { CHART_COLORS } from '@/constants/theme';

interface Props { plantId?: string; materialId?: string }

export function ConsumptionChart({ plantId, materialId }: Props) {
  const { data: consumption, isLoading, isError, refetch } = useLedgerConsumption(plantId, materialId);

  if (isLoading) return <ChartCardSkeleton />;
  if (isError) return <ErrorState message="Failed to load consumption data" onRetry={refetch} />;
  if (!consumption?.categories.length) return <EmptyState title="No consumption data" />;

  const chartData = consumption.categories.map((c, i) => ({
    name: c.label,
    value: c.quantity,
    pct: c.pct,
    color: CHART_COLORS.series[i % CHART_COLORS.series.length],
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Consumption Breakdown</h3>
      <p className="text-xs text-gray-500 mb-4">
        Total consumed: <span className="font-semibold text-primary-700">
          {formatNumber(consumption.total_consumption_mt, 2)} {consumption.unit}
        </span>
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(v: unknown) => [`${(v as number).toFixed(2)} MT`]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value, entry) => `${value} (${(entry.payload as { pct: number }).pct}%)`}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Detail list */}
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
        {consumption.categories.map((cat, i) => (
          <div key={cat.proc_cat} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: CHART_COLORS.series[i % CHART_COLORS.series.length] }} />
              <span className="text-xs text-gray-700">{cat.label}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-gray-900">{cat.quantity.toFixed(2)} MT</span>
              <span className="text-[10px] text-gray-400 ml-1">({cat.pct}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
