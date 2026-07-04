import { useQuery } from '@tanstack/react-query';
import { materialLedgerService } from '@/services/material_ledger.service';
import { queryKeys } from '@/constants/queryKeys';

export function useInventoryReport(materialIds?: string[], plantIds?: string[]) {
  return useQuery({
    queryKey: queryKeys.report.inventory(materialIds, plantIds),
    queryFn:  () => materialLedgerService.getInventoryReport(materialIds, plantIds),
    staleTime: 5 * 60_000,
  });
}

export function useLedgerKpis(plantId?: string, materialId?: string) {
  return useQuery({
    queryKey: queryKeys.ledger.kpis(plantId, materialId),
    queryFn: () => materialLedgerService.getKpis(plantId, materialId),
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

export function useInventorySummary(materialIds?: string[], plantIds?: string[], zeroStockMode?: string) {
  return useQuery({
    queryKey: queryKeys.inventory.summary(materialIds, plantIds, zeroStockMode),
    queryFn: () => materialLedgerService.getInventorySummary(materialIds, plantIds, zeroStockMode),
    staleTime: 5 * 60_000,
  });
}

export function useInventoryAlerts(materialIds?: string[]) {
  return useQuery({
    queryKey: queryKeys.inventory.alerts(materialIds),
    queryFn: () => materialLedgerService.getInventoryAlerts(materialIds),
    staleTime: 30 * 60_000,
  });
}

export function useThresholds() {
  return useQuery({
    queryKey: queryKeys.inventory.thresholds(),
    queryFn: () => materialLedgerService.getThresholds(),
    staleTime: 30 * 60_000,
  });
}

export function useLedgerMaterials(plantIds?: string[]) {
  return useQuery({
    queryKey: queryKeys.ledger.materials(plantIds),
    queryFn: () => materialLedgerService.getMaterials(plantIds),
    staleTime: 5 * 60_000,
  });
}

export function useLedgerPlants() {
  return useQuery({
    queryKey: queryKeys.ledger.plants(),
    queryFn: () => materialLedgerService.getPlants(),
    staleTime: 30 * 60_000,
  });
}

export function useLocationSummary(includeBags = true, includeBulk = false) {
  return useQuery({
    queryKey: queryKeys.location.locationSummary(includeBags, includeBulk),
    queryFn: () => materialLedgerService.getLocationSummary(includeBags, includeBulk),
    staleTime: 5 * 60_000,
  });
}

export function useBrandGroups() {
  return useQuery({
    queryKey: queryKeys.ledger.brandGroups(),
    queryFn: () => materialLedgerService.getBrandGroups(),
    staleTime: 5 * 60_000,
  });
}
