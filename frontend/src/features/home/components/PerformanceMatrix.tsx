import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts';
import { ChartCardSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { usePlantComparison } from '@/features/material_ledger/hooks/useLedger';
import { useLedgerMaterials } from '@/features/material_ledger/hooks/useLedger';
import { formatNumber } from '@/utils/formatters';

function shortName(name: string): string {
  return name;
}

function tierColor(utilization: number): string {
  if (utilization >= 80) return '#22C55E';
  if (utilization >= 50) return '#F59E0B';
  return '#E05540';
}

function tierLabel(utilization: number): string {
  if (utilization >= 80) return 'High';
  if (utilization >= 50) return 'Mid';
  return 'Low';
}

interface TooltipPayloadItem {
  payload: {
    name: string;
    utilization: number;
    consumed: number;
    available: number;
    netChange: number;
  };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[180px]">
      <p className="font-bold text-gray-900 mb-2">{d.name}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Available stock</span>
          <span className="font-semibold">{formatNumber(d.available, 3)} MT</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Consumed</span>
          <span className="font-semibold">{formatNumber(d.consumed, 3)} MT</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Utilization</span>
          <span className="font-bold" style={{ color: tierColor(d.utilization) }}>
            {formatNumber(d.utilization, 1)}%
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-100 mt-1">
          <span className="text-gray-500">Net stock change</span>
          <span className={`font-semibold ${d.netChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {d.netChange >= 0 ? '+' : ''}{formatNumber(d.netChange, 3)} MT
          </span>
        </div>
      </div>
    </div>
  );
}

export function PerformanceMatrix() {
  const [materialId, setMaterialId] = useState<string | undefined>();
  const { data: materials } = useLedgerMaterials();
  const { data, isLoading, isError, refetch } = usePlantComparison(materialId);

  const chartData = (data?.plants ?? [])
    .map((p) => {
      const available = p.opening_mt + p.receipts_mt;
      const utilization = available > 0
        ? Math.min(100, (p.consumption_mt / available) * 100)
        : 0;
      return {
        name: shortName(p.plant_name),
        utilization: Math.round(utilization * 10) / 10,
        consumed: p.consumption_mt,
        available,
        netChange: p.closing_mt - p.opening_mt,
      };
    })
    .filter((p) => p.available > 0)               // skip zero-activity plants
    .sort((a, b) => b.utilization - a.utilization); // highest utilization first

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Performance Matrix</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Utilization = Consumption ÷ (Opening + Receipts)
          </p>
        </div>

        <select
          value={materialId ?? ''}
          onChange={(e) => setMaterialId(e.target.value || undefined)}
          className="text-xs bg-gray-100 text-gray-700 border-0 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-primary-600"
          aria-label="Filter by material"
        >
          <option value="">All Materials</option>
          {(materials ?? []).map((m) => (
            <option key={m.material_id} value={m.material_id}>
              {m.material_description}
            </option>
          ))}
        </select>
      </div>

      {/* Zone legend */}
      <div className="flex gap-3 mb-4">
        {[
          { color: '#22C55E', label: 'High ≥ 80%' },
          { color: '#F59E0B', label: 'Mid 50–79%' },
          { color: '#E05540', label: 'Low < 50%' },
        ].map((z) => (
          <div key={z.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: z.color }} />
            <span className="text-[10px] text-gray-500">{z.label}</span>
          </div>
        ))}
      </div>

      {isLoading && <ChartCardSkeleton />}
      {isError && <ErrorState message="Failed to load performance data" onRetry={refetch} />}
      {!isLoading && !isError && chartData.length === 0 && <EmptyState />}

      {!isLoading && !isError && chartData.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 52)}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 4, right: 70, bottom: 4, left: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />

              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 10, fill: '#374151' }}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Zone reference lines */}
              <ReferenceLine x={50} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth={1} />
              <ReferenceLine x={80} stroke="#22C55E" strokeDasharray="4 3" strokeWidth={1} />

              <Bar
                dataKey="utilization"
                name="Utilization"
                radius={[0, 3, 3, 0]}
                label={{
                  position: 'right',
                  fontSize: 10,
                  fontWeight: 600,
                  formatter: (v: number) => `${formatNumber(v, 1)}%  ${tierLabel(v)}`,
                  fill: '#374151',
                }}
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={tierColor(entry.utilization)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Net stock change summary row */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Net Stock Change (Closing − Opening)
            </p>
            <div className="flex flex-wrap gap-2">
              {chartData.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-[10px] text-gray-600 font-medium">{p.name}</span>
                  <span className={`text-[10px] font-bold ${p.netChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {p.netChange >= 0 ? '+' : ''}{formatNumber(p.netChange, 1)} MT
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
