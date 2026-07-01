import type { ApiResponse, PaginatedApiResponse } from '@/types/common.types';
import type {
  LedgerKpi, MovementRow, LedgerMaterial, LedgerPlant, StockTransfer,
  InventorySummary, InventoryAlerts, MaterialThreshold,
} from '@/types/material_ledger.types';
import { apiClient } from './api.client';

interface MovementParams {
  plant_id?: string;
  material_id?: string;
  obj_type?: string;
  category?: string;
  page?: number;
  page_size?: number;
}

export const materialLedgerService = {
  async getKpis(plantId?: string, materialId?: string): Promise<LedgerKpi> {
    const params: Record<string, string> = {};
    if (plantId) params.plant_id = plantId;
    if (materialId) params.material_id = materialId;
    const res = await apiClient.get<ApiResponse<LedgerKpi>>('/material-ledger/kpis', { params });
    return res.data.data;
  },

  async getMovements(params: MovementParams): Promise<PaginatedApiResponse<MovementRow>> {
    const res = await apiClient.get<PaginatedApiResponse<MovementRow>>('/material-ledger/movements', { params });
    return res.data;
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

  async getInventorySummary(materialIds?: string[], plantIds?: string[]): Promise<InventorySummary> {
    const params = new URLSearchParams();
    if (materialIds?.length) params.set('material_ids', materialIds.join(','));
    plantIds?.forEach(id => params.append('plant_id', id));
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
};
