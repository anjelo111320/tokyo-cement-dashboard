import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { ChartCardSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { usePlantComparison } from '@/features/material_ledger/hooks/useLedger';
import { useLedgerMaterials } from '@/features/material_ledger/hooks/useLedger';
import { formatNumber } from '@/utils/formatters';

type Metric = 'opening_vs_closing' | 'receipts' | 'consumption';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'opening_vs_closing', label: 'Opening vs Closing' },
  { key: 'receipts',           label: 'Receipts' },
  { key: 'consumption',        label: 'Consumption' },
];

function shortName(name: string): string {
  return name;
}

export function PlantComparisonChart() {
  const [metric, setMetric] = useState<Metric>('opening_vs_closing');
  const [materialId, setMaterialId] = useState<string | undefined>();

  const { data: materials } = useLedgerMaterials();
  const { data, isLoading, isError, refetch } = usePlantComparison(materialId);

  const chartData = (data?.plants ?? []).map((p) => ({
    name: shortName(p.plant_name),
    city: p.city ?? '',
    opening: p.opening_mt,
    closing: p.closing_mt,
    receipts: p.receipts_mt,
    consumption: p.consumption_mt,
  }));

  const unit = data?.unit ?? 'MT';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Plant Comparison</h3>
          <p className="text-xs text-gray-400 mt-0.5">Active plants · CA accounting rows · {unit}</p>
        </div>

        {/* Material filter */}
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

      {/* Metric toggle tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              metric === m.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Chart body */}
      {isLoading && <ChartCardSkeleton />}
      {isError && <ErrorState message="Failed to load plant comparison" onRetry={refetch} />}
      {!isLoading && !isError && chartData.length === 0 && <EmptyState />}

      {!isLoading && !isError && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 52)}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 60, bottom: 4, left: 0 }}
            barCategoryGap="30%"
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />

            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              unit={` ${unit}`}
              tickFormatter={(v) => formatNumber(v, 1)}
            />

            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 10, fill: '#374151' }}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(value: unknown, name: string) => [
                `${formatNumber(value as number, 3)} ${unit}`,
                name,
              ]}
              labelFormatter={(label) => {
                const plant = chartData.find((p) => p.name === label);
                return plant?.city ? `${label} — ${plant.city}` : label;
              }}
            />

            {metric === 'opening_vs_closing' && (
              <>
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(v) => v === 'opening' ? 'Opening (AB)' : 'Closing (EB)'}
                />
                <Bar dataKey="opening" name="opening" fill="#3D8BAD" radius={[0, 3, 3, 0]}
                  label={{ position: 'right', fontSize: 9, fill: '#6b7280',
                    formatter: (v: number) => v > 0 ? formatNumber(v, 1) : '' }} />
                <Bar dataKey="closing" name="closing" fill="#1B3550" radius={[0, 3, 3, 0]}
                  label={{ position: 'right', fontSize: 9, fill: '#6b7280',
                    formatter: (v: number) => v > 0 ? formatNumber(v, 1) : '' }} />
              </>
            )}

            {metric === 'receipts' && (
              <Bar dataKey="receipts" name="Receipts (ZU)" radius={[0, 3, 3, 0]}
                label={{ position: 'right', fontSize: 9, fill: '#6b7280',
                  formatter: (v: number) => v > 0 ? formatNumber(v, 1) : '' }}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#22C55E" />
                ))}
              </Bar>
            )}

            {metric === 'consumption' && (
              <Bar dataKey="consumption" name="Consumption (VN)" radius={[0, 3, 3, 0]}
                label={{ position: 'right', fontSize: 9, fill: '#6b7280',
                  formatter: (v: number) => v > 0 ? formatNumber(v, 1) : '' }}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#E05540" />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
