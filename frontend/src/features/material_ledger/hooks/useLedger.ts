import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { materialLedgerService } from '@/services/material_ledger.service';
import { queryKeys } from '@/constants/queryKeys';

/** Shared filter state used by all Material Ledger components on the page. */
export function useLedgerFilters() {
  const [plantId, setPlantId] = useState<string | undefined>(undefined);
  const [materialId, setMaterialId] = useState<string | undefined>(undefined);
  return { plantId, setPlantId, materialId, setMaterialId };
}

export function useLedgerKpis(plantId?: string, materialId?: string) {
  return useQuery({
    queryKey: queryKeys.ledger.kpis(plantId, materialId),
    queryFn: () => materialLedgerService.getKpis(plantId, materialId),
    staleTime: 5 * 60_000,
  });
}

export function useLedgerFlow(plantId?: string, materialId?: string) {
  return useQuery({
    queryKey: queryKeys.ledger.flow(plantId, materialId),
    queryFn: () => materialLedgerService.getInventoryFlow(plantId, materialId),
    staleTime: 5 * 60_000,
  });
}

export function useLedgerConsumption(plantId?: string, materialId?: string) {
  return useQuery({
    queryKey: queryKeys.ledger.consumption(plantId, materialId),
    queryFn: () => materialLedgerService.getConsumption(plantId, materialId),
    staleTime: 5 * 60_000,
  });
}

export function useLedgerMovements(
  plantId?: string,
  materialId?: string,
  objType?: string,
  category?: string,
  page = 1,
) {
  return useQuery({
    queryKey: queryKeys.ledger.movements(plantId, materialId, objType, category, page),
    queryFn: () => materialLedgerService.getMovements({ plant_id: plantId, material_id: materialId, obj_type: objType, category, page }),
    staleTime: 5 * 60_000,
  });
}

export function usePlantComparison(materialId?: string) {
  return useQuery({
    queryKey: queryKeys.ledger.plantComparison(materialId),
    queryFn: () => materialLedgerService.getPlantComparison(materialId),
    staleTime: 5 * 60_000,
  });
}

export function useLedgerTransfers(plantId?: string, materialId?: string) {
  return useQuery({
    queryKey: queryKeys.ledger.transfers(plantId, materialId),
    queryFn: () => materialLedgerService.getStockTransfers(plantId, materialId),
    staleTime: 5 * 60_000,
  });
}

export function useLedgerMaterials() {
  return useQuery({
    queryKey: queryKeys.ledger.materials(),
    queryFn: () => materialLedgerService.getMaterials(),
    staleTime: 30 * 60_000,
  });
}

export function useLedgerPlants() {
  return useQuery({
    queryKey: queryKeys.ledger.plants(),
    queryFn: () => materialLedgerService.getPlants(),
    staleTime: 30 * 60_000,
  });
}
