import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Plus, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { LedgerPlant } from '@/types/material_ledger.types';

// ── Plant type classification (mirrors mapIcons.ts) ───────────────────────────

type PlantType = 'Factory' | 'Terminal' | 'HQ' | 'Depot';

const FACTORY_IDS  = new Set(['2140', '2141', '2145', '2146']);
const TERMINAL_IDS = new Set(['2120', '2121', '2122', '2123', '2124', '2125', '2127', '2128', '2142']);
const HQ_IDS       = new Set(['2100', '2126', '2129', '2130', '2131']);

function getPlantType(id: string): PlantType {
  if (FACTORY_IDS.has(id))  return 'Factory';
  if (TERMINAL_IDS.has(id)) return 'Terminal';
  if (HQ_IDS.has(id))       return 'HQ';
  return 'Depot';
}

const TYPE_META: Record<PlantType, { color: string; bg: string; dot: string }> = {
  Factory:  { color: '#F59E0B', bg: 'bg-amber-50',  dot: 'bg-[#F59E0B]' },
  Terminal: { color: '#DC2626', bg: 'bg-red-50',    dot: 'bg-[#DC2626]' },
  HQ:       { color: '#16A34A', bg: 'bg-green-50',  dot: 'bg-[#16A34A]' },
  Depot:    { color: '#2563EB', bg: 'bg-blue-50',   dot: 'bg-[#2563EB]' },
};

const TYPE_ORDER: PlantType[] = ['Factory', 'Terminal', 'HQ', 'Depot'];

interface PlantGroup {
  type:   PlantType;
  plants: LedgerPlant[];
}

function buildGroups(plants: LedgerPlant[]): PlantGroup[] {
  const map = new Map<PlantType, LedgerPlant[]>();
  TYPE_ORDER.forEach(t => map.set(t, []));
  plants.forEach(p => map.get(getPlantType(p.plant_id))!.push(p));
  return TYPE_ORDER
    .map(type => ({ type, plants: map.get(type)! }))
    .filter(g => g.plants.length > 0);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  plants:   LedgerPlant[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MultiPlantPicker({ plants, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const groups = buildGroups(plants);

  function labelFor(id: string) {
    const p = plants.find(p => p.plant_id === id);
    return p ? `${p.plant_id} — ${p.city ?? p.name}` : id;
  }

  function chipColor(id: string) {
    return TYPE_META[getPlantType(id)].color;
  }

  function toggle(id: string) {
    onChange(selected.includes(id)
      ? selected.filter(s => s !== id)
      : [...selected, id]);
  }

  function toggleGroup(group: PlantGroup) {
    const ids = group.plants.map(p => p.plant_id);
    const allSel = ids.every(id => selected.includes(id));
    if (allSel) {
      onChange(selected.filter(id => !ids.includes(id)));
    } else {
      const missing = ids.filter(id => !selected.includes(id));
      onChange([...selected, ...missing]);
    }
  }

  function isGroupFull(group: PlantGroup) {
    return group.plants.every(p => selected.includes(p.plant_id));
  }

  function isGroupPartial(group: PlantGroup) {
    return !isGroupFull(group) && group.plants.some(p => selected.includes(p.plant_id));
  }

  return (
    <div ref={ref} className="relative">

      {/* ── Selected chips + trigger ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-9">
        {selected.length === 0 && (
          <span className="text-xs text-gray-400 italic">All Plants</span>
        )}
        {selected.map(id => (
          <span
            key={id}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: chipColor(id) }}
          >
            {labelFor(id)}
            <button
              onClick={() => toggle(id)}
              className="hover:opacity-70 transition-opacity"
              aria-label={`Remove ${id}`}
            >
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
          )}
        >
          <Plus size={11} />
          {selected.length === 0 ? 'Filter plants' : 'Add'}
          <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
        </button>

        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline"
          >
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
              Filter by Plant / Type
            </p>
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="text-[10px] text-red-400 hover:text-red-600"
              >
                Clear all
              </button>
            )}
          </div>

          <ul className="max-h-72 overflow-y-auto">
            {groups.map(group => {
              const meta    = TYPE_META[group.type];
              const allSel  = isGroupFull(group);
              const partSel = isGroupPartial(group);

              return (
                <li key={group.type}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left border-b border-gray-100"
                  >
                    {/* Group checkbox */}
                    <span
                      className={cn(
                        'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center',
                        allSel || partSel ? 'border-transparent' : 'border-gray-300',
                      )}
                      style={{
                        backgroundColor: allSel ? meta.color : partSel ? `${meta.color}4D` : 'transparent',
                        borderColor: allSel || partSel ? meta.color : undefined,
                      }}
                    >
                      {allSel  && <Check size={10} className="text-white" />}
                      {partSel && <span className="w-2 h-0.5 rounded" style={{ backgroundColor: meta.color }} />}
                    </span>

                    {/* Type dot + label */}
                    <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800">{group.type}</p>
                      <p className="text-[10px] text-gray-400">
                        {group.plants.length} plant{group.plants.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-[9px] text-gray-400 shrink-0">
                      {allSel ? 'Deselect all' : 'Select all'}
                    </span>
                  </button>

                  {/* Individual plants */}
                  {group.plants.map(p => {
                    const checked = selected.includes(p.plant_id);
                    return (
                      <button
                        key={p.plant_id}
                        onClick={() => toggle(p.plant_id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 pl-9 hover:bg-gray-50 transition-colors text-left"
                      >
                        {/* Checkbox */}
                        <span
                          className="w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center"
                          style={{
                            borderColor: meta.color,
                            backgroundColor: checked ? meta.color : 'transparent',
                          }}
                        >
                          {checked && <Check size={9} className="text-white" />}
                        </span>

                        {/* Plant info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-700 truncate">
                            {p.city ?? p.name}
                          </p>
                          <p className="text-[10px] font-mono text-gray-400">{p.plant_id}</p>
                        </div>
                      </button>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
