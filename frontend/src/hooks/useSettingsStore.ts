/**
 * useSettingsStore — module-level singleton with localStorage persistence.
 *
 * Using a module-level store (not component-local useState) so all consumers
 * share the same state and re-render together when any value changes.
 */

import { useState, useEffect, useCallback } from 'react';
import { materialLedgerService } from '@/services/material_ledger.service';

const STORAGE_KEY = 'tc_settings_v1';

export type DisplayUnit = 'MT' | 'bags';

export interface UnitScale {
  unit:      DisplayUnit;
  bagsPerMt: number;   // how many bags make 1 MT (e.g. 20 for 50 kg bags)
}

interface SettingsState {
  unitScales:  Record<string, UnitScale>;    // keyed by material_id
  thresholds:  Record<string, number>;       // keyed by material_id, value = min MT
}

const DEFAULT: SettingsState = { unitScales: {}, thresholds: {} };

function load(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function persist(state: SettingsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage full — silent */ }
}

// ── Module-level singleton ────────────────────────────────────────────────────
// All hook instances share this state so a setUnitScale in SettingsPage
// immediately re-renders the Dashboard without requiring a page reload.

let _state: SettingsState = load();
const _listeners = new Set<(s: SettingsState) => void>();

function _setState(updater: (prev: SettingsState) => SettingsState): void {
  _state = updater(_state);
  persist(_state);
  _listeners.forEach(fn => fn(_state));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSettingsStore() {
  const [state, setLocalState] = useState<SettingsState>(_state);

  // Subscribe to module-level changes
  useEffect(() => {
    const listener = (s: SettingsState) => setLocalState(s);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  // On mount, merge backend thresholds into the local cache
  useEffect(() => {
    materialLedgerService.getThresholds().then((remote) => {
      _setState(prev => {
        const merged = { ...prev.thresholds };
        remote.forEach(t => { merged[t.material_id] = t.min_stock_mt; });
        return { ...prev, thresholds: merged };
      });
    }).catch(() => { /* backend offline — use cached */ });
  }, []);

  // ── Unit scale ────────────────────────────────────────────────────────────

  const getUnitScale = useCallback(
    (materialId: string): UnitScale =>
      state.unitScales[materialId] ?? { unit: 'MT', bagsPerMt: 1 },
    [state.unitScales],
  );

  const setUnitScale = useCallback(
    (materialId: string, scale: UnitScale) => {
      _setState(prev => ({
        ...prev,
        unitScales: { ...prev.unitScales, [materialId]: scale },
      }));
    },
    [],
  );

  // ── Threshold ─────────────────────────────────────────────────────────────

  const getThreshold = useCallback(
    (materialId: string): number => state.thresholds[materialId] ?? 0,
    [state.thresholds],
  );

  const setThreshold = useCallback(
    async (materialId: string, minMt: number) => {
      _setState(prev => {
        const thresholds = { ...prev.thresholds };
        if (minMt <= 0) delete thresholds[materialId];
        else thresholds[materialId] = minMt;
        return { ...prev, thresholds };
      });
      await materialLedgerService.setThreshold(materialId, minMt);
    },
    [],
  );

  const allUnitScales = state.unitScales;

  return { getUnitScale, setUnitScale, getThreshold, setThreshold, allUnitScales };
}

/**
 * Converts a metric-tonne quantity to the display unit for a given material.
 * Returns { value: string, unit: string } ready for rendering.
 */
export function convertQty(
  mt: number,
  scale: UnitScale,
  decimals = 2,
): { value: string; unit: string } {
  if (scale.unit === 'bags') {
    const bags = Math.round(mt * scale.bagsPerMt);
    return {
      value: new Intl.NumberFormat('en-US').format(bags),
      unit: 'bags',
    };
  }
  return {
    value: new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(mt),
    unit: 'MT',
  };
}
