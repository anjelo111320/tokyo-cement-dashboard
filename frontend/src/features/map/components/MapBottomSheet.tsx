/**
 * MapBottomSheet — Mobile slide-up panel shown when a map marker is tapped.
 *
 * Displays plant identity (Plant ID, Customer Number), full address, a
 * Live Data / No Data pill, and — when ledger data exists — live KPI
 * analytics and a utilization rate progress bar.
 *
 * Drag the handle downward (> 80 px) or tap the backdrop to close.
 */

import { useRef, useState, useEffect } from 'react';
import { X, MapPin } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatNumber, calcUtilization } from '@/utils/formatters';
import { useLedgerKpis } from '@/features/material_ledger/hooks/useLedger';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { getPlantTypeInfo } from './plantTypeUtils';
import type { LedgerPlant } from '@/types/material_ledger.types';

export type SelectedMapItem = { type: 'plant'; data: LedgerPlant };

// ── Plant detail content ──────────────────────────────────────────────────────
function PlantContent({ plant }: { plant: LedgerPlant }) {
  const { Icon, iconColor, iconBg, typeLabel } = getPlantTypeInfo(plant.plant_id);
  const { data: kpis, isLoading: kpisLoading } = useLedgerKpis(plant.plant_id);

  const utilization = calcUtilization(
    kpis?.opening_stock_mt     ?? 0,
    kpis?.total_receipts_mt    ?? 0,
    kpis?.total_consumption_mt ?? 0,
  );

  return (
    <>
      {/* Header — icon, type label, data pill, name, address */}
      <div className="flex items-start gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: iconBg }}>
          <Icon size={20} style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{typeLabel}</p>
            <span className={cn(
              'text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0',
              plant.has_ledger_data ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
            )}>
              {plant.has_ledger_data ? 'Live Data' : 'No Data'}
            </span>
          </div>
          <h2 className="text-sm font-bold text-gray-900 leading-tight">{plant.name}</h2>
          <div className="flex items-start gap-1 mt-1.5">
            <MapPin size={11} className="text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-500 leading-snug">
              {[plant.address, plant.city, plant.postal_code, plant.country].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>
      </div>

      {/* Identity cards — Plant ID and Customer Number only */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Plant ID</p>
          <p className="text-base font-bold text-gray-900">{plant.plant_id}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Customer No.</p>
          <p className="text-base font-bold text-gray-900">{plant.customer_number ?? '—'}</p>
        </div>
      </div>

      {/* Analytics section — only shown for plants with ledger data */}
      {plant.has_ledger_data && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Ledger Analytics</p>

          {kpisLoading ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
              <Skeleton className="h-10 rounded-xl" />
            </div>
          ) : kpis ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: 'Opening Stock',     value: kpis.opening_stock_mt,     color: '#3D8BAD' },
                  { label: 'Total Receipts',    value: kpis.total_receipts_mt,    color: '#22C55E' },
                  { label: 'Total Consumption', value: kpis.total_consumption_mt, color: '#E05540' },
                  { label: 'Closing Stock',     value: kpis.closing_stock_mt,     color: '#1B3550' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-bold" style={{ color }}>
                      {formatNumber(value, 2)}
                      <span className="text-[10px] font-normal text-gray-400 ml-1">{kpis.unit}</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Utilization bar — green ≥80%, amber 50–79%, red <50% */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-gray-400">Utilization Rate</p>
                  <p className="text-xs font-bold" style={{
                    color: utilization >= 80 ? '#22C55E' : utilization >= 50 ? '#F59E0B' : '#E05540',
                  }}>
                    {formatNumber(utilization, 1)}%
                  </p>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${utilization}%`,
                      backgroundColor: utilization >= 80 ? '#22C55E' : utilization >= 50 ? '#F59E0B' : '#E05540',
                    }} />
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}

// ── Bottom sheet container ────────────────────────────────────────────────────
interface MapBottomSheetProps {
  item: SelectedMapItem | null;
  onClose: () => void;
}

export function MapBottomSheet({ item, onClose }: MapBottomSheetProps) {
  const isOpen = item !== null;
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => { if (!isOpen) setDragY(0); }, [isOpen]);
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn('fixed inset-0 bg-black/40 z-998 transition-opacity duration-300 lg:hidden',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}
        onClick={onClose} aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-999 bg-white rounded-t-2xl shadow-2xl lg:hidden"
        style={{
          transform: isOpen ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        role="dialog" aria-modal="true"
      >
        {/* Drag handle */}
        <div
          className="flex flex-col items-center pt-3 pb-2 cursor-grab select-none"
          onTouchStart={(e) => { startY.current = e.touches[0].clientY; setIsDragging(true); }}
          onTouchMove={(e)  => { if (!isDragging) return; const d = e.touches[0].clientY - startY.current; if (d > 0) setDragY(d); }}
          onTouchEnd={()    => { if (dragY > 80) onClose(); else setDragY(0); setIsDragging(false); }}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
          <p className="text-[10px] text-gray-400 mt-1.5">Swipe down to close</p>
        </div>

        {/* Close button */}
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200">
          <X size={14} />
        </button>

        <div className="overflow-y-auto px-5 pb-6" style={{ maxHeight: '75dvh' }}>
          {item?.type === 'plant' && <PlantContent plant={item.data} />}
        </div>
      </div>
    </>
  );
}
