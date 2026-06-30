import { PageHeader } from '@/components/common/PageHeader';
import { LedgerFilterBar } from './components/LedgerFilterBar';
import { LedgerKpiCards } from './components/LedgerKpiCards';
import { InventoryFlowChart } from './components/InventoryFlowChart';
import { ConsumptionChart } from './components/ConsumptionChart';
import { MovementTable } from './components/MovementTable';
import { StockTransferCard } from './components/StockTransferCard';
import { useLedgerFilters } from './hooks/useLedger';

export function MaterialLedgerPage() {
  const { plantId, setPlantId, materialId, setMaterialId } = useLedgerFilters();

  return (
    <div className="p-4 lg:p-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Material Ledger"
        subtitle="Tokyo Cement inventory movements — Beginning → Receipts → Consumption → Ending"
      />

      {/* Filters */}
      <LedgerFilterBar
        plantId={plantId}
        materialId={materialId}
        onPlantChange={setPlantId}
        onMaterialChange={setMaterialId}
      />

      {/* KPI Cards */}
      <section className="mb-6" aria-label="Key metrics">
        <LedgerKpiCards plantId={plantId} materialId={materialId} />
      </section>

      {/* Charts row 1: Inventory Flow + Consumption */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <InventoryFlowChart plantId={plantId} materialId={materialId} />
        <ConsumptionChart plantId={plantId} materialId={materialId} />
      </div>

      {/* Stock Transfer Notes */}
      <div className="mb-4">
        <StockTransferCard plantId={plantId} materialId={materialId} />
      </div>

      {/* Movement Detail Table */}
      <MovementTable plantId={plantId} materialId={materialId} />
    </div>
  );
}
