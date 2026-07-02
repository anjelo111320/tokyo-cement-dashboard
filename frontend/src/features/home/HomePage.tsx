import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '@/utils/formatters';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import {
  useInventorySummary,
  useLedgerMaterials,
  useLedgerPlants,
} from '@/features/material_ledger/hooks/useLedger';
import { useSettingsStore, type UnitScale, type ZeroStockMode } from '@/hooks/useSettingsStore';
import { useLocalStorage }  from '@/hooks/useLocalStorage';
import { MultiMaterialPicker } from './components/MultiMaterialPicker';
import { MultiPlantPicker }    from './components/MultiPlantPicker';
import { InventoryKpiCards }   from './components/InventoryKpiCards';
import { PlantInventoryTable } from './components/PlantInventoryTable';

export function HomePage() {
  const [materialIds, setMaterialIds] = useLocalStorage<string[]>('insee_dashboard_material_ids', []);
  const [plantIds,    setPlantIds]    = useLocalStorage<string[]>('insee_dashboard_plant_ids',    []);

  const { data: plants    = [] } = useLedgerPlants();
  const { getUnitScale, allUnitScales, zeroStockMode: settingsMode } = useSettingsStore();

  // Table can temporarily override the Settings mode for the current session
  const [modeOverride, setModeOverride] = useState<ZeroStockMode | null>(null);
  const effectiveMode: ZeroStockMode = modeOverride ?? settingsMode;

  const activePlants = plants.filter(p => p.has_ledger_data);

  // Materials scoped to selected plants — re-fetches when plantIds changes
  const { data: materials = [], isLoading: materialsLoading } = useLedgerMaterials(
    plantIds.length ? plantIds : undefined,
  );

  // Auto-clear selected materials that are no longer available at the current plant set.
  // Guard: skip while materials are still loading — otherwise the empty array would
  // wipe all restored selections before the fetch completes.
  useEffect(() => {
    if (materialsLoading || !materialIds.length) return;
    const availableIds = new Set(materials.map(m => m.material_id));
    const stillValid = materialIds.filter(id => availableIds.has(id));
    if (stillValid.length !== materialIds.length) setMaterialIds(stillValid);
  }, [materials, materialsLoading]);

  // Determine display unit:
  // • 1 material selected  → use that material's configured scale
  // • 2+ materials selected → if ALL have the same bags scale applied, show in bags;
  //                           mixed or no scale → fall back to MT
  // • 0 selected (all)     → MT (bulk + bag materials are mixed)
  const activeScale = useMemo((): UnitScale => {
    if (materialIds.length === 1) return getUnitScale(materialIds[0]);
    if (materialIds.length > 1) {
      const scales = materialIds.map(id => allUnitScales[id]);
      if (scales.every(s => s?.unit === 'bags')) {
        const rates = [...new Set(scales.map(s => s!.bagsPerMt))];
        if (rates.length === 1) return { unit: 'bags', bagsPerMt: rates[0] };
      }
    }
    return { unit: 'MT', bagsPerMt: 1 };
  }, [materialIds, getUnitScale, allUnitScales]);

  const {
    data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary,
  } = useInventorySummary(
    materialIds.length ? materialIds : undefined,
    plantIds.length    ? plantIds    : undefined,
    effectiveMode,
  );

  return (
    <div className="p-4 lg:p-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Inventory Dashboard"
        subtitle={`INSEE — Real-time stock status · ${formatDateTime(new Date().toISOString())}`}
      />

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 mb-5 space-y-3">

        {/* Plant multi-picker */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Plants</p>
          <MultiPlantPicker
            plants={activePlants}
            selected={plantIds}
            onChange={setPlantIds}
          />
          {plantIds.length > 0 && materials.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-1.5">
              {plantIds.length} plant{plantIds.length !== 1 ? 's' : ''} selected
              · {materials.length} material{materials.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>

        <div className="border-t border-gray-100" />

        {/* Material multi-picker — scoped to selected plants */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Materials</p>
          <MultiMaterialPicker
            materials={materials}
            selected={materialIds}
            onChange={setMaterialIds}
          />
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <section className="mb-5" aria-label="Inventory KPIs">
        {summaryError && <ErrorState message="Failed to load inventory data" onRetry={refetchSummary} />}
        <InventoryKpiCards summary={summary} isLoading={summaryLoading} unitScale={activeScale} />
      </section>

      {/* ── Per-plant inventory table ──────────────────────────────────── */}
      <PlantInventoryTable
        summary={summary}
        isLoading={summaryLoading}
        unitScale={activeScale}
        zeroStockMode={effectiveMode}
        settingsMode={settingsMode}
        onModeChange={setModeOverride}
      />
    </div>
  );
}
