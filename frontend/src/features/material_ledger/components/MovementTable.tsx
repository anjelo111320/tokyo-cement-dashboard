import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useLedgerMovements } from '../hooks/useLedger';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/utils/cn';

interface Props {
  plantId?: string;
  materialId?: string;
}

export function MovementTable({ plantId, materialId }: Props) {
  const [page, setPage] = useState(1);
  const [objType, setObjType] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();

  useEffect(() => { setPage(1); }, [plantId, materialId]);

  const { data: result, isLoading } = useLedgerMovements(plantId, materialId, objType, category, page);
  const items = result?.data ?? [];
  const pagination = result?.pagination;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Table header */}
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-900 flex-1">Movement Detail</h3>

        {/* Obj Type filter */}
        <select
          value={objType ?? ''}
          onChange={(e) => { setObjType(e.target.value || undefined); setPage(1); }}
          className="text-xs bg-gray-100 text-gray-700 border-0 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-primary-600"
          aria-label="Filter by object type"
        >
          <option value="">All Types</option>
          <option value="CA">CA — Stock Account</option>
          <option value="BV">BV — Goods Movement</option>
          <option value="VM">VM — Material Valuation</option>
        </select>

        {/* Category filter */}
        <select
          value={category ?? ''}
          onChange={(e) => { setCategory(e.target.value || undefined); setPage(1); }}
          className="text-xs bg-gray-100 text-gray-700 border-0 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-primary-600"
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          <option value="AB">AB — Beginning</option>
          <option value="ZU">ZU — Receipts</option>
          <option value="KB">KB — Cumulative</option>
          <option value="VN">VN — Consumption</option>
          <option value="EB">EB — Ending</option>
        </select>

        {pagination && (
          <span className="text-xs text-gray-400">{pagination.total_items} rows</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Material movement detail table">
          <thead>
            <tr className="border-b border-gray-100">
              {['Plant', 'Material', 'Type', 'Category', 'Movement', 'Proc. Cat.', 'Qty (MT)', 'Price'].map((h) => (
                <th key={h} className="text-left py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-full" /></td>
                ))}
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={8}><EmptyState /></td>
              </tr>
            )}
            {!isLoading && items.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-gray-700">{row.plant_id}</td>
                <td className="px-4 py-3 max-w-[160px] truncate text-gray-600" title={row.material_description}>
                  {row.material_description}
                </td>
                <td className="px-4 py-3">
                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{row.obj_type}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: row.category_color }}>
                    {row.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{row.movement_description}</td>
                <td className="px-4 py-3 text-gray-500">{row.proc_cat_label || '—'}</td>
                <td className={cn(
                  'px-4 py-3 font-semibold text-right',
                  row.quantity > 0 ? 'text-green-700' : 'text-gray-400',
                )}>
                  {formatNumber(row.quantity, 3)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {row.price != null && row.price !== 0 ? formatNumber(row.price, 0) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
              disabled={page === pagination.total_pages}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
