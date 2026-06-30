import type { ApiResponse, PaginatedApiResponse } from '@/types/common.types';
import type {
  LedgerKpi, InventoryFlow, ConsumptionBreakdown,
  MovementRow, LedgerMaterial, LedgerPlant, StockTransfer,
  PlantComparison,
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

  async getInventoryFlow(plantId?: string, materialId?: string): Promise<InventoryFlow> {
    const params: Record<string, string> = {};
    if (plantId) params.plant_id = plantId;
    if (materialId) params.material_id = materialId;
    const res = await apiClient.get<ApiResponse<InventoryFlow>>('/material-ledger/inventory-flow', { params });
    return res.data.data;
  },

  async getConsumption(plantId?: string, materialId?: string): Promise<ConsumptionBreakdown> {
    const params: Record<string, string> = {};
    if (plantId) params.plant_id = plantId;
    if (materialId) params.material_id = materialId;
    const res = await apiClient.get<ApiResponse<ConsumptionBreakdown>>('/material-ledger/consumption', { params });
    return res.data.data;
  },

  async getMovements(params: MovementParams): Promise<PaginatedApiResponse<MovementRow>> {
    const res = await apiClient.get<PaginatedApiResponse<MovementRow>>('/material-ledger/movements', { params });
    return res.data;
  },

  async getPlantComparison(materialId?: string): Promise<PlantComparison> {
    const params = materialId ? { material_id: materialId } : {};
    const res = await apiClient.get<ApiResponse<PlantComparison>>('/material-ledger/plant-comparison', { params });
    return res.data.data;
  },

  async getStockTransfers(plantId?: string, materialId?: string): Promise<StockTransfer> {
    const params: Record<string, string> = {};
    if (plantId) params.plant_id = plantId;
    if (materialId) params.material_id = materialId;
    const res = await apiClient.get<ApiResponse<StockTransfer>>('/material-ledger/stock-transfers', { params });
    return res.data.data;
  },

  async getMaterials(): Promise<LedgerMaterial[]> {
    const res = await apiClient.get<ApiResponse<LedgerMaterial[]>>('/material-ledger/materials');
    return res.data.data;
  },

  async getPlants(): Promise<LedgerPlant[]> {
    const res = await apiClient.get<ApiResponse<LedgerPlant[]>>('/material-ledger/plants');
    return res.data.data;
  },
};
