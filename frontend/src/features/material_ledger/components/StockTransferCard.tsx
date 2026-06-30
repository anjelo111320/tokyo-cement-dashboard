import { ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useLedgerTransfers } from '../hooks/useLedger';
import { formatNumber } from '@/utils/formatters';

interface Props { plantId?: string; materialId?: string }

export function StockTransferCard({ plantId, materialId }: Props) {
  const { data, isLoading, isError, refetch } = useLedgerTransfers(plantId, materialId);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Stock Transfer Notes</h3>
          <p className="text-xs text-gray-400 mt-0.5">Inter-plant movements from VM · VN rows</p>
        </div>
        {data && data.transfers.length > 0 && (
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2.5 py-1">
            {data.transfers.length} transfer{data.transfers.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {isError && <ErrorState message="Failed to load transfer notes" onRetry={refetch} />}

      {!isLoading && !isError && data?.transfers.length === 0 && (
        <EmptyState />
      )}

      {!isLoading && !isError && data && data.transfers.length > 0 && (
        <div className="space-y-2">
          {data.transfers.map((t, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100"
            >
              {/* Source */}
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#0D1F2D] truncate">
                  {t.source_plant_name}
                </p>
                <p className="text-[10px] text-gray-400">{t.source_plant_id}</p>
              </div>

              <ArrowRight size={14} className="shrink-0 text-[#E05540]" />

              {/* Destination */}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-gray-700 truncate">
                  {t.dest_plant_name}
                </p>
                <p className="text-[10px] text-gray-400">{t.dest_plant_id}</p>
              </div>

              {/* Quantity + Price */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900">
                  {formatNumber(t.quantity, 3)} <span className="text-[10px] font-normal text-gray-400">{t.unit}</span>
                </p>
                {t.price_lkr != null && (
                  <p className="text-[10px] text-gray-400">Price: {formatNumber(t.price_lkr, 0)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
