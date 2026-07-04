import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Database, RefreshCw, CheckCircle2, AlertCircle, Bell, Scale, Check, SlidersHorizontal, ChevronRight, ChevronDown, Lock } from 'lucide-react';
import type { LedgerMaterial, BrandGroupOption } from '@/types/material_ledger.types';
import { PageHeader } from '@/components/common/PageHeader';
import { settingsService } from '@/services/settings.service';
import { materialLedgerService } from '@/services/material_ledger.service';
import { useBrandGroups } from '@/features/material_ledger/hooks/useLedger';
import { queryKeys } from '@/constants/queryKeys';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { useSettingsStore, type UnitScale, type ZeroStockMode } from '@/hooks/useSettingsStore';
import { useAuth } from '@/features/auth/AuthContext';

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

// ── Group definitions ─────────────────────────────────────────────────────────
// Groups are the admin-managed brand groups (Settings → Materials tab), not a
// hardcoded list — renaming/regrouping a material there is reflected here
// immediately. Colors are cosmetic and assigned cyclically by position.

interface DisplayGroup {
  id:     string;
  name:   string;
  mats:   LedgerMaterial[];
  border: string;
  bg:     string;
  dot:    string;
  badge:  string;
}

const GROUP_PALETTE = [
  { border: 'border-blue-200',   bg: 'bg-blue-50',   dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700' },
  { border: 'border-indigo-200', bg: 'bg-indigo-50', dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700' },
  { border: 'border-violet-200', bg: 'bg-violet-50', dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700' },
  { border: 'border-cyan-200',   bg: 'bg-cyan-50',   dot: 'bg-cyan-500',   badge: 'bg-cyan-100 text-cyan-700' },
  { border: 'border-teal-200',   bg: 'bg-teal-50',   dot: 'bg-teal-500',   badge: 'bg-teal-100 text-teal-700' },
  { border: 'border-amber-200',  bg: 'bg-amber-50',  dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700' },
  { border: 'border-rose-200',   bg: 'bg-rose-50',   dot: 'bg-rose-500',   badge: 'bg-rose-100 text-rose-700' },
  { border: 'border-lime-200',   bg: 'bg-lime-50',   dot: 'bg-lime-500',   badge: 'bg-lime-100 text-lime-700' },
];

function buildDisplayGroups(materials: LedgerMaterial[], options: BrandGroupOption[]): DisplayGroup[] {
  return options
    .map((g, i) => ({
      id: g.id,
      name: g.label,
      mats: materials.filter(m => m.brand_group === g.id),
      ...GROUP_PALETTE[i % GROUP_PALETTE.length],
    }))
    .filter(g => g.mats.length > 0);
}

function GroupToggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); if (!disabled) onChange(); }}
      role="switch"
      aria-checked={enabled}
      title={disabled ? 'Admin only' : enabled ? 'Group enabled — click to disable' : 'Group disabled — click to enable'}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
        enabled ? 'bg-[#1B3550]' : 'bg-gray-200',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className={cn(
        'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
        enabled ? 'translate-x-4' : 'translate-x-0.5',
      )} />
    </button>
  );
}

// ── Low Stock Thresholds section ──────────────────────────────────────────────
function ThresholdsSection() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

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

  const { data: brandGroupOptions = [] } = useBrandGroups();

  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [groupEnabled, setGroupEnabled] = useState<Record<string, boolean>>({});
  const [inputs,       setInputs]       = useState<Record<string, string>>({});
  const [groupBulk,    setGroupBulk]    = useState<Record<string, string>>({});
  const [groupSaving,  setGroupSaving]  = useState<Record<string, boolean>>({});
  // Tracks groups the user manually toggled this session so DB refetches don't override them
  const userToggledRef                  = useRef<Set<string>>(new Set());

  // Populate inputs from saved thresholds (only for keys not yet typed by user)
  useEffect(() => {
    if (!thresholds.length) return;
    setInputs(prev => {
      const next = { ...prev };
      thresholds.forEach(t => {
        if (!(t.material_id in next)) {
          next[t.material_id] = t.min_stock_mt > 0 ? String(t.min_stock_mt) : '';
        }
      });
      return next;
    });
  }, [thresholds]);

  const displayGroups = buildDisplayGroups(materials, brandGroupOptions);

  // Sync group toggles from DB whenever thresholds or materials load/change.
  // Groups the user has manually toggled this session are left untouched.
  useEffect(() => {
    if (!materials.length) return;
    setGroupEnabled(prev => {
      const next = { ...prev };
      for (const g of displayGroups) {
        if (userToggledRef.current.has(g.id)) continue;
        next[g.id] = g.mats.some(m => thresholds.some(t => t.material_id === m.material_id && t.min_stock_mt > 0));
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials.length, thresholds.length, brandGroupOptions.length]);

  function toggleExpand(id: string) {
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function setAllForGroup(groupId: string, groupMats: LedgerMaterial[]) {
    const val = parseFloat(groupBulk[groupId] ?? '') || 0;
    if (val <= 0) return;
    setInputs(prev => {
      const next = { ...prev };
      groupMats.forEach(m => { next[m.material_id] = String(val); });
      return next;
    });
    setGroupSaving(s => ({ ...s, [groupId]: true }));
    try {
      await Promise.all(groupMats.map(m => materialLedgerService.setThreshold(m.material_id, val)));
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.thresholds() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts() });
      setGroupBulk(s => ({ ...s, [groupId]: '' }));
    } finally {
      setGroupSaving(s => ({ ...s, [groupId]: false }));
    }
  }

  async function saveGroup(groupId: string, groupMats: LedgerMaterial[], sendZeros = false) {
    setGroupSaving(s => ({ ...s, [groupId]: true }));
    try {
      await Promise.all(
        groupMats.map(m => {
          const val = sendZeros ? 0 : (parseFloat(inputs[m.material_id] ?? '') || 0);
          return materialLedgerService.setThreshold(m.material_id, val);
        })
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.thresholds() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts() });
    } finally {
      setGroupSaving(s => ({ ...s, [groupId]: false }));
    }
  }

  async function toggleGroup(groupId: string, groupMats: LedgerMaterial[]) {
    userToggledRef.current.add(groupId);
    const wasEnabled = groupEnabled[groupId] !== false;
    setGroupEnabled(s => ({ ...s, [groupId]: !wasEnabled }));
    if (wasEnabled) {
      // turning off → clear all thresholds for this group from DB
      await saveGroup(groupId, groupMats, true);
      // Release manual control so the next refetch re-derives from DB (will show OFF since cleared)
      userToggledRef.current.delete(groupId);
    }
  }

  if (thLoading) return <Skeleton className="h-40 w-full rounded-lg" />;

  const ungrouped = materials.filter(m => !m.brand_group);

  return (
    <div className="space-y-3">
      {!isAdmin && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <Lock size={13} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            View only — only admins can edit thresholds.
          </p>
        </div>
      )}
      <p className="text-xs text-gray-500">
        Expand a group, enter per-material minimums, then click <strong>Apply</strong> to save.
        Toggle a group OFF to remove all its alerts.
      </p>

      {displayGroups.map(group => {
        const groupMats  = group.mats;

        const isExpanded = expanded.has(group.id);
        const isEnabled  = groupEnabled[group.id] !== false;
        const isSaving   = groupSaving[group.id] ?? false;
        const setCount   = groupMats.filter(m =>
          thresholds.some(t => t.material_id === m.material_id && t.min_stock_mt > 0)
        ).length;

        return (
          <div
            key={group.id}
            className={cn(
              'rounded-xl border overflow-hidden transition-all',
              isEnabled ? group.border : 'border-gray-200',
              !isEnabled && 'opacity-60',
            )}
          >
            {/* ── Header ───────────────────────────────────────────── */}
            <div className={cn(
              'flex items-center gap-2 px-4 py-3 transition-colors',
              isEnabled ? group.bg : 'bg-gray-50',
            )}>
              {/* click-to-expand zone */}
              <button
                onClick={() => toggleExpand(group.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', group.dot)} />
                <span className="text-sm font-semibold text-gray-900 truncate">{group.name}</span>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', group.badge)}>
                  {groupMats.length} mat{groupMats.length !== 1 ? 's' : ''}
                </span>
                {setCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                    {setCount} set
                  </span>
                )}
              </button>

              {/* group-level bulk MT input — admin only */}
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="MT"
                    value={groupBulk[group.id] ?? ''}
                    onChange={e => setGroupBulk(s => ({ ...s, [group.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') setAllForGroup(group.id, groupMats); }}
                    disabled={!isEnabled}
                    className="w-14 text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-400 text-center bg-white disabled:opacity-40"
                  />
                  <button
                    onClick={() => setAllForGroup(group.id, groupMats)}
                    disabled={!groupBulk[group.id] || parseFloat(groupBulk[group.id] ?? '') <= 0 || isSaving || !isEnabled}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-[#1B3550]/10 text-[#1B3550] hover:bg-[#1B3550]/20 disabled:opacity-30 transition-colors whitespace-nowrap"
                  >
                    Set all
                  </button>
                </div>
              )}

              <GroupToggle
                enabled={isEnabled}
                onChange={() => toggleGroup(group.id, groupMats)}
                disabled={!isAdmin}
              />

              <button onClick={() => toggleExpand(group.id)} className="shrink-0 text-gray-400 hover:text-gray-600">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>

            {/* ── Per-material rows ────────────────────────────────── */}
            {isExpanded && (
              <div className={cn('border-t border-gray-100 divide-y divide-gray-100', !isEnabled && 'opacity-50 pointer-events-none')}>
                {groupMats.map(m => {
                  const saved = thresholds.find(t => t.material_id === m.material_id);
                  return (
                    <div key={m.material_id} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{m.material_description}</p>
                        <p className="text-[10px] font-mono text-gray-400">{m.material_id}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAdmin ? (
                          <>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder="MT"
                              value={inputs[m.material_id] ?? ''}
                              onChange={e => setInputs(s => ({ ...s, [m.material_id]: e.target.value }))}
                              className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 text-center bg-white"
                            />
                            <span className="text-[10px] text-gray-400">MT</span>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-gray-700">
                            {saved && saved.min_stock_mt > 0 ? `${formatNumber(saved.min_stock_mt, 0)} MT` : '—'}
                          </span>
                        )}
                        {saved && saved.min_stock_mt > 0 && isAdmin && (
                          <span className="text-[10px] text-green-600 font-semibold whitespace-nowrap">
                            saved: {formatNumber(saved.min_stock_mt, 0)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Apply group — admin only */}
                {isAdmin && (
                  <div className="px-4 py-3 bg-gray-50 flex justify-end">
                    <button
                      onClick={() => saveGroup(group.id, groupMats)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-[#1B3550] text-white rounded-lg hover:bg-[#0D1F2D] transition-colors disabled:opacity-40"
                    >
                      {isSaving
                        ? <><RefreshCw size={11} className="animate-spin" /> Saving…</>
                        : <><Check size={11} /> Apply {group.name}</>
                      }
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Ungrouped materials ───────────────────────────────────────── */}
      {ungrouped.length > 0 && (() => {
        const isExpanded = expanded.has('__other__');
        const isSaving   = groupSaving['__other__'] ?? false;
        return (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
              <button
                onClick={() => toggleExpand('__other__')}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                <span className="text-sm font-semibold text-gray-700 truncate">Other</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">
                  {ungrouped.length} material{ungrouped.length !== 1 ? 's' : ''}
                </span>
              </button>

              {/* bulk MT input — admin only, applies to every ungrouped material at once */}
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="MT"
                    value={groupBulk['__other__'] ?? ''}
                    onChange={e => setGroupBulk(s => ({ ...s, __other__: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') setAllForGroup('__other__', ungrouped); }}
                    className="w-14 text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-400 text-center bg-white"
                  />
                  <button
                    onClick={() => setAllForGroup('__other__', ungrouped)}
                    disabled={!groupBulk['__other__'] || parseFloat(groupBulk['__other__'] ?? '') <= 0 || isSaving}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-[#1B3550]/10 text-[#1B3550] hover:bg-[#1B3550]/20 disabled:opacity-30 transition-colors whitespace-nowrap"
                  >
                    Set all
                  </button>
                </div>
              )}

              <button onClick={() => toggleExpand('__other__')} className="shrink-0 text-gray-400 hover:text-gray-600">
                {isExpanded
                  ? <ChevronDown size={14} />
                  : <ChevronRight size={14} />
                }
              </button>
            </div>

            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {ungrouped.map(m => {
                  const saved = thresholds.find(t => t.material_id === m.material_id);
                  return (
                    <div key={m.material_id} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{m.material_description}</p>
                        <p className="text-[10px] font-mono text-gray-400">{m.material_id}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAdmin ? (
                          <>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder="MT"
                              value={inputs[m.material_id] ?? ''}
                              onChange={e => setInputs(s => ({ ...s, [m.material_id]: e.target.value }))}
                              className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 text-center bg-white"
                            />
                            <span className="text-[10px] text-gray-400">MT</span>
                            {saved && saved.min_stock_mt > 0 && (
                              <span className="text-[10px] text-green-600 font-semibold whitespace-nowrap">
                                saved: {formatNumber(saved.min_stock_mt, 0)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm font-bold text-gray-700">
                            {saved && saved.min_stock_mt > 0 ? `${formatNumber(saved.min_stock_mt, 0)} MT` : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {isAdmin && (
                  <div className="px-4 py-3 bg-gray-50 flex justify-end">
                    <button
                      onClick={() => saveGroup('__other__', ungrouped)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-[#1B3550] text-white rounded-lg hover:bg-[#0D1F2D] transition-colors disabled:opacity-40"
                    >
                      {isSaving
                        ? <><RefreshCw size={11} className="animate-spin" /> Saving…</>
                        : <><Check size={11} /> Apply Other</>
                      }
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
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
