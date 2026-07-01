/** PlantInventoryTable — per-plant inventory breakdown table. Alerts sort to top. */

import { useState, useEffect } from 'react';
import { X, Warehouse, TrendingDown, TrendingUp, ArrowDownToLine, Package, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { convertQty, type UnitScale } from '@/hooks/useSettingsStore';
import { useLedgerMaterials, useLedgerTransfers } from '@/features/material_ledger/hooks/useLedger';
import type { InventorySummary, PlantInventoryRow } from '@/types/material_ledger.types';

interface Props {
  summary:   InventorySummary | undefined;
  isLoading: boolean;
  unitScale?: UnitScale;
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ok:  { label: '● OK',   cls: 'bg-green-100 text-green-700' },
    low: { label: '⚠ Low', cls: 'bg-amber-100 text-amber-700' },
    out: { label: '✕ Out', cls: 'bg-red-100   text-red-700'   },
  };
  const { label, cls } = map[status] ?? map.ok;
  return (
    <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full', cls)}>
      {label}
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
  const stockedMaterials = rawMaterials.filter(m => m.closing_stock_mt > 0);

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

        {/* ── Available materials ──────────────────────────────────────── */}
        <div className="px-6 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Package size={12} className="text-gray-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Available Materials</p>
            {!matsLoading && stockedMaterials.length > 0 && (
              <span className="text-[9px] font-semibold bg-[#0D1F2D]/10 text-[#0D1F2D] px-2 py-0.5 rounded-full">
                {stockedMaterials.length}
              </span>
            )}
          </div>

          {matsLoading ? (
            <div className="space-y-1.5">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
            </div>
          ) : stockedMaterials.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">No stock at this plant</p>
          ) : (
            <div className="space-y-1.5">
              {stockedMaterials.map(mat => {
                const qty = convertQty(mat.closing_stock_mt, scale);
                return (
                  <div
                    key={mat.material_id}
                    className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[10px] font-semibold text-[#2E6B8A]">
                        {mat.material_id}
                      </span>
                      <p className="text-xs text-gray-700 font-medium truncate leading-tight mt-0.5">
                        {mat.material_description}
                      </p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
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

export function PlantInventoryTable({ summary, isLoading, unitScale }: Props) {
  const scale = unitScale ?? { unit: 'MT' as const, bagsPerMt: 1 };
  const unit  = scale.unit;

  const [selectedRow, setSelectedRow] = useState<PlantInventoryRow | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Per-Plant Inventory Status</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Available Stock = closing balance (EB) · In-Transit = transfer movements (BV rows) · Click a row for details
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Plant inventory table">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {(
                [
                  { label: 'Plant',           align: 'text-left'  },
                  { label: 'Location',        align: 'text-left'  },
                  { label: 'Available Stock', align: 'text-right' },
                  { label: 'In Transit OUT',  align: 'text-right' },
                  { label: 'In Transit IN',   align: 'text-right' },
                  { label: 'Status',          align: 'text-left'  },
                ] as const
              ).map(({ label, align }) => (
                <th key={label} className={cn('py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap', align)}>
                  {label}
                </th>
              ))}
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

            {!isLoading && (!summary || summary.rows.length === 0) && (
              <tr><td colSpan={6}><EmptyState /></td></tr>
            )}

            {!isLoading && summary?.rows.map((row) => (
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
                  <StatusPill status={row.status} />
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
