/**
 * PlantTransferActivity — shows incoming and outgoing stock transfers for a plant.
 * Used by both the desktop DesktopPlantDetail panel and the mobile MapBottomSheet.
 */

import { useMemo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { useLedgerTransfers } from '@/features/material_ledger/hooks/useLedger';

interface Props {
  plantId: string;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function PlantTransferActivity({ plantId }: Props) {
  const { data: transferData, isLoading } = useLedgerTransfers();

  const { outgoing, incoming } = useMemo(() => {
    const all = (transferData?.transfers ?? []).filter(
      t => t.source_plant_id !== t.dest_plant_id,
    );
    return {
      outgoing: all.filter(t => t.source_plant_id === plantId),
      incoming: all.filter(t => t.dest_plant_id   === plantId),
    };
  }, [transferData, plantId]);

  const hasAny = outgoing.length > 0 || incoming.length > 0;

  if (isLoading) {
    return (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
          Transfer Activity
        </p>
        <div className="space-y-1.5">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
          Transfer Activity
        </p>
        <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl">
          No active transfers for this plant
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
        Transfer Activity
      </p>

      <div className="space-y-3">

        {/* ── Outgoing ────────────────────────────────────────── */}
        {outgoing.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingDown size={11} className="text-amber-500 shrink-0" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500">
                Sending Out · {outgoing.length} line{outgoing.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-1.5">
              {outgoing.map((t, i) => (
                <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  {/* Route */}
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[10px] text-amber-500">To</span>
                    <span className="font-mono text-[10px] font-bold text-amber-700 ml-0.5">{t.dest_plant_id}</span>
                    <span className="text-[10px] text-amber-600/70 truncate flex-1 ml-1">{t.dest_plant_name}</span>
                  </div>
                  {/* Material + qty */}
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[9px] text-amber-600/60">{t.material_id} · </span>
                      <span className="text-[10px] text-gray-700 font-medium truncate">{t.material_description}</span>
                    </div>
                    <span className="text-xs font-bold text-amber-700 shrink-0">
                      {fmt(t.quantity)}
                      <span className="text-[9px] font-normal text-gray-400 ml-1">{t.unit}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Incoming ────────────────────────────────────────── */}
        {incoming.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp size={11} className="text-green-600 shrink-0" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-green-600">
                Receiving In · {incoming.length} line{incoming.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-1.5">
              {incoming.map((t, i) => (
                <div key={i} className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                  {/* Route */}
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[10px] text-green-600">From</span>
                    <span className="font-mono text-[10px] font-bold text-green-700 ml-0.5">{t.source_plant_id}</span>
                    <span className="text-[10px] text-green-700/60 truncate flex-1 ml-1">{t.source_plant_name}</span>
                  </div>
                  {/* Material + qty */}
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[9px] text-green-600/60">{t.material_id} · </span>
                      <span className="text-[10px] text-gray-700 font-medium truncate">{t.material_description}</span>
                    </div>
                    <span className="text-xs font-bold text-green-700 shrink-0">
                      {fmt(t.quantity)}
                      <span className="text-[9px] font-normal text-gray-400 ml-1">{t.unit}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
