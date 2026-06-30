/**
 * Types mirror the backend schemas/material_ledger.py exactly.
 * extra_fields is typed as Record<string, unknown> so new CSV columns
 * flow through without any frontend code change.
 */

export interface LedgerKpi {
  opening_stock_mt:      number;
  closing_stock_mt:      number;
  total_receipts_mt:     number;
  total_consumption_mt:  number;
  opening_price_lkr:     number | null;
  closing_price_lkr:     number | null;
  receipts_price_lkr:    number | null;
  consumption_price_lkr: number | null;
  active_plants:         number;
  materials_tracked:     number;
  unit:                  string;
}

export interface CategoryFlowRow {
  category_code:   string;
  label:           string;
  quantity:        number;
  total_price_lkr: number | null;
  sign:            number;     // +1 adds, -1 reduces
  color:           string;
  role:            string;     // opening | inflow | summary | outflow | closing | unknown
  unit:            string;
}

export interface InventoryFlow {
  rows: CategoryFlowRow[];
  unit: string;
}


export interface ConsumptionCategory {
  proc_cat: string;
  label:    string;
  quantity: number;
  pct:      number;
  unit:     string;
}

export interface ConsumptionBreakdown {
  total_consumption_mt: number;
  categories:           ConsumptionCategory[];
  unit:                 string;
}

export interface MovementRow {
  plant_id:             string;
  material_id:          string;
  material_description: string;
  obj_type:             string;
  obj_type_label:       string;
  category:             string;
  category_label:       string;
  category_color:       string;
  movement_description: string;
  proc_cat_name:        string | null;
  proc_cat_label:       string;
  quantity:             number;
  price:                number | null;
  unit:                 string;
  // Any new CSV column appears here automatically — no type change needed.
  extra_fields:         Record<string, unknown>;
}

export interface PlantComparisonRow {
  plant_id:       string;
  plant_name:     string;
  city:           string | null;
  opening_mt:     number;
  receipts_mt:    number;
  consumption_mt: number;
  closing_mt:     number;
}

export interface PlantComparison {
  plants: PlantComparisonRow[];
  unit:   string;
}

export interface StockTransferRow {
  source_plant_id:   string;
  source_plant_name: string;
  dest_plant_id:     string;
  dest_plant_name:   string;
  quantity:          number;
  price_lkr:         number | null;
  unit:              string;
}

export interface StockTransfer {
  transfers: StockTransferRow[];
  unit:      string;
}

export interface LedgerMaterial {
  material_id:          string;
  material_description: string;
}

export interface LedgerPlant {
  plant_id:        string;
  name:            string;
  city:            string | null;
  address:         string | null;
  country:         string | null;
  postal_code:     string | null;
  customer_number: string | null;
  latitude:        number | null;
  longitude:       number | null;
  has_ledger_data: boolean;
}
