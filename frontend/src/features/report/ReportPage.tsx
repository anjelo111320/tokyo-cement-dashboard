import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Package, TrendingUp, TrendingDown, ArrowLeftRight, Filter } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { cn } from '@/utils/cn';
import { useInventoryReport, useLedgerMaterials, useLedgerTransfers } from '@/features/material_ledger/hooks/useLedger';
import { MultiMaterialPicker } from '@/features/home/components/MultiMaterialPicker';
import { useSettingsStore, convertQty, type UnitScale, type DisplayUnit } from '@/hooks/useSettingsStore';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { MaterialReportCard, PlantReportRow } from '@/types/material_ledger.types';
import { LocationSummaryView } from './components/LocationSummaryView';

type ReportView = 'material' | 'location';
type MaterialSubView = 'by_material' | 'by_plant';

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

function isMaterialInactive(card: MaterialReportCard) {
  return card.plants.every(isAllZero);
}

// On-hand stock vs. the material's configured threshold (Settings → Thresholds).
// A row with zero activity everywhere (never stocked here) stays neutral rather
// than "out" — only rows with some transit/on-hand activity get flagged red,
// mirroring the "everStocked" guard used for the same purpose on the Home page.
type StockStatus = 'out' | 'low' | 'ok';

function stockStatus(onHandMt: number, threshold: number, hasActivity: boolean): StockStatus {
  if (onHandMt <= 0) return hasActivity ? 'out' : 'ok';
  if (threshold > 0 && onHandMt < threshold) return 'low';
  return 'ok';
}

// Whole-row background tint — mirrors the same amber/red convention already
// used for plant rows on the Home page's PlantInventoryTable.
const STOCK_ROW_CLS: Record<StockStatus, string> = {
  out: 'bg-red-50/60 hover:bg-red-100/60',
  low: 'bg-amber-50/50 hover:bg-amber-100/50',
  ok:  '',
};

// ── Column header config ──────────────────────────────────────────────────────

const COLS = [
  { key: 'on_hand_mt',                label: 'Inventory with in-transit', short: 'On Hand',        color: 'text-[#1B3550]' },
  { key: 'transit_out_mt',            label: 'Transit OUT (BV+VN)',        short: 'Transit OUT',    color: 'text-amber-600' },
  { key: 'transit_in_mt',             label: 'Transit IN (BV+ZU)',         short: 'Transit IN',     color: 'text-green-600' },
  { key: 'inventory_without_transit', label: 'Without in-transit',         short: 'Without Transit',color: 'text-[#2E6B8A]' },
] as const;

// ── Material card ─────────────────────────────────────────────────────────────

function MaterialCard({ card, hideZeros, unitScale, getThreshold }: {
  card:      MaterialReportCard;
  hideZeros: boolean;
  unitScale: UnitScale;
  getThreshold: (materialId: string) => number;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const rows        = hideZeros ? card.plants.filter(r => !isAllZero(r)) : card.plants;
  const activeCount = card.plants.filter(r => !isAllZero(r)).length;
  const unitLabel   = unitScale.unit === 'bags' ? 'bags' : 'MT';
  const threshold   = getThreshold(card.material_id);

  // Low/out counts — how many of THIS material's plants are below threshold.
  const lowCount = card.plants.filter(r => stockStatus(r.on_hand_mt, threshold, !isAllZero(r)) === 'low').length;
  const outCount = card.plants.filter(r => stockStatus(r.on_hand_mt, threshold, !isAllZero(r)) === 'out').length;

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
          {outCount > 0 && (
            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-lg">
              ✕ {outCount} out
            </span>
          )}
          {lowCount > 0 && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
              ⚠ {lowCount} low
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
                  const status      = stockStatus(row.on_hand_mt, threshold, hasActivity);
                  return (
                    <tr
                      key={row.plant_id}
                      className={cn(
                        'border-b border-gray-50 last:border-0',
                        status !== 'ok' ? STOCK_ROW_CLS[status] : hasActivity ? 'hover:bg-[#0D1F2D]/3' : 'opacity-40',
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

// ── Plant card (By Plant view — materials as rows) ─────────────────────────────

interface MaterialRowEntry {
  material_id:          string;
  material_description: string;
  row:                   PlantReportRow;
  outHintPlant:          string | null;
  inHintPlant:           string | null;
}

interface PlantGroup {
  plant_id:                        string;
  plant_name:                      string;
  city:                            string | null;
  materials:                       MaterialRowEntry[];
  total_on_hand:                   number;
  total_transit_out:               number;
  total_transit_in:                number;
  total_inventory_without_transit: number;
}

function isPlantGroupInactive(group: PlantGroup) {
  return group.materials.every(m => isAllZero(m.row));
}

function PlantCard({ group, hideZeros, getRowScale, unitLabel, getThreshold }: {
  group:       PlantGroup;
  hideZeros:   boolean;
  getRowScale: (materialId: string) => UnitScale;
  unitLabel:   string;
  getThreshold: (materialId: string) => number;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const rows        = hideZeros ? group.materials.filter(m => !isAllZero(m.row)) : group.materials;
  const activeCount  = group.materials.filter(m => !isAllZero(m.row)).length;

  // Low/out counts — how many materials AT THIS PLANT are below threshold.
  const lowCount = group.materials.filter(m => stockStatus(m.row.on_hand_mt, getThreshold(m.material_id), !isAllZero(m.row)) === 'low').length;
  const outCount = group.materials.filter(m => stockStatus(m.row.on_hand_mt, getThreshold(m.material_id), !isAllZero(m.row)) === 'out').length;

  // Plant-level totals mix quantities across different materials, which can have
  // different bags-per-MT factors — so unlike per-row cells (each tied to one
  // material and free to follow the page's MT/Bags toggle), totals here are only
  // physically meaningful summed in MT and are always shown that way.
  const badgeOnHand   = fmtQty(group.total_on_hand,     MT_SCALE);
  const badgeTransIn  = fmtQty(group.total_transit_in,  MT_SCALE);
  const badgeTransOut = fmtQty(group.total_transit_out, MT_SCALE);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Card header ───────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{group.plant_name}</p>
          <p className="text-[10px] font-mono text-gray-400 mt-0.5">
            {group.plant_id}{group.city ? ` · ${group.city}` : ''}
          </p>
        </div>

        {/* Summary badges — always MT, see note above */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {group.total_on_hand > 0 && (
            <span className="text-[10px] font-bold bg-[#1B3550]/10 text-[#1B3550] px-2 py-1 rounded-lg">
              {badgeOnHand} MT on hand
            </span>
          )}
          {group.total_transit_in > 0 && (
            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">
              +{badgeTransIn} MT incoming
            </span>
          )}
          {group.total_transit_out > 0 && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
              {badgeTransOut} MT outgoing
            </span>
          )}
          {outCount > 0 && (
            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-lg">
              ✕ {outCount} out
            </span>
          )}
          {lowCount > 0 && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
              ⚠ {lowCount} low
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            {activeCount} active material{activeCount !== 1 ? 's' : ''}
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
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap">Material</th>
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
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400">
                    No activity at this plant
                  </td>
                </tr>
              ) : (
                rows.map(m => {
                  const row         = m.row;
                  const hasActivity = !isAllZero(row);
                  const scale       = getRowScale(m.material_id);
                  const status      = stockStatus(row.on_hand_mt, getThreshold(m.material_id), hasActivity);
                  return (
                    <tr
                      key={m.material_id}
                      className={cn(
                        'border-b border-gray-50 last:border-0',
                        status !== 'ok' ? STOCK_ROW_CLS[status] : hasActivity ? 'hover:bg-[#0D1F2D]/3' : 'opacity-40',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <p className="text-gray-800 font-medium truncate max-w-56">{m.material_description}</p>
                        <p className="text-[10px] font-mono text-gray-400">{m.material_id}</p>
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', row.on_hand_mt > 0 ? 'text-[#1B3550]' : 'text-gray-300')}>
                        {fmtQty(row.on_hand_mt, scale)}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', row.transit_out_mt > 0 ? 'text-amber-600' : 'text-gray-300')}>
                        {fmtQty(row.transit_out_mt, scale)}
                        {row.transit_out_mt > 0 && m.outHintPlant && (
                          <p className="text-[9px] font-normal text-amber-500/70 mt-0.5 whitespace-nowrap">→ {m.outHintPlant}</p>
                        )}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', row.transit_in_mt > 0 ? 'text-green-600' : 'text-gray-300')}>
                        {fmtQty(row.transit_in_mt, scale)}
                        {row.transit_in_mt > 0 && m.inHintPlant && (
                          <p className="text-[9px] font-normal text-green-600/70 mt-0.5 whitespace-nowrap">← {m.inHintPlant}</p>
                        )}
                      </td>
                      <td className={cn(
                        'px-4 py-2.5 text-right font-bold tabular-nums',
                        row.inventory_without_transit > 0 ? 'text-[#2E6B8A]' :
                        row.inventory_without_transit < 0 ? 'text-red-500' : 'text-gray-300',
                      )}>
                        {fmtQty(row.inventory_without_transit, scale)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Totals row — always MT, see note above */}
            {rows.some(m => !isAllZero(m.row)) && (
              <tfoot>
                <tr className="bg-[#0D1F2D]/5 border-t-2 border-gray-200">
                  <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Total (MT)
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-[#1B3550] tabular-nums text-xs">
                    {badgeOnHand}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-amber-600 tabular-nums text-xs">
                    {badgeTransOut}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-green-600 tabular-nums text-xs">
                    {badgeTransIn}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right font-bold tabular-nums text-xs',
                    group.total_inventory_without_transit >= 0 ? 'text-[#2E6B8A]' : 'text-red-500',
                  )}>
                    {fmtQty(group.total_inventory_without_transit, MT_SCALE)}
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
  const [reportView,            setReportView]            = useLocalStorage<ReportView>('insee_dashboard_report_view', 'material');
  const [materialSubView,       setMaterialSubView]       = useLocalStorage<MaterialSubView>('insee_dashboard_report_material_subview', 'by_material');
  const [selectedMaterials,     setSelectedMaterials]     = useLocalStorage<string[]>('insee_dashboard_report_material_ids', []);
  const [hideZeros,             setHideZeros]             = useLocalStorage<boolean>('insee_dashboard_report_hide_zeros', true);
  const [hideInactiveMaterials, setHideInactiveMaterials] = useLocalStorage<boolean>('insee_dashboard_report_hide_inactive_materials', true);
  const [hideInactivePlants,    setHideInactivePlants]    = useLocalStorage<boolean>('insee_dashboard_report_hide_inactive_plants', true);
  const [unitOverride,          setUnitOverride]          = useLocalStorage<DisplayUnit | null>('insee_dashboard_report_unit_override', null);

  const { data: report,       isLoading: reportLoading } = useInventoryReport();
  const { data: materials,    isLoading: matsLoading   } = useLedgerMaterials();
  const { data: transferData } = useLedgerTransfers();
  const { allUnitScales, getUnitScale, getThreshold } = useSettingsStore();

  // Derive what Settings has configured as the default unit
  const settingsUnit = useMemo<DisplayUnit>(() => {
    return Object.values(allUnitScales).some(s => s.unit === 'bags') ? 'bags' : 'MT';
  }, [allUnitScales]);

  const effectiveUnit: DisplayUnit = unitOverride ?? settingsUnit;
  const isOverriding = unitOverride !== null && unitOverride !== settingsUnit;

  const filteredCards = useMemo(() => {
    if (!report) return [];
    let cards = report.materials;
    if (selectedMaterials.length > 0) {
      cards = cards.filter(card => selectedMaterials.includes(card.material_id));
    } else if (hideInactiveMaterials) {
      // Only declutter the default "All Materials" view — an explicit material
      // selection is authoritative and should always show in full.
      cards = cards.filter(card => !isMaterialInactive(card));
    }
    return cards;
  }, [report, selectedMaterials, hideInactiveMaterials]);

  // Best (largest) counterpart plant per (plant, material) — a lightweight hint only.
  // Sourced from the separate VM-based transfer feed, which is not guaranteed to
  // reconcile with the BV-based Transit OUT/IN totals shown alongside it.
  const transferHints = useMemo(() => {
    const outMap = new Map<string, string>();
    const inMap  = new Map<string, string>();
    const bestOut = new Map<string, number>();
    const bestIn  = new Map<string, number>();
    for (const t of transferData?.transfers ?? []) {
      if (t.source_plant_id === t.dest_plant_id) continue;
      const outKey = `${t.source_plant_id}|${t.material_id}`;
      if (t.quantity > (bestOut.get(outKey) ?? -Infinity)) {
        bestOut.set(outKey, t.quantity);
        outMap.set(outKey, t.dest_plant_id);
      }
      const inKey = `${t.dest_plant_id}|${t.material_id}`;
      if (t.quantity > (bestIn.get(inKey) ?? -Infinity)) {
        bestIn.set(inKey, t.quantity);
        inMap.set(inKey, t.source_plant_id);
      }
    }
    return { outMap, inMap };
  }, [transferData]);

  const plantGroups = useMemo<PlantGroup[]>(() => {
    if (filteredCards.length === 0) return [];
    const groups: PlantGroup[] = filteredCards[0].plants.map(p => ({
      plant_id: p.plant_id,
      plant_name: p.plant_name,
      city: p.city,
      materials: [],
      total_on_hand: 0,
      total_transit_out: 0,
      total_transit_in: 0,
      total_inventory_without_transit: 0,
    }));
    const byPlantId = new Map(groups.map(g => [g.plant_id, g]));

    for (const card of filteredCards) {
      for (const row of card.plants) {
        const g = byPlantId.get(row.plant_id);
        if (!g) continue;
        g.materials.push({
          material_id:          card.material_id,
          material_description: card.material_description,
          row,
          outHintPlant: transferHints.outMap.get(`${row.plant_id}|${card.material_id}`) ?? null,
          inHintPlant:  transferHints.inMap.get(`${row.plant_id}|${card.material_id}`) ?? null,
        });
        g.total_on_hand                   += row.on_hand_mt;
        g.total_transit_out                += row.transit_out_mt;
        g.total_transit_in                 += row.transit_in_mt;
        g.total_inventory_without_transit += row.inventory_without_transit;
      }
    }
    return groups;
  }, [filteredCards, transferHints]);

  const visiblePlantGroups = useMemo(() => {
    if (!hideInactivePlants) return plantGroups;
    return plantGroups.filter(g => !isPlantGroupInactive(g));
  }, [plantGroups, hideInactivePlants]);

  const isLoading = reportLoading || matsLoading;

  return (
    <div className="p-4 lg:p-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Stock Sheet"
        subtitle={
          reportView !== 'material'
            ? 'Brand × location grid — floor stock and period dispatch'
            : materialSubView === 'by_material'
              ? `Per-material breakdown across all plants · ${filteredCards.length} of ${report?.materials.length ?? 0} materials · showing in ${effectiveUnit}`
              : `Per-plant breakdown across all materials · ${visiblePlantGroups.length} of ${plantGroups.length} plants · showing in ${effectiveUnit}`
        }
      />

      {/* ── View toggle ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
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

        {reportView === 'material' && (
          <div className="flex bg-gray-50 rounded-lg p-0.5 gap-0.5 border border-gray-200 shrink-0">
            {([
              { key: 'by_material', label: 'By Material — plants as rows'  },
              { key: 'by_plant',     label: 'By Plant — materials as rows' },
            ] as { key: MaterialSubView; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMaterialSubView(key)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 whitespace-nowrap',
                  materialSubView === key
                    ? 'bg-white text-[#1D4E6B] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
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

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Hide inactive materials toggle — whole material has zero activity across every plant.
                Hidden once specific materials are picked — an explicit selection always shows in full. */}
            {selectedMaterials.length === 0 && (
              <button
                onClick={() => setHideInactiveMaterials(!hideInactiveMaterials)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap',
                  hideInactiveMaterials
                    ? 'bg-[#1B3550] text-white border-[#1B3550]'
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
                )}
              >
                <Filter size={11} />
                <span className="hidden sm:inline">{hideInactiveMaterials ? 'Hiding inactive materials' : 'Show inactive materials'}</span>
                <span className="sm:hidden">{hideInactiveMaterials ? 'Hide inactive ✓' : 'Hide inactive'}</span>
              </button>
            )}

            {/* Hide inactive plants toggle — only relevant in the By Plant (materials-as-rows) layout */}
            {materialSubView === 'by_plant' && (
              <button
                onClick={() => setHideInactivePlants(!hideInactivePlants)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap',
                  hideInactivePlants
                    ? 'bg-[#1B3550] text-white border-[#1B3550]'
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
                )}
              >
                <Filter size={11} />
                <span className="hidden sm:inline">{hideInactivePlants ? 'Hiding inactive plants' : 'Show inactive plants'}</span>
                <span className="sm:hidden">{hideInactivePlants ? 'Hide inactive ✓' : 'Hide inactive'}</span>
              </button>
            )}

            {/* Hide zero rows toggle — hides zero rows within each card/table, whichever
                entity the rows represent (plants inside a material card, or materials
                inside a plant card) */}
            <button
              onClick={() => setHideZeros(!hideZeros)}
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
        <p className="text-[10px] text-gray-400 mt-1">
          Row tint: <span className="text-amber-700 font-semibold">amber</span> = below threshold ·{' '}
          <span className="text-red-600 font-semibold">red</span> = out of stock
        </p>
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
      ) : materialSubView === 'by_material' ? (
        <div className="space-y-4">
          {filteredCards.map(card => (
            <MaterialCard
              key={card.material_id}
              card={card}
              hideZeros={hideZeros}
              unitScale={effectiveUnit === 'bags' ? getUnitScale(card.material_id) : MT_SCALE}
              getThreshold={getThreshold}
            />
          ))}
        </div>
      ) : visiblePlantGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500">No plants match your filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePlantGroups.map(group => (
            <PlantCard
              key={group.plant_id}
              group={group}
              hideZeros={hideZeros}
              getRowScale={materialId => effectiveUnit === 'bags' ? getUnitScale(materialId) : MT_SCALE}
              unitLabel={effectiveUnit === 'bags' ? 'bags' : 'MT'}
              getThreshold={getThreshold}
            />
          ))}
        </div>
      )}

      </>
      )}
    </div>
  );
}
