import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts';
import { ChartCardSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { useLedgerFlow } from '../hooks/useLedger';
import { formatNumber } from '@/utils/formatters';

interface Props { plantId?: string; materialId?: string }

export function InventoryFlowChart({ plantId, materialId }: Props) {
  const { data: flow, isLoading, isError, refetch } = useLedgerFlow(plantId, materialId);

  if (isLoading) return <ChartCardSkeleton />;
  if (isError) return <ErrorState message="Failed to load inventory flow" onRetry={refetch} />;
  if (!flow?.rows.length) return <EmptyState />;

  const chartData = flow.rows.map((r) => ({
    name: r.label,
    value: r.quantity,
    color: r.color,
    code: r.category_code,
    role: r.role,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Inventory Flow</h3>
      <p className="text-xs text-gray-500 mb-4">
        Movement from opening to closing stock ({flow.unit})
        <span className="ml-2 text-[10px] text-primary-600 font-medium">
          — categories auto-update from config
        </span>
      </p>

      {/* Flow card row */}
      <div className="flex flex-wrap gap-2 mb-5">
        {flow.rows.map((row, i) => (
          <div key={row.category_code} className="flex items-center gap-2">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center min-w-[90px]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
                {row.category_code}
              </p>
              <p className="text-base font-bold" style={{ color: row.color }}>
                {row.quantity.toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-500">{row.label}</p>
              {row.total_price_lkr != null && (
                <p className="text-[10px] font-medium text-gray-400 mt-0.5">
                  Price: {formatNumber(row.total_price_lkr, 0)}
                </p>
              )}
            </div>
            {i < flow.rows.length - 1 && (
              <span className="text-gray-300 text-lg font-light">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 20, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} unit=" MT" width={55} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(v: unknown) => [`${(v as number).toFixed(3)} MT`]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="value"
              position="top"
              style={{ fontSize: 10, fill: '#374151', fontWeight: 600 }}
              formatter={(v: unknown) => (v as number) > 0 ? (v as number).toFixed(1) : ''}
            />
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
