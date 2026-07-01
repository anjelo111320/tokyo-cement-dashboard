import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Plus, Check, PackageCheck, Package } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { LedgerMaterial } from '@/types/material_ledger.types';

const CHIP_COLORS = [
  '#1B3550', '#2563EB', '#16A34A', '#DC2626',
  '#F59E0B', '#7C3AED', '#0891B2', '#BE185D',
];

function extractBrand(desc: string): string {
  const idx = desc.indexOf(' - ');
  return idx !== -1
    ? desc.slice(0, idx).toUpperCase().trim()
    : desc.toUpperCase().trim();
}

interface BrandGroup {
  brand:     string;
  materials: LedgerMaterial[];
}

function buildBrandGroups(materials: LedgerMaterial[]): BrandGroup[] {
  const map = new Map<string, LedgerMaterial[]>();
  materials.forEach(m => {
    const brand = extractBrand(m.material_description);
    if (!map.has(brand)) map.set(brand, []);
    map.get(brand)!.push(m);
  });
  return Array.from(map.entries()).map(([brand, mats]) => ({ brand, materials: mats }));
}

interface Props {
  materials: LedgerMaterial[];
  selected:  string[];
  onChange:  (ids: string[]) => void;
}

export function MultiMaterialPicker({ materials, selected, onChange }: Props) {
  const [open, setOpen]               = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // When toggling in-stock only, filter visible materials
  const visibleMaterials = inStockOnly
    ? materials.filter(m => m.closing_stock_mt > 0)
    : materials;

  const groups = buildBrandGroups(visibleMaterials);
  const inStockCount = materials.filter(m => m.closing_stock_mt > 0).length;

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

  return (
    <div ref={ref} className="relative">
      {/* Selected chips + open button */}
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
          <button onClick={() => onChange([])}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline">
            Clear all
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-80 overflow-hidden">

          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Filter by Material / Brand
            </p>
            {selected.length > 0 && (
              <button onClick={() => onChange([])}
                className="text-[10px] text-red-400 hover:text-red-600">
                Clear all
              </button>
            )}
          </div>

          {/* In-stock toggle */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              {inStockOnly
                ? <PackageCheck size={13} className="text-[#16A34A]" />
                : <Package size={13} className="text-gray-400" />}
              <span className="text-xs font-medium text-gray-700">
                {inStockOnly ? 'In-stock only' : 'All materials'}
              </span>
              <span className="text-[10px] text-gray-400">
                ({inStockOnly ? inStockCount : materials.length})
              </span>
            </div>
            {/* Toggle switch */}
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
                  <li key={group.brand}>
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
                        <p className="text-xs font-bold text-gray-800">{group.brand}</p>
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
                          {/* Stock badge */}
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
