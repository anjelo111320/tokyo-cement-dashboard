import { useState, useMemo, useEffect } from 'react';
import { ArrowRight, PackageCheck, PackageX, Search, X, ChevronUp, ChevronDown, Package, Truck, Warehouse, ReceiptText } from 'lucide-react';
import { PageHeader }        from '@/components/common/PageHeader';
import { cn }                from '@/utils/cn';
import { useLedgerTransfers } from './hooks/useLedger';
import type { StockTransferRow } from '@/types/material_ledger.types';

// ── Filter state ──────────────────────────────────────────────────────────────

type StockFilter  = 'all' | 'in_stock' | 'no_stock';
type SortKey      = 'route' | 'material' | 'qty' | 'dest_stock';
type SortDir      = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortName(name: string): string {
  // Trim long SAP plant names for display: take last 2 words
  const words = name.split(' ');
  return words.length > 3 ? words.slice(-2).join(' ') : name;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// ── Sort header button ────────────────────────────────────────────────────────

function SortTh({
  label, colKey, current, dir, onSort,
}: {
  label: string;
  colKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === colKey;
  return (
    <th
      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer select-none whitespace-nowrap"
      onClick={() => onSort(colKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col gap-0 opacity-50">
          <ChevronUp  size={9} className={active && dir === 'asc'  ? 'opacity-100 text-[#1B3550]' : ''} />
          <ChevronDown size={9} className={active && dir === 'desc' ? 'opacity-100 text-[#1B3550]' : ''} />
        </span>
      </span>
    </th>
  );
}

// ── Transfer detail modal ─────────────────────────────────────────────────────

function TransferDetailModal({
  transfer,
  onClose,
}: {
  transfer: StockTransferRow;
  onClose:  () => void;
}) {
  const hasStock = transfer.dest_closing_stock > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="bg-[#0D1F2D] px-6 pt-5 pb-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Material */}
          <div className="flex items-center gap-2 mb-3">
            <Package size={14} className="text-[#E05540] shrink-0" />
            <span className="font-mono text-[11px] font-bold text-[#E05540] tracking-wider">
              {transfer.material_id}
            </span>
          </div>
          <p className="text-white font-bold text-base leading-snug pr-6">
            {transfer.material_description}
          </p>

          {/* Route arrow */}
          <div className="mt-4 flex items-center gap-3">
            {/* Source */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1">From</p>
              <p className="font-mono text-lg font-bold text-white leading-none">{transfer.source_plant_id}</p>
              <p className="text-white/70 text-xs font-medium mt-1 leading-snug">{transfer.source_plant_name}</p>
            </div>

            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <Truck size={16} className="text-[#E05540]" />
              <div className="w-12 h-px bg-[#E05540]/40" />
            </div>

            {/* Destination */}
            <div className="flex-1 min-w-0 text-right">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1">To</p>
              <p className="font-mono text-lg font-bold text-white leading-none">{transfer.dest_plant_id}</p>
              <p className="text-white/70 text-xs font-medium mt-1 leading-snug">{transfer.dest_plant_name}</p>
            </div>
          </div>
        </div>

        {/* ── Stat row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 px-6 py-5">

          {/* Transfer quantity */}
          <div className="bg-[#E05540]/8 border border-[#E05540]/15 rounded-xl px-4 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowRight size={13} className="text-[#E05540]" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#E05540]/70">
                Transfer Qty
              </p>
            </div>
            <p className="text-2xl font-bold text-[#1B3550] leading-none">
              {fmt(transfer.quantity)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">{transfer.unit}</p>
          </div>

          {/* Destination closing stock */}
          <div className={cn(
            'border rounded-xl px-4 py-4',
            hasStock ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100',
          )}>
            <div className="flex items-center gap-1.5 mb-2">
              <Warehouse size={13} className={hasStock ? 'text-green-600' : 'text-[#E05540]'} />
              <p className={cn(
                'text-[10px] font-bold uppercase tracking-widest',
                hasStock ? 'text-green-600/70' : 'text-[#E05540]/70',
              )}>
                Dest Stock
              </p>
            </div>
            <p className={cn(
              'text-2xl font-bold leading-none',
              hasStock ? 'text-green-700' : 'text-gray-300',
            )}>
              {fmt(transfer.dest_closing_stock)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">{transfer.unit}</p>
          </div>
        </div>

        {/* ── Status + price strip ─────────────────────────────────────── */}
        <div className="px-6 pb-5 flex items-center justify-between">
          {hasStock ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
              <PackageCheck size={12} /> In Stock at Destination
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-[#E05540] text-xs font-bold">
              <PackageX size={12} /> No Stock at Destination
            </span>
          )}

          {transfer.price_lkr != null && (
            <div className="text-right">
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">Price</p>
              <p className="text-sm font-bold text-gray-700">
                {transfer.price_lkr.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-6 py-3 border-t border-gray-100 bg-gray-50">
          <ReceiptText size={11} className="text-gray-400 shrink-0" />
          <p className="text-[10px] text-gray-400">
            Inter-plant stock transfer · VM · VN movement row · closing stock at destination plant
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MaterialLedgerPage() {
  const { data: transferData, isLoading } = useLedgerTransfers();

  const transfers: StockTransferRow[] = transferData?.transfers ?? [];

  // ── Filter state
  const [search,      setSearch]      = useState('');
  const [fromPlant,   setFromPlant]   = useState('');
  const [toPlant,     setToPlant]     = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortKey,     setSortKey]     = useState<SortKey>('route');
  const [sortDir,     setSortDir]     = useState<SortDir>('asc');
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransferRow | null>(null);

  // Build plant lists from actual transfer data
  const sourcePlants = useMemo(() => {
    const seen = new Map<string, string>();
    transfers.forEach(t => seen.set(t.source_plant_id, t.source_plant_name));
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [transfers]);

  const destPlants = useMemo(() => {
    const seen = new Map<string, string>();
    transfers.forEach(t => seen.set(t.dest_plant_id, t.dest_plant_name));
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [transfers]);

  // ── Apply filters + sort
  const filtered = useMemo(() => {
    let rows = transfers.filter(t => {
      if (fromPlant && t.source_plant_id !== fromPlant) return false;
      if (toPlant   && t.dest_plant_id   !== toPlant)   return false;
      if (stockFilter === 'in_stock' && t.dest_closing_stock <= 0) return false;
      if (stockFilter === 'no_stock' && t.dest_closing_stock >  0) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.material_description.toLowerCase().includes(q) ||
          t.material_id.includes(q) ||
          t.source_plant_name.toLowerCase().includes(q) ||
          t.dest_plant_name.toLowerCase().includes(q) ||
          t.source_plant_id.includes(q) ||
          t.dest_plant_id.includes(q)
        );
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      let v = 0;
      switch (sortKey) {
        case 'route':    v = `${a.source_plant_id}${a.dest_plant_id}`.localeCompare(`${b.source_plant_id}${b.dest_plant_id}`); break;
        case 'material': v = a.material_description.localeCompare(b.material_description); break;
        case 'qty':      v = a.quantity - b.quantity; break;
        case 'dest_stock': v = a.dest_closing_stock - b.dest_closing_stock; break;
      }
      return sortDir === 'asc' ? v : -v;
    });

    return rows;
  }, [transfers, fromPlant, toPlant, stockFilter, search, sortKey, sortDir]);

  // ── Summary stats
  const totalQty     = filtered.reduce((s, t) => s + t.quantity, 0);
  const inStockCount = filtered.filter(t => t.dest_closing_stock > 0).length;
  const noStockCount = filtered.length - inStockCount;
  const uniqueRoutes = new Set(filtered.map(t => `${t.source_plant_id}_${t.dest_plant_id}`)).size;

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function clearFilters() {
    setSearch(''); setFromPlant(''); setToPlant(''); setStockFilter('all');
  }

  const hasFilters = search || fromPlant || toPlant || stockFilter !== 'all';

  return (
    <div className="p-4 lg:p-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Transit Report"
        subtitle="Stock transfers between plants — where materials are moving, quantities, and destination stock status"
      />

      {/* ── Summary KPI strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Transfer Lines',    value: filtered.length,             color: 'text-[#1B3550]' },
          { label: 'Unique Routes',     value: uniqueRoutes,                color: 'text-[#2563EB]' },
          { label: 'Total Qty (MT)',    value: fmt(totalQty),               color: 'text-[#E05540]' },
          { label: 'In Stock at Dest',  value: `${inStockCount} / ${filtered.length}`, color: 'text-[#16A34A]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 mb-4 flex flex-wrap gap-3 items-end">

        {/* Search */}
        <div className="relative flex-1 min-w-45">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search material, plant…"
            className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-gray-200 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2E6B8A]/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* From plant */}
        <div className="min-w-40">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">From</p>
          <select
            value={fromPlant}
            onChange={e => setFromPlant(e.target.value)}
            className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2E6B8A]/30"
          >
            <option value="">All sources</option>
            {sourcePlants.map(([id, name]) => (
              <option key={id} value={id}>{id} — {shortName(name)}</option>
            ))}
          </select>
        </div>

        {/* To plant */}
        <div className="min-w-40">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">To</p>
          <select
            value={toPlant}
            onChange={e => setToPlant(e.target.value)}
            className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2E6B8A]/30"
          >
            <option value="">All destinations</option>
            {destPlants.map(([id, name]) => (
              <option key={id} value={id}>{id} — {shortName(name)}</option>
            ))}
          </select>
        </div>

        {/* Stock status toggle */}
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Dest Stock</p>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(['all', 'in_stock', 'no_stock'] as StockFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setStockFilter(f)}
                className={cn(
                  'px-3 py-1.5 font-semibold transition-colors',
                  stockFilter === f
                    ? f === 'in_stock' ? 'bg-[#16A34A] text-white'
                    : f === 'no_stock' ? 'bg-[#E05540] text-white'
                    : 'bg-[#1B3550] text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50',
                )}
              >
                {f === 'all' ? 'All' : f === 'in_stock' ? 'In Stock' : 'No Stock'}
              </button>
            ))}
          </div>
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-gray-400 hover:text-gray-600 underline self-end pb-1.5"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Transfer detail modal ──────────────────────────────────────── */}
      {selectedTransfer && (
        <TransferDetailModal
          transfer={selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
        />
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading transfers…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No transfers match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <SortTh label="From → To"         colKey="route"      current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Material"           colKey="material"   current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Transfer Qty (MT)"  colKey="qty"        current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Dest Stock (MT)"    colKey="dest_stock" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((t, i) => {
                  const hasStock = t.dest_closing_stock > 0;
                  return (
                    <tr
                      key={i}
                      onClick={() => setSelectedTransfer(t)}
                      className="hover:bg-[#0D1F2D]/5 transition-colors cursor-pointer"
                    >

                      {/* From → To */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-center">
                            <p className="text-[10px] font-mono font-bold text-gray-500">{t.source_plant_id}</p>
                            <p className="text-xs font-semibold text-[#1B3550] leading-tight max-w-25 truncate">
                              {shortName(t.source_plant_name)}
                            </p>
                          </div>
                          <ArrowRight size={14} className="text-[#E05540] shrink-0" />
                          <div className="text-center">
                            <p className="text-[10px] font-mono font-bold text-gray-500">{t.dest_plant_id}</p>
                            <p className="text-xs font-semibold text-[#1B3550] leading-tight max-w-25 truncate">
                              {shortName(t.dest_plant_name)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Material */}
                      <td className="px-4 py-3 max-w-50">
                        <p className="text-xs font-medium text-gray-800 leading-tight">{t.material_description}</p>
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5">{t.material_id}</p>
                      </td>

                      {/* Transfer qty */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-[#E05540]">{fmt(t.quantity)}</span>
                        <span className="text-[10px] text-gray-400 ml-1">{t.unit}</span>
                      </td>

                      {/* Dest closing stock */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-sm font-bold',
                          hasStock ? 'text-[#16A34A]' : 'text-gray-300',
                        )}>
                          {fmt(t.dest_closing_stock)}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-1">{t.unit}</span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        {hasStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-[#16A34A] text-[10px] font-bold">
                            <PackageCheck size={10} />
                            In Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-[#E05540] text-[10px] font-bold">
                            <PackageX size={10} />
                            No Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer row */}
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
              <p className="text-[10px] text-gray-400">
                {filtered.length} transfer{filtered.length !== 1 ? 's' : ''} shown
                {hasFilters && ` (filtered from ${transfers.length})`}
                {' · '}Click a row for full details
              </p>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1 text-[#16A34A] font-semibold">
                  <PackageCheck size={10} /> {inStockCount} in stock
                </span>
                <span className="flex items-center gap-1 text-[#E05540] font-semibold">
                  <PackageX size={10} /> {noStockCount} no stock
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
