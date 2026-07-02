import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Package, TrendingUp, TrendingDown, ArrowLeftRight, Filter } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { cn } from '@/utils/cn';
import { useInventoryReport, useLedgerMaterials } from '@/features/material_ledger/hooks/useLedger';
import { MultiMaterialPicker } from '@/features/home/components/MultiMaterialPicker';
import { useSettingsStore, convertQty, type UnitScale, type DisplayUnit } from '@/hooks/useSettingsStore';
import type { MaterialReportCard, PlantReportRow } from '@/types/material_ledger.types';
import { LocationSummaryView } from './components/LocationSummaryView';

type ReportView = 'material' | 'location';

const MT_SCALE: UnitScale = { unit: 'MT', bagsPerMt: 1 };

function fmtQty(mt: number, scale: UnitScale): string {
  if (mt === 0) return '—';
  const abs = Math.abs(mt);
  const { value } = convertQty(abs, scale, scale.unit === 'bags' ? 0 : 1);
  return mt < 0 ? `(${value})` : value;
}

function isAllZero(row: PlantReportRow) {
  return row.on_hand_mt === 0 && row.transit_out_mt === 0 && row.transit_in_mt === 0;
}

// ── Column header config ──────────────────────────────────────────────────────

const COLS = [
  { key: 'on_hand_mt',                label: 'Inventory with in-transit', short: 'On Hand',        color: 'text-[#1B3550]' },
  { key: 'transit_out_mt',            label: 'Transit OUT (BV+VN)',        short: 'Transit OUT',    color: 'text-amber-600' },
  { key: 'transit_in_mt',             label: 'Transit IN (BV+ZU)',         short: 'Transit IN',     color: 'text-green-600' },
  { key: 'inventory_without_transit', label: 'Without in-transit',         short: 'Without Transit',color: 'text-[#2E6B8A]' },
] as const;

// ── Material card ─────────────────────────────────────────────────────────────

function MaterialCard({ card, hideZeros, unitScale }: {
  card:      MaterialReportCard;
  hideZeros: boolean;
  unitScale: UnitScale;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const rows        = hideZeros ? card.plants.filter(r => !isAllZero(r)) : card.plants;
  const activeCount = card.plants.filter(r => !isAllZero(r)).length;
  const unitLabel   = unitScale.unit === 'bags' ? 'bags' : 'MT';

  const badgeOnHand  = convertQty(card.total_on_hand,   unitScale, unitScale.unit === 'bags' ? 0 : 1);
  const badgeTransIn = convertQty(card.total_transit_in, unitScale, unitScale.unit === 'bags' ? 0 : 1);
  const badgeTransOut= convertQty(card.total_transit_out,unitScale, unitScale.unit === 'bags' ? 0 : 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Card header ───────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{card.material_description}</p>
          <p className="text-[10px] font-mono text-gray-400 mt-0.5">{card.material_id}</p>
        </div>

        {/* Summary badges */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {card.total_on_hand > 0 && (
            <span className="text-[10px] font-bold bg-[#1B3550]/10 text-[#1B3550] px-2 py-1 rounded-lg">
              {badgeOnHand.value} {unitLabel} on hand
            </span>
          )}
          {card.total_transit_in > 0 && (
            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">
              +{badgeTransIn.value} {unitLabel} incoming
            </span>
          )}
          {card.total_transit_out > 0 && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
              {badgeTransOut.value} {unitLabel} outgoing
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            {activeCount} active plant{activeCount !== 1 ? 's' : ''}
          </span>
        </div>

        {collapsed ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronUp size={16} className="text-gray-400 shrink-0" />}
      </button>

      {/* ── Table ─────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap">Plant</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Name</th>
                {COLS.map(col => (
                  <th key={col.key} className={cn('text-right px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap', col.color)}>
                    {col.short}
                    <span className="normal-case font-normal text-gray-400 ml-1">({unitLabel})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-400">
                    No activity for this material
                  </td>
                </tr>
              ) : (
                rows.map(row => {
                  const hasActivity = !isAllZero(row);
                  return (
                    <tr
                      key={row.plant_id}
                      className={cn(
                        'border-b border-gray-50 last:border-0',
                        hasActivity ? 'hover:bg-[#0D1F2D]/3' : 'opacity-40',
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono font-semibold text-gray-700">{row.plant_id}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-gray-800 font-medium truncate max-w-40">{row.plant_name}</p>
                        {row.city && <p className="text-[10px] text-gray-400">{row.city}</p>}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', row.on_hand_mt > 0 ? 'text-[#1B3550]' : 'text-gray-300')}>
                        {fmtQty(row.on_hand_mt, unitScale)}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', row.transit_out_mt > 0 ? 'text-amber-600' : 'text-gray-300')}>
                        {fmtQty(row.transit_out_mt, unitScale)}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', row.transit_in_mt > 0 ? 'text-green-600' : 'text-gray-300')}>
                        {fmtQty(row.transit_in_mt, unitScale)}
                      </td>
                      <td className={cn(
                        'px-4 py-2.5 text-right font-bold tabular-nums',
                        row.inventory_without_transit > 0 ? 'text-[#2E6B8A]' :
                        row.inventory_without_transit < 0 ? 'text-red-500' : 'text-gray-300',
                      )}>
                        {fmtQty(row.inventory_without_transit, unitScale)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Totals row */}
            {rows.some(r => !isAllZero(r)) && (
              <tfoot>
                <tr className="bg-[#0D1F2D]/5 border-t-2 border-gray-200">
                  <td colSpan={2} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Total
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-[#1B3550] tabular-nums text-xs">
                    {fmtQty(card.total_on_hand, unitScale)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-amber-600 tabular-nums text-xs">
                    {fmtQty(card.total_transit_out, unitScale)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-green-600 tabular-nums text-xs">
                    {fmtQty(card.total_transit_in, unitScale)}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right font-bold tabular-nums text-xs',
                    card.total_inventory_without_transit >= 0 ? 'text-[#2E6B8A]' : 'text-red-500',
                  )}>
                    {fmtQty(card.total_inventory_without_transit, unitScale)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportPage() {
  const [reportView,        setReportView]        = useState<ReportView>('material');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [hideZeros,         setHideZeros]         = useState(true);
  const [unitOverride,      setUnitOverride]      = useState<DisplayUnit | null>(null);

  const { data: report,    isLoading: reportLoading } = useInventoryReport();
  const { data: materials, isLoading: matsLoading   } = useLedgerMaterials();
  const { allUnitScales, getUnitScale } = useSettingsStore();

  // Derive what Settings has configured as the default unit
  const settingsUnit = useMemo<DisplayUnit>(() => {
    return Object.values(allUnitScales).some(s => s.unit === 'bags') ? 'bags' : 'MT';
  }, [allUnitScales]);

  const effectiveUnit: DisplayUnit = unitOverride ?? settingsUnit;
  const isOverriding = unitOverride !== null && unitOverride !== settingsUnit;

  const filteredCards = useMemo(() => {
    if (!report) return [];
    if (selectedMaterials.length === 0) return report.materials;
    return report.materials.filter(card => selectedMaterials.includes(card.material_id));
  }, [report, selectedMaterials]);

  const isLoading = reportLoading || matsLoading;

  return (
    <div className="p-4 lg:p-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Stock Sheet"
        subtitle={
          reportView === 'material'
            ? `Per-material breakdown across all plants · ${filteredCards.length} of ${report?.materials.length ?? 0} materials · showing in ${effectiveUnit}`
            : 'Brand × location grid — floor stock and period dispatch'
        }
      />

      {/* ── View toggle ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 shrink-0">
          {([
            { key: 'material', label: 'Material View'     },
            { key: 'location', label: 'Location Summary'  },
          ] as { key: ReportView; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setReportView(key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                reportView === key
                  ? 'bg-[#1D4E6B] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Location Summary view ─────────────────────────────────────────── */}
      {reportView === 'location' && <LocationSummaryView />}

      {/* ── Material view ────────────────────────────────────────────────── */}
      {reportView === 'material' && (
      <>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 pt-4 pb-3 mb-5 space-y-3">

        {/* Material picker — full width */}
        <MultiMaterialPicker
          materials={materials ?? []}
          selected={selectedMaterials}
          onChange={setSelectedMaterials}
        />

        {/* Controls row — sits below picker, never wraps awkwardly */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">

          {/* MT / Bags pill toggle */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg">
              {(['MT', 'bags'] as DisplayUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => setUnitOverride(u === settingsUnit ? null : u)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap',
                    effectiveUnit === u
                      ? 'bg-[#1B3550] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {u === 'bags' ? 'Bags' : 'MT'}
                  {u === settingsUnit && (
                    <span className="ml-1 text-[9px] opacity-50">·default</span>
                  )}
                </button>
              ))}
            </div>
            {isOverriding && (
              <button
                onClick={() => setUnitOverride(null)}
                className="text-[10px] text-[#2E6B8A] hover:underline text-left"
              >
                ↩ Reset to {settingsUnit} (Settings default)
              </button>
            )}
          </div>

          {/* Hide zeros toggle */}
          <button
            onClick={() => setHideZeros(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap',
              hideZeros
                ? 'bg-[#1B3550] text-white border-[#1B3550]'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
            )}
          >
            <Filter size={11} />
            <span className="hidden sm:inline">{hideZeros ? 'Hiding zero rows' : 'Show active rows only'}</span>
            <span className="sm:hidden">{hideZeros ? 'Hide zeros ✓' : 'Hide zeros'}</span>
          </button>
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="mb-4 px-1">
        {/* Mobile: compact 2-col grid */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1.5">
          {[
            { icon: <Package size={11} />,        color: 'text-[#1B3550]', label: 'On Hand',           sub: 'CA+EB closing stock' },
            { icon: <TrendingUp size={11} />,     color: 'text-amber-600', label: 'Transit OUT',        sub: 'dispatched from factory' },
            { icon: <TrendingDown size={11} />,   color: 'text-green-600', label: 'Transit IN',         sub: 'arriving at depot' },
            { icon: <ArrowLeftRight size={11} />, color: 'text-[#2E6B8A]', label: 'Without Transit',   sub: 'adjusted on-hand' },
          ].map(({ icon, color, label, sub }) => (
            <div key={label} className="flex items-start gap-1.5">
              <span className={cn('mt-0.5 shrink-0', color)}>{icon}</span>
              <span className="text-[10px] text-gray-500 leading-tight">
                <span className={cn('font-semibold', color)}>{label}</span>
                <span className="hidden sm:inline"> — {sub}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">(negative values) = shown in parentheses</p>
      </div>

      {/* ── Cards ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-40 w-full" />
            </div>
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500">No materials match your filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCards.map(card => (
            <MaterialCard
              key={card.material_id}
              card={card}
              hideZeros={hideZeros}
              unitScale={effectiveUnit === 'bags' ? getUnitScale(card.material_id) : MT_SCALE}
            />
          ))}
        </div>
      )}

      </>
      )}
    </div>
  );
}
