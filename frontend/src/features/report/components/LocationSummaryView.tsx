import { useState } from 'react';
import { useLocationSummary } from '@/features/material_ledger/hooks/useLedger';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { cn } from '@/utils/cn';
import type { LocationSummaryRow, BrandGroupMeta } from '@/types/material_ledger.types';

type MaterialType = 'bags' | 'bulk' | 'all';

function fmt(n: number): string {
  if (n === 0) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

const MAT_TYPES: { key: MaterialType; label: string }[] = [
  { key: 'bags', label: '50kg Bags' },
  { key: 'bulk', label: 'Bulk'      },
  { key: 'all',  label: 'All'       },
];

function SummaryTable({
  title,
  locations,
  totals,
  activeBrands,
  getValue,
  getTotalValue,
  highlightZero,
  isLoading,
}: {
  title: string;
  locations: LocationSummaryRow[];
  totals: LocationSummaryRow;
  activeBrands: BrandGroupMeta[];
  getValue: (row: LocationSummaryRow, brandId: string) => number;
  getTotalValue: (row: LocationSummaryRow) => number;
  highlightZero: (row: LocationSummaryRow, brandId: string) => boolean;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">{title}</h3>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-[#0D1F2D] text-white">
            <tr>
              <th className="sticky left-0 z-10 bg-[#0D1F2D] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest whitespace-nowrap min-w-50 border-r border-[#1B3550]">
                Location
              </th>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <th key={i} className="px-3 py-3">
                      <Skeleton className="h-2.5 w-14 ml-auto" />
                    </th>
                  ))
                : activeBrands.map(b => (
                    <th
                      key={b.id}
                      className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest whitespace-nowrap min-w-22.5 text-[#A8CFDF]"
                    >
                      {b.label}
                    </th>
                  ))
              }
              <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest whitespace-nowrap min-w-22.5 border-l border-[#1B3550] text-white">
                Total
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="bg-white">
                    <td className="sticky left-0 bg-white px-4 py-3 border-r border-gray-100">
                      <Skeleton className="h-3 w-36" />
                    </td>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-3 py-3 text-right">
                        <Skeleton className="h-3 w-10 ml-auto" />
                      </td>
                    ))}
                  </tr>
                ))
              : locations.map((row, i) => {
                  const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                  return (
                    <tr key={row.location_id} className={cn('hover:bg-blue-50/30 transition-colors', rowBg)}>
                      <td className={cn(
                        'sticky left-0 z-10 px-4 py-2.5 text-xs font-semibold text-gray-900 whitespace-nowrap border-r border-gray-100',
                        rowBg,
                      )}>
                        {row.location_label}
                      </td>
                      {activeBrands.map(b => {
                        const v     = getValue(row, b.id);
                        const alert = highlightZero(row, b.id);
                        return (
                          <td
                            key={b.id}
                            className={cn(
                              'px-3 py-2.5 text-right text-xs tabular-nums whitespace-nowrap',
                              alert   ? 'bg-red-50 text-red-600 font-semibold' :
                              v === 0 ? 'text-gray-300' : 'text-gray-800',
                            )}
                          >
                            {fmt(v)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums border-l border-gray-200 text-[#1D4E6B]">
                        {fmt(getTotalValue(row))}
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>

          {!isLoading && (
            <tfoot>
              <tr className="bg-[#0D1F2D]/5 border-t-2 border-[#0D1F2D]/20">
                <td className="sticky left-0 bg-[#0D1F2D]/5 px-4 py-3 text-xs font-bold text-gray-900 uppercase tracking-widest border-r border-gray-200">
                  Total
                </td>
                {activeBrands.map(b => (
                  <td key={b.id} className="px-3 py-3 text-right text-xs font-bold tabular-nums text-gray-900">
                    {fmt(getValue(totals, b.id))}
                  </td>
                ))}
                <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-[#1D4E6B] border-l border-gray-200">
                  {fmt(getTotalValue(totals))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function LocationSummaryView() {
  const [matType, setMatType] = useState<MaterialType>('bags');

  const includeBags = matType === 'bags' || matType === 'all';
  const includeBulk = matType === 'bulk' || matType === 'all';

  const { data, isLoading, isError } = useLocationSummary(includeBags, includeBulk);

  const activeBrands: BrandGroupMeta[] = data?.brand_groups.filter(b => b.has_data) ?? [];

  if (isError) {
    return <p className="text-sm text-red-500 text-center py-8">Failed to load location summary.</p>;
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Material type selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Material Type</span>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {MAT_TYPES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMatType(key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                matType === key ? 'bg-[#1D4E6B] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stock table */}
      <SummaryTable
        title="Warehouse Floor Stock (MT)"
        locations={data?.locations ?? []}
        totals={data?.totals ?? { location_id: '', location_label: '', brands: {}, total_stock: 0, total_dispatch: 0, inventory_days: null }}
        activeBrands={activeBrands}
        getValue={(row, bid) => row.brands[bid]?.stock ?? 0}
        getTotalValue={row => row.total_stock}
        highlightZero={(row, bid) => (row.brands[bid]?.stock ?? 0) === 0 && (row.brands[bid]?.dispatch ?? 0) > 0}
        isLoading={isLoading}
      />

      {/* Dispatch table */}
      <SummaryTable
        title="Dispatch — Period (MT)"
        locations={data?.locations ?? []}
        totals={data?.totals ?? { location_id: '', location_label: '', brands: {}, total_stock: 0, total_dispatch: 0, inventory_days: null }}
        activeBrands={activeBrands}
        getValue={(row, bid) => row.brands[bid]?.dispatch ?? 0}
        getTotalValue={row => row.total_dispatch}
        highlightZero={() => false}
        isLoading={isLoading}
      />

    </div>
  );
}
