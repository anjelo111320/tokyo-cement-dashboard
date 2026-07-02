import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Database, RefreshCw, CheckCircle2, AlertCircle, Bell, Trash2, Plus, Scale, Search, Check, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { settingsService } from '@/services/settings.service';
import { materialLedgerService } from '@/services/material_ledger.service';
import { queryKeys } from '@/constants/queryKeys';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { useSettingsStore, type UnitScale, type ZeroStockMode } from '@/hooks/useSettingsStore';

function SectionCard({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <span className="text-primary-600">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── Unit Scale section ────────────────────────────────────────────────────────
function UnitScaleSection() {
  const { getUnitScale, setUnitScale } = useSettingsStore();
  const { data: materials = [], isLoading } = useQuery({
    queryKey: queryKeys.ledger.materials(),
    queryFn:  () => materialLedgerService.getMaterials(),
    staleTime: 30 * 60_000,
  });

  const bagMaterials   = materials.filter(m => /\d+\s*kg/i.test(m.material_description));
  const otherMaterials = materials.filter(m => !/\d+\s*kg/i.test(m.material_description));

  // Local input state — decoupled from the store so typing doesn't auto-apply
  const [bagKgStr, setBagKgStr] = useState('50');
  const bagKg     = parseFloat(bagKgStr) || 50;
  const bagsPerMt = bagKg > 0 ? Math.round(1000 / bagKg) : 20;

  // Sync displayed value from store once materials are loaded
  useEffect(() => {
    if (!bagMaterials.length) return;
    const stored = getUnitScale(bagMaterials[0].material_id);
    if (stored.unit === 'bags' && stored.bagsPerMt > 1) {
      setBagKgStr(String(Math.round(1000 / stored.bagsPerMt)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagMaterials.length]);

  // True when the current input matches what is persisted in the store
  const firstStored  = bagMaterials.length ? getUnitScale(bagMaterials[0].material_id) : null;
  const isApplied    = firstStored?.unit === 'bags' && firstStored.bagsPerMt > 1
    && Math.round(1000 / firstStored.bagsPerMt) === Math.round(bagKg);
  const isDirty      = !isApplied && bagMaterials.length > 0;

  function handleApply() {
    if (bagKg <= 0) return;
    const scale: UnitScale = { unit: 'bags', bagsPerMt: Math.round(1000 / bagKg) };
    bagMaterials.forEach(m => setUnitScale(m.material_id, scale));
  }

  function handleUnapply() {
    const mt: UnitScale = { unit: 'MT', bagsPerMt: 1 };
    bagMaterials.forEach(m => setUnitScale(m.material_id, mt));
  }

  if (isLoading) return <Skeleton className="h-20 w-full rounded-lg" />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Set the bag weight for cement materials. Click <strong>Apply</strong> to save — the
        dashboard will switch to bags when that material is selected.
      </p>

      {/* Cement bag materials row */}
      <div className={cn(
        'p-3.5 rounded-xl border flex flex-col gap-3',
        isApplied ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200',
      )}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800">Cement Bag Materials</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {bagMaterials.length} material{bagMaterials.length !== 1 ? 's' : ''}
            </p>
          </div>
          {isApplied && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <Check size={10} /> Applied — shows as bags in dashboard
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            min="1"
            step="1"
            value={bagKgStr}
            onChange={e => setBagKgStr(e.target.value)}
            className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 text-center bg-white"
          />
          <span className="text-xs text-gray-500">kg / bag</span>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>=</span>
            <span className="font-bold text-[#1B3550]">{bagsPerMt}</span>
            <span>bags / MT</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isApplied && (
              <button
                onClick={handleUnapply}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                Unapply
              </button>
            )}
            <button
              onClick={handleApply}
              disabled={!bagMaterials.length || bagKg <= 0}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40',
                isDirty
                  ? 'bg-[#E05540] text-white hover:bg-[#c94432]'
                  : 'bg-[#1B3550] text-white hover:bg-[#0D1F2D]',
              )}
            >
              {isApplied ? 'Re-apply' : 'Apply'}
            </button>
          </div>
        </div>

        {isDirty && (
          <p className="text-[10px] text-amber-600">
            ⚠ Not yet applied — click Apply to save and enable bags in the dashboard
          </p>
        )}
      </div>

      {/* Other materials — always MT */}
      <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800">Other Materials</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {otherMaterials.length} material{otherMaterials.length !== 1 ? 's' : ''} · always metric tonnes
          </p>
        </div>
        <span className="text-xs font-bold text-[#1B3550] bg-gray-100 px-3 py-1.5 rounded-lg">MT</span>
      </div>
    </div>
  );
}

// ── Low Stock Thresholds section ──────────────────────────────────────────────
function ThresholdsSection() {
  const queryClient = useQueryClient();
  const [editing,       setEditing]       = useState<string | null>(null);
  const [inputVal,      setInputVal]      = useState('');
  const [addMaterialId, setAddMaterialId] = useState('');
  const [addValue,      setAddValue]      = useState('');
  const [matSearch,     setMatSearch]     = useState('');
  const [bulkValue,     setBulkValue]     = useState('');
  const [bulkLoading,   setBulkLoading]   = useState(false);

  const { data: thresholds = [], isLoading: thLoading } = useQuery({
    queryKey: queryKeys.inventory.thresholds(),
    queryFn:  () => materialLedgerService.getThresholds(),
    staleTime: 30_000,
  });

  const { data: materials = [] } = useQuery({
    queryKey: queryKeys.ledger.materials(),
    queryFn:  () => materialLedgerService.getMaterials(),
    staleTime: 30 * 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: ({ materialId, val }: { materialId: string; val: number }) =>
      materialLedgerService.setThreshold(materialId, val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.thresholds() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts() });
      setEditing(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (materialId: string) => materialLedgerService.setThreshold(materialId, 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.thresholds() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts() });
    },
  });

  // Filtered material list for the search combobox
  const q = matSearch.trim().toLowerCase();
  const filteredMaterials = q
    ? materials.filter(m =>
        m.material_description.toLowerCase().includes(q) ||
        m.material_id.includes(q))
    : materials;

  // Apply one threshold value to every material
  async function applyToAll() {
    const val = parseFloat(bulkValue);
    if (!val || val <= 0 || !materials.length) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        materials.map(m => materialLedgerService.setThreshold(m.material_id, val))
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.thresholds() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts() });
      setBulkValue('');
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        When a plant's closing stock drops below the minimum, it appears in the dashboard alert panel.
      </p>

      {/* ── Bulk: Apply to all materials ─────────────────────────────── */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-2.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
          Apply to all {materials.length} materials at once
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="Min MT (e.g. 100)"
            value={bulkValue}
            onChange={e => setBulkValue(e.target.value)}
            className="w-40 text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-xs text-amber-700">MT minimum for every material</span>
          <button
            onClick={applyToAll}
            disabled={!bulkValue || parseFloat(bulkValue) <= 0 || bulkLoading || !materials.length}
            className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors"
          >
            {bulkLoading
              ? <RefreshCw size={11} className="animate-spin" />
              : <Check size={11} />}
            {bulkLoading ? 'Saving…' : `Set for All ${materials.length} Materials`}
          </button>
        </div>
      </div>

      {/* ── Existing thresholds list ─────────────────────────────────── */}
      {thLoading && <Skeleton className="h-20 w-full rounded-lg" />}
      {!thLoading && thresholds.length === 0 && (
        <p className="text-sm text-gray-400 italic">No thresholds set — use the panel above or add individually below.</p>
      )}
      <div className="space-y-2">
        {thresholds.map(t => (
          <div key={t.material_id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{t.material_desc}</p>
              <p className="text-[10px] text-gray-400 font-mono">{t.material_id}</p>
            </div>
            {editing === t.material_id ? (
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number" min="0" step="0.5"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  className="w-24 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  autoFocus
                />
                <span className="text-xs text-gray-500">MT</span>
                <button
                  onClick={() => saveMutation.mutate({ materialId: t.material_id, val: parseFloat(inputVal) || 0 })}
                  disabled={saveMutation.isPending}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-[#1B3550] text-white rounded-lg hover:bg-[#0D1F2D] disabled:opacity-50"
                >Save</button>
                <button onClick={() => setEditing(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-[#1B3550]">{formatNumber(t.min_stock_mt, 1)} MT</span>
                <button
                  onClick={() => { setEditing(t.material_id); setInputVal(String(t.min_stock_mt)); }}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                >Edit</button>
                <button
                  onClick={() => removeMutation.mutate(t.material_id)}
                  disabled={removeMutation.isPending}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remove threshold"
                ><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Individual: searchable material picker ───────────────────── */}
      {materials.length > 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl p-3.5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Set for individual material
          </p>

          {/* Search input */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search material name or ID…"
              value={matSearch}
              onChange={e => { setMatSearch(e.target.value); setAddMaterialId(''); setAddValue(''); }}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {/* Scrollable material list */}
          <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {filteredMaterials.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-400">No materials match "{matSearch}"</p>
            )}
            {filteredMaterials.map(m => {
              const existing = thresholds.find(t => t.material_id === m.material_id);
              const isSelected = addMaterialId === m.material_id;
              return (
                <button
                  key={m.material_id}
                  onClick={() => {
                    setAddMaterialId(m.material_id);
                    setAddValue(existing ? String(existing.min_stock_mt) : '');
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                    isSelected ? 'bg-[#1B3550]/5 border-l-2 border-[#1B3550]' : 'hover:bg-gray-50',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{m.material_description}</p>
                    <p className="text-[10px] font-mono text-gray-400">{m.material_id}</p>
                  </div>
                  {existing ? (
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded shrink-0">
                      {formatNumber(existing.min_stock_mt, 0)} MT
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-300 shrink-0">No threshold</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Value + save — shown only when a material is selected */}
          {addMaterialId && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">
                {materials.find(m => m.material_id === addMaterialId)?.material_description}
              </span>
              <input
                type="number" min="0" step="0.5" placeholder="Min MT"
                value={addValue}
                onChange={e => setAddValue(e.target.value)}
                className="w-24 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                autoFocus
              />
              <button
                onClick={() => {
                  if (!addMaterialId || !addValue) return;
                  saveMutation.mutate({ materialId: addMaterialId, val: parseFloat(addValue) });
                  setAddMaterialId(''); setAddValue(''); setMatSearch('');
                }}
                disabled={!addValue || saveMutation.isPending}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#1B3550] text-white rounded-lg hover:bg-[#0D1F2D] disabled:opacity-40"
              >
                <Plus size={12} />
                {thresholds.some(t => t.material_id === addMaterialId) ? 'Update' : 'Add'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Alert Behaviour section ───────────────────────────────────────────────────

const ZERO_STOCK_OPTIONS: {
  value:    ZeroStockMode;
  label:    string;
  explain:  string;
  badge:    string;
  badgeCls: string;
}[] = [
  {
    value:    'accurate',
    label:    'Active plants only',
    explain:  'A plant is flagged only if it has previously received or opened stock for that material AND the current level is below the threshold. Materials that were never stocked at a plant are ignored — they are not "out of stock", they simply don\'t carry that product.',
    badge:    'Recommended',
    badgeCls: 'bg-green-100 text-green-700',
  },
  {
    value:    'active_only',
    label:    'Ignore zero stock',
    explain:  'Only flags a plant-material pair when stock is above zero but below the threshold (i.e. genuinely running low). If stock is exactly zero the entry is silently skipped — useful when many materials show zero because they are not stocked at that plant, and you want no "out" alerts at all.',
    badge:    'Option A',
    badgeCls: 'bg-gray-100 text-gray-600',
  },
];

function AlertBehaviourSection() {
  const { zeroStockMode, setZeroStockMode } = useSettingsStore();

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Controls how the dashboard decides whether a plant-material pair counts as a low-stock alert.
        The choice affects the KPI count card and the status badge on each plant row.
      </p>
      <div className="space-y-2">
        {ZERO_STOCK_OPTIONS.map(opt => {
          const active = zeroStockMode === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setZeroStockMode(opt.value)}
              className={cn(
                'w-full text-left rounded-xl border p-4 transition-all',
                active
                  ? 'bg-[#0D1F2D]/5 border-[#1B3550] ring-1 ring-[#1B3550]/30'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300',
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn(
                  'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                  active ? 'border-[#1B3550] bg-[#1B3550]' : 'border-gray-300',
                )}>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-xs font-semibold text-gray-900">{opt.label}</span>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto', opt.badgeCls)}>
                  {opt.badge}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed pl-6">{opt.explain}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const queryClient = useQueryClient();
  const [triggerStatus, setTriggerStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: csvConfig, isLoading } = useQuery({
    queryKey: queryKeys.settings.csvConfig(),
    queryFn:  () => settingsService.getCsvConfig(),
    staleTime: 60_000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => settingsService.triggerIngestion(),
    onSuccess: () => {
      setTriggerStatus('success');
      queryClient.invalidateQueries();
      setTimeout(() => setTriggerStatus('idle'), 3000);
    },
    onError: () => {
      setTriggerStatus('error');
      setTimeout(() => setTriggerStatus('idle'), 3000);
    },
  });

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" subtitle="Configure data sources, alert thresholds, and preferences" />

      <div className="space-y-4">

        {/* ── Unit Scale ───────────────────────────────────────────── */}
        <SectionCard title="Display Units per Material" icon={<Scale size={16} />}>
          <UnitScaleSection />
        </SectionCard>

        {/* ── Low Stock Thresholds ──────────────────────────────────── */}
        <SectionCard title="Low Stock Alert Thresholds" icon={<Bell size={16} />}>
          <ThresholdsSection />
        </SectionCard>

        {/* ── Alert Behaviour ───────────────────────────────────────── */}
        <SectionCard title="Alert Behaviour — Zero Stock Handling" icon={<SlidersHorizontal size={16} />}>
          <AlertBehaviourSection />
        </SectionCard>

        {/* ── CSV Data Sources ──────────────────────────────────────── */}
        <SectionCard title="CSV Data Sources" icon={<Database size={16} />}>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : csvConfig ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Base Path</label>
                <p className="mt-1 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800">
                  {csvConfig.csv_base_path}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Auto-refresh</label>
                <p className="mt-1 text-sm text-gray-800">
                  Every {csvConfig.refresh_interval_seconds / 60} minutes
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Files</label>
                <div className="space-y-2">
                  {Object.entries(csvConfig.files).map(([name, file]) => (
                    <div key={name} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {file.enabled
                          ? <CheckCircle2 size={14} className="text-green-500" />
                          : <AlertCircle size={14} className="text-gray-400" />}
                        <span className="text-sm text-gray-700 font-mono">{file.filename}</span>
                      </div>
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        file.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                      )}>
                        {file.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => triggerMutation.mutate()}
                  disabled={triggerMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1B3550] hover:bg-[#0D1F2D] rounded-lg transition-colors disabled:opacity-60"
                >
                  <RefreshCw size={14} className={triggerMutation.isPending ? 'animate-spin' : ''} />
                  {triggerMutation.isPending ? 'Syncing…' : 'Sync CSV Now'}
                </button>
                {triggerStatus === 'success' && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 size={12} /> CSV files reloaded successfully
                  </p>
                )}
                {triggerStatus === 'error' && (
                  <p className="text-xs text-red-600 mt-2">Failed to sync. Check backend connection.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No configuration loaded. Check backend connection.</p>
          )}
        </SectionCard>

        {/* ── App info ─────────────────────────────────────────────── */}
        <SectionCard title="About" icon={<Settings size={16} />}>
          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Application</span>
              <span className="font-semibold text-gray-800">INSEE Analytics</span>
            </div>
            <div className="flex justify-between">
              <span>Data source</span>
              <span className="font-semibold text-gray-800">SAP Material Ledger CSV</span>
            </div>
            <div className="flex justify-between">
              <span>Phase</span>
              <span className="font-semibold text-gray-800">Phase 1 — CSV-driven MVP</span>
            </div>
          </div>
        </SectionCard>

      </div>
    </div>
  );
}
