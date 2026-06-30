import { MapPin } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useLedgerMaterials, useLedgerPlants } from '../hooks/useLedger';

interface Props {
  plantId: string | undefined;
  materialId: string | undefined;
  onPlantChange: (id: string | undefined) => void;
  onMaterialChange: (id: string | undefined) => void;
}

export function LedgerFilterBar({ plantId, materialId, onPlantChange, onMaterialChange }: Props) {
  const { data: materials = [] } = useLedgerMaterials();
  const { data: plants = [] } = useLedgerPlants();

  const activePlants = plants.filter((p) => p.has_ledger_data);
  const selectedPlant = plantId ? plants.find((p) => p.plant_id === plantId) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm mb-5 space-y-3">

      {/* Plant filter */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Plant</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onPlantChange(undefined)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
              !plantId ? 'bg-[#1B3550] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            All Plants
          </button>
          {activePlants.map((p) => (
            <button
              key={p.plant_id}
              onClick={() => onPlantChange(p.plant_id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                plantId === p.plant_id
                  ? 'bg-[#1B3550] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {p.plant_id} — {p.city ?? p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Material filter */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Material</p>
        <select
          value={materialId ?? ''}
          onChange={(e) => onMaterialChange(e.target.value || undefined)}
          className="w-full text-xs bg-gray-100 text-gray-700 border-0 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-600"
          aria-label="Filter by material"
        >
          <option value="">All Materials</option>
          {materials.map((m) => (
            <option key={m.material_id} value={m.material_id}>
              {m.material_description}
            </option>
          ))}
        </select>
      </div>

      {/* Selected plant info — visible only when a specific plant is chosen */}
      {selectedPlant && (
        <>
          <div className="border-t border-gray-100" />
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1B3550]/10 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin size={13} className="text-[#1B3550]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 leading-snug">{selectedPlant.name}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                {[selectedPlant.address, selectedPlant.city, selectedPlant.postal_code, selectedPlant.country]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
