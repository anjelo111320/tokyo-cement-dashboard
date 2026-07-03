import type { ApiResponse } from '@/types/common.types';
import type {
  LedgerKpi, LedgerMaterial, LedgerPlant, StockTransfer,
  InventorySummary, InventoryAlerts, MaterialThreshold, InventoryReport,
  LocationSummary,
} from '@/types/material_ledger.types';
import { apiClient } from './api.client';

export const materialLedgerService = {
  async getKpis(plantId?: string, materialId?: string): Promise<LedgerKpi> {
    const params: Record<string, string> = {};
    if (plantId) params.plant_id = plantId;
    if (materialId) params.material_id = materialId;
    const res = await apiClient.get<ApiResponse<LedgerKpi>>('/material-ledger/kpis', { params });
    return res.data.data;
  },

  async getStockTransfers(plantId?: string, materialId?: string): Promise<StockTransfer> {
    const params: Record<string, string> = {};
    if (plantId) params.plant_id = plantId;
    if (materialId) params.material_id = materialId;
    const res = await apiClient.get<ApiResponse<StockTransfer>>('/material-ledger/stock-transfers', { params });
    return res.data.data;
  },

  async getMaterials(plantIds?: string[]): Promise<LedgerMaterial[]> {
    const params = new URLSearchParams();
    plantIds?.forEach(id => params.append('plant_id', id));
    const res = await apiClient.get<ApiResponse<LedgerMaterial[]>>(
      '/material-ledger/materials',
      { params: plantIds?.length ? params : undefined },
    );
    return res.data.data;
  },

  async getPlants(): Promise<LedgerPlant[]> {
    const res = await apiClient.get<ApiResponse<LedgerPlant[]>>('/material-ledger/plants');
    return res.data.data;
  },

  async getInventorySummary(materialIds?: string[], plantIds?: string[], zeroStockMode?: string): Promise<InventorySummary> {
    const params = new URLSearchParams();
    if (materialIds?.length) params.set('material_ids', materialIds.join(','));
    plantIds?.forEach(id => params.append('plant_id', id));
    if (zeroStockMode) params.set('zero_stock_mode', zeroStockMode);
    const res = await apiClient.get<ApiResponse<InventorySummary>>(
      '/material-ledger/inventory-summary',
      { params },
    );
    return res.data.data;
  },

  async getInventoryAlerts(materialIds?: string[]): Promise<InventoryAlerts> {
    const params: Record<string, string> = {};
    if (materialIds?.length) params.material_ids = materialIds.join(',');
    const res = await apiClient.get<ApiResponse<InventoryAlerts>>('/material-ledger/inventory-alerts', { params });
    return res.data.data;
  },

  async getInventoryReport(materialIds?: string[], plantIds?: string[]): Promise<InventoryReport> {
    const params = new URLSearchParams();
    if (materialIds?.length) params.set('material_ids', materialIds.join(','));
    plantIds?.forEach(id => params.append('plant_id', id));
    const res = await apiClient.get<ApiResponse<InventoryReport>>(
      '/material-ledger/inventory-report',
      { params },
    );
    return res.data.data;
  },

  async getThresholds(): Promise<MaterialThreshold[]> {
    const res = await apiClient.get<ApiResponse<MaterialThreshold[]>>('/settings/thresholds');
    return res.data.data;
  },

  async setThreshold(materialId: string, minStockMt: number): Promise<MaterialThreshold[]> {
    const res = await apiClient.post<ApiResponse<MaterialThreshold[]>>('/settings/thresholds', {
      material_id: materialId, min_stock_mt: minStockMt,
    });
    return res.data.data;
  },

  async getLocationSummary(includeBags = true, includeBulk = false): Promise<LocationSummary> {
    const res = await apiClient.get<ApiResponse<LocationSummary>>('/material-ledger/location-summary', {
      params: { include_bags: includeBags, include_bulk: includeBulk },
    });
    return res.data.data;
  },
};
