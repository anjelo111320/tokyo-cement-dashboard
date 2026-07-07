/** PlantInventoryTable — per-plant inventory breakdown table. Alerts sort to top. */

import { useState, useEffect } from 'react';
import { X, Warehouse, TrendingDown, TrendingUp, ArrowDownToLine, Package, ArrowLeftRight, Info, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { convertQty, type UnitScale } from '@/hooks/useSettingsStore';
import { useLedgerMaterials, useLedgerTransfers } from '@/features/material_ledger/hooks/useLedger';
import type { InventorySummary, PlantInventoryRow } from '@/types/material_ledger.types';
import { useSettingsStore, type ZeroStockMode } from '@/hooks/useSettingsStore';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface Props {
  summary:        InventorySummary | undefined;
  isLoading:      boolean;
  unitScale?:     UnitScale;
  zeroStockMode?: ZeroStockMode;
  settingsMode?:  ZeroStockMode;
  onModeChange?:  (mode: ZeroStockMode) => void;
  hasPlantFilter?: boolean;  // true when the user explicitly picked plants — always show all of them
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status, lowCount, outCount }: { status: string; lowCount: number; outCount: number }) {
  if (status !== 'ok' && (lowCount > 0 || outCount > 0)) {
    return (
      <span className="inline-flex items-center gap-1">
        {outCount > 0 && (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
            ✕ {outCount} Out
          </span>
        )}
        {lowCount > 0 && (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            ⚠ {lowCount} Low
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
      ● OK
    </span>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function PlantDetailModal({
  row,
  scale,
  onClose,
}: {
  row:     PlantInventoryRow;
  scale:   UnitScale;
  onClose: () => void;
}) {
  const unit = scale.unit;

  // Plant-scoped: backend filters EB rows to row.plant_id, so closing_stock_mt
  // is the stock at THIS plant only — not the global total.
  const { data: rawMaterials = [], isLoading: matsLoading } = useLedgerMaterials([row.plant_id]);
  const { getThreshold } = useSettingsStore();

  type MatStatus = 'out' | 'low' | 'ok' | 'skip';
  function matStatus(stock: number, materialId: string, everStocked: boolean): MatStatus {
    if (stock <= 0) {
      // Option B: only flag as "out" if this plant has ever carried the material.
      // If it never had AB or ZU for it, the zero EB is irrelevant — skip it.
      return everStocked ? 'out' : 'skip';
    }
    const threshold = getThreshold(materialId);
    if (threshold > 0 && stock < threshold) return 'low';
    return 'ok';
  }

  const SEVERITY: Record<MatStatus, number> = { out: 0, low: 1, ok: 2, skip: 3 };
  const sortedMaterials = [...rawMaterials]
    .filter(m => matStatus(m.closing_stock_mt, m.material_id, m.ever_stocked) !== 'skip')
    .sort((a, b) =>
      SEVERITY[matStatus(a.closing_stock_mt, a.material_id, a.ever_stocked)] -
      SEVERITY[matStatus(b.closing_stock_mt, b.material_id, b.ever_stocked)]
    );

  const MAT_STYLE: Record<MatStatus, { bg: string; border: string; badge: string; badgeCls: string; idCls: string }> = {
    out:  { bg: 'bg-red-50',    border: 'border-red-200',   badge: '✕ Out',  badgeCls: 'bg-red-100 text-red-700',     idCls: 'text-red-400'    },
    low:  { bg: 'bg-amber-50',  border: 'border-amber-200', badge: '⚠ Low',  badgeCls: 'bg-amber-100 text-amber-700', idCls: 'text-amber-500'  },
    ok:   { bg: 'bg-gray-50',   border: 'border-gray-100',  badge: '',        badgeCls: '',                            idCls: 'text-[#2E6B8A]'  },
    skip: { bg: 'bg-gray-50',   border: 'border-gray-100',  badge: '',        badgeCls: '',                            idCls: 'text-gray-400'   },
  };

  // Fetch all transfers once (cached), then split by direction for this plant
  const { data: transferData, isLoading: txLoading } = useLedgerTransfers();
  const realTransfers = (transferData?.transfers ?? []).filter(t => t.source_plant_id !== t.dest_plant_id);
  const outgoing = realTransfers.filter(t => t.source_plant_id === row.plant_id);
  const incoming = realTransfers.filter(t => t.dest_plant_id   === row.plant_id);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusMeta: Record<string, { label: string; bg: string; text: string }> = {
    ok:  { label: '● OK',   bg: 'bg-green-100', text: 'text-green-700' },
    low: { label: '⚠ Low', bg: 'bg-amber-100', text: 'text-amber-700' },
    out: { label: '✕ Out', bg: 'bg-red-100',   text: 'text-red-700'   },
  };
  const sm = statusMeta[row.status] ?? statusMeta.ok;

  const onHand     = convertQty(row.on_hand_mt,        scale);
  const transitOut = convertQty(row.in_transit_out_mt, scale);
  const transitIn  = convertQty(row.in_transit_in_mt,  scale);
  const netExpected = convertQty(row.on_hand_mt + row.in_transit_in_mt, scale);

  const totalForBar = Math.max(row.on_hand_mt + row.in_transit_in_mt, 1);
  const onHandPct   = Math.min((row.on_hand_mt / totalForBar) * 100, 100);

  const stats = [
    {
      icon:  <Warehouse size={16} />,
      label: 'Available Stock',
      value: onHand.value,
      note:  'Closing balance (EB)',
      color: 'text-[#1B3550]',
      bg:    'bg-[#1B3550]/5',
      border:'border-[#1B3550]/10',
    },
    {
      icon:  <TrendingDown size={16} />,
      label: 'In Transit OUT',
      value: transitOut.value,
      note:  'Dispatched, not yet received',
      color: 'text-amber-600',
      bg:    'bg-amber-50',
      border:'border-amber-100',
    },
    {
      icon:  <TrendingUp size={16} />,
      label: 'In Transit IN',
      value: transitIn.value,
      note:  'Inbound, not yet confirmed',
      color: 'text-green-600',
      bg:    'bg-green-50',
      border:'border-green-100',
    },
  ];

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      {/* Card — stop click propagation so backdrop click doesn't fire inside */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header band ─────────────────────────────────────────────── */}
        <div className="bg-[#0D1F2D] px-6 pt-5 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-3">
            <span className="font-mono text-3xl font-bold text-white tracking-tight leading-none">
              {row.plant_id}
            </span>
            <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full mt-1 shrink-0', sm.bg, sm.text)}>
              {sm.label}
            </span>
          </div>

          <p className="text-white/90 font-semibold text-sm mt-1.5 leading-snug">{row.plant_name}</p>
          {row.city && <p className="text-white/40 text-xs mt-0.5">{row.city}</p>}
        </div>

        {/* ── Stock bar ────────────────────────────────────────────────── */}
        <div className="px-6 pt-4">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Stock fill (on-hand vs expected)</span>
            <span>{Math.round(onHandPct)}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                row.status === 'out' ? 'bg-red-400' :
                row.status === 'low' ? 'bg-amber-400' : 'bg-[#2E6B8A]',
              )}
              style={{ width: `${onHandPct}%` }}
            />
          </div>
        </div>

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className="px-6 pt-4 grid grid-cols-3 gap-2.5">
          {stats.map(s => (
            <div key={s.label} className={cn('rounded-xl border px-3 py-3', s.bg, s.border)}>
              <div className={cn('mb-1.5', s.color)}>{s.icon}</div>
              <p className={cn('text-xl font-bold leading-none', s.color)}>
                {s.value}
                <span className="text-[10px] font-normal ml-1">{unit}</span>
              </p>
              <p className="text-[10px] font-semibold text-gray-500 mt-1 leading-tight">{s.label}</p>
              <p className="text-[9px] text-gray-400 leading-tight mt-0.5">{s.note}</p>
            </div>
          ))}
        </div>

        {/* ── Net expected strip ───────────────────────────────────────── */}
        <div className="mx-6 mt-3 rounded-xl bg-[#E05540]/8 border border-[#E05540]/15 px-4 py-3 flex items-center gap-3">
          <ArrowDownToLine size={16} className="text-[#E05540] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#E05540]/70">Net Expected Stock</p>
            <p className="text-xs text-gray-500 mt-0.5">
              On-hand <span className="font-semibold text-[#1B3550]">{onHand.value}</span>
              {' '}+{' '}Inbound <span className="font-semibold text-green-600">{transitIn.value}</span>
              {' '}={' '}
              <span className="font-bold text-[#E05540]">{netExpected.value} {unit}</span>
            </p>
          </div>
        </div>

        {/* ── Material stock status ────────────────────────────────────── */}
        <div className="px-6 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Package size={12} className="text-gray-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Material Stock Status</p>
            {!matsLoading && sortedMaterials.length > 0 && (
              <span className="text-[9px] font-semibold bg-[#0D1F2D]/10 text-[#0D1F2D] px-2 py-0.5 rounded-full">
                {sortedMaterials.length}
              </span>
            )}
          </div>

          {matsLoading ? (
            <div className="space-y-1.5">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
            </div>
          ) : sortedMaterials.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">No materials at this plant</p>
          ) : (
            <div className="space-y-1.5">
              {sortedMaterials.map(mat => {
                const status = matStatus(mat.closing_stock_mt, mat.material_id, mat.ever_stocked);
                const style  = MAT_STYLE[status];
                const qty    = convertQty(mat.closing_stock_mt, scale);
                return (
                  <div
                    key={mat.material_id}
                    className={cn('flex items-center justify-between border rounded-lg px-3 py-2.5', style.bg, style.border)}
                  >
                    <div className="min-w-0 flex-1">
                      <span className={cn('font-mono text-[10px] font-semibold', style.idCls)}>
                        {mat.material_id}
                      </span>
                      <p className="text-xs text-gray-700 font-medium truncate leading-tight mt-0.5">
                        {mat.material_description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                      {style.badge && (
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none', style.badgeCls)}>
                          {style.badge}
                        </span>
                      )}
                      <p className="text-xs font-bold text-gray-900">{qty.value}</p>
                      <p className="text-[9px] text-gray-400">{qty.unit}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Stock transfers (where to where) ────────────────────────── */}
        {(txLoading || outgoing.length > 0 || incoming.length > 0) && (
          <div className="px-6 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowLeftRight size={12} className="text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stock Transfers</p>
            </div>

            {txLoading ? (
              <div className="space-y-1.5">
                {[0, 1].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-3">

                {/* Outbound — this plant sends TO */}
                {outgoing.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500 mb-1.5">
                      Sending OUT ({outgoing.length})
                    </p>
                    <div className="space-y-1.5">
                      {outgoing.map((t, i) => {
                        const qty = convertQty(t.quantity, scale);
                        return (
                          <div key={i} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold text-amber-700">{t.source_plant_id}</span>
                                <span className="text-[10px] text-amber-400">→</span>
                                <span className="font-mono text-[10px] font-bold text-amber-700">{t.dest_plant_id}</span>
                              </div>
                              <p className="text-[10px] text-gray-500 truncate mt-0.5">{t.dest_plant_name}</p>
                              <p className="text-[9px] text-gray-400 truncate mt-0.5">
                                <span className="font-mono">{t.material_id}</span>
                                {t.material_description && <> · {t.material_description}</>}
                              </p>
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <p className="text-xs font-bold text-amber-700">{qty.value}</p>
                              <p className="text-[9px] text-gray-400">{qty.unit}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Inbound — arriving TO this plant */}
                {incoming.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-green-600 mb-1.5">
                      Receiving IN ({incoming.length})
                    </p>
                    <div className="space-y-1.5">
                      {incoming.map((t, i) => {
                        const qty = convertQty(t.quantity, scale);
                        return (
                          <div key={i} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold text-green-700">{t.source_plant_id}</span>
                                <span className="text-[10px] text-green-400">→</span>
                                <span className="font-mono text-[10px] font-bold text-green-700">{t.dest_plant_id}</span>
                              </div>
                              <p className="text-[10px] text-gray-500 truncate mt-0.5">{t.source_plant_name}</p>
                              <p className="text-[9px] text-gray-400 truncate mt-0.5">
                                <span className="font-mono">{t.material_id}</span>
                                {t.material_description && <> · {t.material_description}</>}
                              </p>
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <p className="text-xs font-bold text-green-700">{qty.value}</p>
                              <p className="text-[9px] text-gray-400">{qty.unit}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-6 py-3 mt-4 border-t border-gray-100 bg-gray-50">
          <p className="text-[10px] text-gray-400">
            Data sourced from SAP material ledger · EB = ending balance · BV rows = physical transfer
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────

export function PlantInventoryTable({ summary, isLoading, unitScale, zeroStockMode = 'accurate', settingsMode, onModeChange, hasPlantFilter = false }: Props) {
  const scale = unitScale ?? { unit: 'MT' as const, bagsPerMt: 1 };
  const unit  = scale.unit;

  const [selectedRow,      setSelectedRow]      = useState<PlantInventoryRow | null>(null);
  const [hideZeros,        setHideZeros]        = useLocalStorage<boolean>('insee_dashboard_hide_zeros', true);
  const [showAlertsOnly,   setShowAlertsOnly]   = useLocalStorage<boolean>('insee_dashboard_show_alerts_only', true);
  const [sortCol,          setSortCol]          = useState<'on_hand_mt' | 'in_transit_out_mt' | 'in_transit_in_mt' | null>(null);
  const [sortDir,          setSortDir]          = useState<'asc' | 'desc'>('desc');

  const isOverridden = settingsMode !== undefined && zeroStockMode !== settingsMode;

  function toggleMode() {
    if (!onModeChange) return;
    onModeChange(zeroStockMode === 'accurate' ? 'active_only' : 'accurate');
  }

  function resetToSettings() {
    onModeChange?.(settingsMode ?? 'accurate');
  }

  const allRows         = summary?.rows ?? [];
  const zeroRows        = allRows.filter(r => r.on_hand_mt === 0 && r.in_transit_out_mt === 0 && r.in_transit_in_mt === 0);
  const alertRows       = allRows.filter(r => r.status === 'low' || r.status === 'out');
  // An explicit plant selection is authoritative — show every plant the user
  // picked, unconditionally. The hide-zero / alerts-only toggles only declutter
  // the default "All Plants" view.
  const afterZeroFilter = (hideZeros && !hasPlantFilter) ? allRows.filter(r => !(r.on_hand_mt === 0 && r.in_transit_out_mt === 0 && r.in_transit_in_mt === 0)) : allRows;
  const afterAlertFilter = (showAlertsOnly && !hasPlantFilter) ? afterZeroFilter.filter(r => r.status === 'low' || r.status === 'out') : afterZeroFilter;
  const visibleRows     = sortCol
    ? [...afterAlertFilter].sort((a, b) => sortDir === 'asc' ? a[sortCol] - b[sortCol] : b[sortCol] - a[sortCol])
    : afterAlertFilter;

  function handleSort(col: 'on_hand_mt' | 'in_transit_out_mt' | 'in_transit_in_mt') {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  function SortIcon({ col }: { col: 'on_hand_mt' | 'in_transit_out_mt' | 'in_transit_in_mt' }) {
    if (sortCol !== col) return <ChevronsUpDown size={10} className="text-gray-300" />;
    return sortDir === 'asc' ? <ChevronUp size={10} className="text-[#1B3550]" /> : <ChevronDown size={10} className="text-[#1B3550]" />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Per-Plant Inventory Status</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Available Stock = closing balance (EB) · In-Transit = transfer movements (BV rows) · Click a row for details
            </p>
          </div>
          {hasPlantFilter ? (
            <span className="shrink-0 text-[10px] font-semibold text-gray-400 px-3 py-1.5">
              Showing all {allRows.length} selected plant{allRows.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <button
              onClick={() => setHideZeros(!hideZeros)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150',
                hideZeros
                  ? 'bg-[#2E6B8A] text-white border-[#2E6B8A]'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
              )}
            >
              {hideZeros ? 'Showing active' : 'Show active only'}
              {hideZeros && zeroRows.length > 0 && (
                <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {zeroRows.length} hidden
                </span>
              )}
            </button>
          )}
        </div>

        {/* ── Alert mode override button ──────────────────────────────── */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleMode}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150',
              zeroStockMode === 'accurate'
                ? 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
            )}
          >
            <Info size={11} />
            {zeroStockMode === 'accurate'
              ? 'Alert mode: Active plants only — ignoring materials never stocked at each plant'
              : 'Alert mode: Ignore zero stock — only flagging plants with stock > 0 but below threshold'}
          </button>
          {isOverridden && (
            <button
              onClick={resetToSettings}
              className="text-[10px] text-gray-400 hover:text-gray-600 underline"
            >
              Reset to Settings default
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Plant inventory table">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap text-left">Plant</th>
              <th className="py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap text-left">Location</th>
              {(
                [
                  { label: 'Available Stock', col: 'on_hand_mt'        },
                  { label: 'In Transit OUT',  col: 'in_transit_out_mt' },
                  { label: 'In Transit IN',   col: 'in_transit_in_mt'  },
                ] as const
              ).map(({ label, col }) => (
                <th key={col} className="py-2.5 px-4 text-right whitespace-nowrap">
                  <button
                    onClick={() => handleSort(col)}
                    className={cn(
                      'inline-flex items-center justify-end gap-1 font-semibold uppercase tracking-wide text-[10px] transition-colors',
                      sortCol === col ? 'text-[#1B3550]' : 'text-gray-500 hover:text-gray-800',
                    )}
                  >
                    {label}
                    <SortIcon col={col} />
                  </button>
                </th>
              ))}
              <th className="py-2.5 px-4 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap">Status</span>
                  {!hasPlantFilter && (
                  <button
                    onClick={() => setShowAlertsOnly(!showAlertsOnly)}
                    title={showAlertsOnly ? 'Showing low & out only — click to clear' : 'Show only low & out stock plants'}
                    className={cn(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border transition-all duration-150',
                      showAlertsOnly
                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                        : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200 hover:text-gray-600',
                    )}
                  >
                    ⚠
                    {showAlertsOnly && alertRows.length > 0 && (
                      <span className="bg-amber-200 text-amber-800 text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
                        {alertRows.length}
                      </span>
                    )}
                  </button>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-full" /></td>
                ))}
              </tr>
            ))}

            {!isLoading && visibleRows.length === 0 && (
              <tr><td colSpan={6}><EmptyState /></td></tr>
            )}

            {!isLoading && visibleRows.map((row) => (
              <tr
                key={row.plant_id}
                onClick={() => setSelectedRow(row)}
                className={cn(
                  'border-b border-gray-50 transition-colors cursor-pointer',
                  row.status === 'out' ? 'bg-red-50/50 hover:bg-red-100/60' :
                  row.status === 'low' ? 'bg-amber-50/40 hover:bg-amber-100/50' :
                  'hover:bg-[#0D1F2D]/5',
                )}
              >
                <td className="px-4 py-3 font-mono text-gray-700 font-semibold">{row.plant_id}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-800 font-medium truncate max-w-[180px]">{row.plant_name}</p>
                  {row.city && <p className="text-gray-400 text-[10px]">{row.city}</p>}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  {convertQty(row.on_hand_mt, scale).value}
                  <span className="text-[10px] font-normal text-gray-400 ml-1">{unit}</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-amber-700">
                  {row.in_transit_out_mt > 0
                    ? <>{convertQty(row.in_transit_out_mt, scale).value} <span className="text-[10px] font-normal text-amber-500">{unit}</span></>
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-green-700">
                  {row.in_transit_in_mt > 0
                    ? <>{convertQty(row.in_transit_in_mt, scale).value} <span className="text-[10px] font-normal text-green-500">{unit}</span></>
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={row.status} lowCount={row.low_count} outCount={row.out_count} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex gap-6 text-xs text-gray-500">
          <span>Total Available Stock: <strong className="text-gray-900">{convertQty(summary.total_on_hand_mt, scale).value} {unit}</strong></span>
          <span>In Transit OUT: <strong className="text-amber-700">{convertQty(summary.total_in_transit_out, scale).value} {unit}</strong></span>
          <span>In Transit IN: <strong className="text-green-700">{convertQty(summary.total_in_transit_in, scale).value} {unit}</strong></span>
        </div>
      )}

      {/* ── Row detail modal ─────────────────────────────────────────── */}
      {selectedRow && (
        <PlantDetailModal
          row={selectedRow}
          scale={scale}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  );
}
