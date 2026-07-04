import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Plus, Check, PackageCheck, Package } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { LedgerMaterial, BrandGroupOption } from '@/types/material_ledger.types';
import { useBrandGroups } from '@/features/material_ledger/hooks/useLedger';

const CHIP_COLORS = [
  '#1B3550', '#2563EB', '#16A34A', '#DC2626',
  '#F59E0B', '#7C3AED', '#0891B2', '#BE185D',
];

// ── Category helpers ──────────────────────────────────────────────────────────

type CategoryFilter = 'all' | 'bulk' | 'bags';

const isBulk = (desc: string) => desc.toLowerCase().includes('bulk');
const isBags = (desc: string) => /50\s*kg/i.test(desc);

function matchesCategory(desc: string, cat: CategoryFilter): boolean {
  if (cat === 'all')  return true;
  if (cat === 'bulk') return isBulk(desc);
  return isBags(desc);
}

// ── Brand grouping ────────────────────────────────────────────────────────────
// Groups by the admin-managed Material.brand_group field (set in the admin
// panel's Materials tab) — NOT a text guess — so renaming/regrouping a
// material there is reflected here immediately. Materials with no group
// assigned fall into "Unassigned" at the end.

interface BrandGroup {
  id:        string | null;
  label:     string;
  materials: LedgerMaterial[];
}

function buildBrandGroups(materials: LedgerMaterial[], options: BrandGroupOption[]): BrandGroup[] {
  const labelById = new Map(options.map(o => [o.id, o.label]));
  const orderById = new Map(options.map(o => [o.id, o.sort_order]));
  const map = new Map<string | null, LedgerMaterial[]>();
  materials.forEach(m => {
    const key = m.brand_group ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  });
  return Array.from(map.entries())
    .map(([id, mats]) => ({ id, label: id ? (labelById.get(id) ?? id) : 'Unassigned', materials: mats }))
    .sort((a, b) => {
      if (a.id === null) return 1;   // Unassigned always last
      if (b.id === null) return -1;
      return (orderById.get(a.id) ?? 999) - (orderById.get(b.id) ?? 999);
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  materials: LedgerMaterial[];
  selected:  string[];
  onChange:  (ids: string[]) => void;
}

export function MultiMaterialPicker({ materials, selected, onChange }: Props) {
  const [open,           setOpen]           = useState(false);
  const [inStockOnly,    setInStockOnly]    = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const { data: brandGroupOptions = [] } = useBrandGroups();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Counts per category (for button labels)
  const bulkCount = materials.filter(m => isBulk(m.material_description)).length;
  const bagsCount = materials.filter(m => isBags(m.material_description)).length;

  // Materials narrowed by the active category, then by in-stock toggle
  const byCategory     = materials.filter(m => matchesCategory(m.material_description, categoryFilter));
  const visibleMaterials = inStockOnly
    ? byCategory.filter(m => m.closing_stock_mt > 0)
    : byCategory;
  const inStockCount   = byCategory.filter(m => m.closing_stock_mt > 0).length;

  const groups = buildBrandGroups(visibleMaterials, brandGroupOptions);

  // ── Handlers ────────────────────────────────────────────────────────────────

  // Category buttons only narrow the picker list — they never touch the selection.
  function selectCategory(cat: CategoryFilter) {
    setCategoryFilter(cat);
    setOpen(true); // open the dropdown so the user can see the filtered list
  }

  function clearAll() {
    onChange([]);
  }

  // Adds all currently visible materials (respects category + in-stock filters).
  function selectAll() {
    const visibleIds = visibleMaterials.map(m => m.material_id);
    const missing    = visibleIds.filter(id => !selected.includes(id));
    if (missing.length > 0) onChange([...selected, ...missing]);
  }

  function colorFor(id: string): string {
    const idx = materials.findIndex(m => m.material_id === id);
    return CHIP_COLORS[idx % CHIP_COLORS.length];
  }

  function labelFor(id: string): string {
    return materials.find(m => m.material_id === id)?.material_description ?? id;
  }

  function toggle(id: string) {
    onChange(selected.includes(id)
      ? selected.filter(s => s !== id)
      : [...selected, id]);
  }

  function toggleBrand(group: BrandGroup) {
    const ids = group.materials.map(m => m.material_id);
    const allSelected = ids.every(id => selected.includes(id));
    if (allSelected) {
      onChange(selected.filter(id => !ids.includes(id)));
    } else {
      const missing = ids.filter(id => !selected.includes(id));
      onChange([...selected, ...missing]);
    }
  }

  function isBrandFullySelected(group: BrandGroup) {
    return group.materials.every(m => selected.includes(m.material_id));
  }

  function isBrandPartiallySelected(group: BrandGroup) {
    return !isBrandFullySelected(group) &&
      group.materials.some(m => selected.includes(m.material_id));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div ref={ref} className="relative">

      {/* ── Category quick-filter buttons ──────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {([
          { id: 'all'  as CategoryFilter, label: 'All Materials', count: null         },
          { id: 'bulk' as CategoryFilter, label: 'Bulk',          count: bulkCount    },
          { id: 'bags' as CategoryFilter, label: 'Bags',          count: bagsCount    },
        ]).map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => selectCategory(id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5',
              categoryFilter === id
                ? 'bg-[#1B3550] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {label}
            {count !== null && (
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none',
                categoryFilter === id
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-500',
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Selected chips + open button ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-9">
        {selected.length === 0 && (
          <span className="text-xs text-gray-400 italic">All Materials</span>
        )}
        {selected.map((id) => (
          <span key={id}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: colorFor(id) }}>
            {labelFor(id)}
            <button onClick={() => toggle(id)}
              className="hover:opacity-70 transition-opacity"
              aria-label={`Remove ${labelFor(id)}`}>
              <X size={11} />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
            open
              ? 'bg-[#1B3550] text-white border-[#1B3550]'
              : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
          )}>
          <Plus size={11} />
          {selected.length === 0 ? 'Filter materials' : 'Add'}
          <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
        {selected.length > 0 && (
          <button onClick={clearAll}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline">
            Clear all
          </button>
        )}
      </div>

      {/* ── Dropdown ────────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-80 overflow-hidden">

          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {categoryFilter === 'all'  ? 'Filter by Material / Brand'
             : categoryFilter === 'bulk' ? 'Bulk Materials'
             :                             'Bag Materials (50 kg)'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-[10px] font-semibold text-[#1B3550] hover:text-[#0D1F2D] transition-colors"
              >
                Select all
              </button>
              {selected.length > 0 && (
                <>
                  <span className="text-gray-200 text-[10px]">·</span>
                  <button onClick={clearAll} className="text-[10px] text-red-400 hover:text-red-600">
                    Clear all
                  </button>
                </>
              )}
            </div>
          </div>

          {/* In-stock toggle */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              {inStockOnly
                ? <PackageCheck size={13} className="text-[#16A34A]" />
                : <Package size={13} className="text-gray-400" />}
              <span className="text-xs font-medium text-gray-700">
                {inStockOnly ? 'In-stock only' : 'All'}
              </span>
              <span className="text-[10px] text-gray-400">
                ({inStockOnly ? inStockCount : byCategory.length})
              </span>
            </div>
            <button
              onClick={() => setInStockOnly(v => !v)}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                'transition-colors duration-200 ease-in-out focus:outline-none',
                inStockOnly ? 'bg-[#16A34A]' : 'bg-gray-200',
              )}
              role="switch"
              aria-checked={inStockOnly}
            >
              <span className={cn(
                'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0',
                'transition duration-200 ease-in-out',
                inStockOnly ? 'translate-x-4' : 'translate-x-0',
              )} />
            </button>
          </div>

          {groups.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-400 text-center">
              No materials with stock at selected plants
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {groups.map((group) => {
                const allSel  = isBrandFullySelected(group);
                const partSel = isBrandPartiallySelected(group);

                return (
                  <li key={group.id ?? '__unassigned__'}>
                    {/* Brand group header */}
                    <button
                      onClick={() => toggleBrand(group)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left border-b border-gray-100"
                    >
                      <span className={cn(
                        'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center',
                        allSel  ? 'bg-[#1B3550] border-[#1B3550]' :
                        partSel ? 'bg-[#1B3550]/30 border-[#1B3550]' :
                                  'border-gray-300',
                      )}>
                        {allSel  && <Check size={10} className="text-white" />}
                        {partSel && <span className="w-2 h-0.5 bg-[#1B3550] rounded" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800">{group.label}</p>
                        <p className="text-[10px] text-gray-400">
                          {group.materials.length} variant{group.materials.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-[9px] text-gray-400 shrink-0">
                        {allSel ? 'Deselect all' : 'Select all'}
                      </span>
                    </button>

                    {/* Individual materials */}
                    {group.materials.map((m) => {
                      const checked = selected.includes(m.material_id);
                      const color   = CHIP_COLORS[
                        materials.findIndex(x => x.material_id === m.material_id) % CHIP_COLORS.length
                      ];
                      const variantPart = m.material_description.includes(' - ')
                        ? m.material_description.split(' - ').slice(1).join(' - ')
                        : m.material_description;
                      const hasStock = m.closing_stock_mt > 0;

                      return (
                        <button key={m.material_id}
                          onClick={() => toggle(m.material_id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 pl-9 hover:bg-gray-50 transition-colors text-left">
                          <span className="w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center"
                            style={{
                              borderColor: color,
                              backgroundColor: checked ? color : 'transparent',
                            }}>
                            {checked && <Check size={9} className="text-white" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-700 truncate">{variantPart}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{m.material_id}</p>
                          </div>
                          {hasStock ? (
                            <span className="text-[9px] font-semibold text-[#16A34A] bg-green-50 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                              {m.closing_stock_mt.toLocaleString(undefined, { maximumFractionDigits: 1 })} MT
                            </span>
                          ) : (
                            <span className="text-[9px] text-gray-300 shrink-0">0 MT</span>
                          )}
                        </button>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
