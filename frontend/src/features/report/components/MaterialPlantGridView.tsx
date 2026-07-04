import { useState } from 'react';
import { cn } from '@/utils/cn';
import { convertQty, type UnitScale, type DisplayUnit } from '@/hooks/useSettingsStore';
import type { MaterialReportCard } from '@/types/material_ledger.types';

type GridMetricKey = 'on_hand_mt' | 'transit_out_mt' | 'transit_in_mt' | 'inventory_without_transit';

const GRID_METRICS: { key: GridMetricKey; short: string; color: string }[] = [
  { key: 'on_hand_mt',                short: 'On Hand',        color: 'text-[#1B3550]' },
  { key: 'transit_out_mt',            short: 'Transit OUT',    color: 'text-amber-600' },
  { key: 'transit_in_mt',             short: 'Transit IN',     color: 'text-green-600' },
  { key: 'inventory_without_transit', short: 'Without Transit', color: 'text-[#2E6B8A]' },
];

function totalForMetric(card: MaterialReportCard, metric: GridMetricKey): number {
  switch (metric) {
    case 'on_hand_mt':                return card.total_on_hand;
    case 'transit_out_mt':            return card.total_transit_out;
    case 'transit_in_mt':             return card.total_transit_in;
    case 'inventory_without_transit': return card.total_inventory_without_transit;
  }
}

function fmt(mt: number, scale: UnitScale): string {
  if (mt === 0) return '—';
  const { value } = convertQty(Math.abs(mt), scale, scale.unit === 'bags' ? 0 : 1);
  return mt < 0 ? `(${value})` : value;
}

export function MaterialPlantGridView({
  cards, getUnitScale, effectiveUnit, unitScaleMT,
}: {
  cards:         MaterialReportCard[];
  getUnitScale:  (materialId: string) => UnitScale;
  effectiveUnit: DisplayUnit;
  unitScaleMT:   UnitScale;
}) {
  const [metric, setMetric] = useState<GridMetricKey>('on_hand_mt');

  const plants = cards[0]?.plants.map(p => ({ plant_id: p.plant_id, plant_name: p.plant_name, city: p.city })) ?? [];
  const activeMeta = GRID_METRICS.find(m => m.key === metric)!;

  return (
    <div className="flex flex-col gap-3">

      {/* Metric switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Metric</span>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 flex-wrap">
          {GRID_METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                metric === m.key ? 'bg-[#1D4E6B] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800',
              )}
            >
              {m.short}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-[#0D1F2D] text-white">
            <tr>
              <th className="sticky left-0 z-10 bg-[#0D1F2D] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest whitespace-nowrap min-w-50 border-r border-[#1B3550]">
                Material
              </th>
              {plants.map(p => (
                <th
                  key={p.plant_id}
                  title={`${p.plant_name}${p.city ? ' · ' + p.city : ''}`}
                  className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest whitespace-nowrap min-w-20 text-[#A8CFDF]"
                >
                  {p.plant_id}
                </th>
              ))}
              <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest whitespace-nowrap min-w-22.5 border-l border-[#1B3550] text-white">
                Total
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {cards.map((card, i) => {
              const rowBg  = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
              const scale  = effectiveUnit === 'bags' ? getUnitScale(card.material_id) : unitScaleMT;
              const byPlant = new Map(card.plants.map(p => [p.plant_id, p]));

              return (
                <tr key={card.material_id} className={cn('hover:bg-blue-50/30 transition-colors', rowBg)}>
                  <td className={cn('sticky left-0 z-10 px-4 py-2.5 border-r border-gray-100', rowBg)}>
                    <p className="text-xs font-semibold text-gray-900 truncate max-w-56">{card.material_description}</p>
                    <p className="text-[10px] font-mono text-gray-400">{card.material_id}</p>
                  </td>
                  {plants.map(p => {
                    const v = byPlant.get(p.plant_id)?.[metric] ?? 0;
                    return (
                      <td
                        key={p.plant_id}
                        className={cn('px-3 py-2.5 text-right text-xs tabular-nums whitespace-nowrap', v === 0 ? 'text-gray-300' : activeMeta.color)}
                      >
                        {fmt(v, scale)}
                      </td>
                    );
                  })}
                  <td className={cn('px-3 py-2.5 text-right text-xs font-bold tabular-nums border-l border-gray-200', activeMeta.color)}>
                    {fmt(totalForMetric(card, metric), scale)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-400 px-1">
        Columns are plants (hover a header for name/city) · rows are materials · (negative values) shown in parentheses
      </p>
    </div>
  );
}
