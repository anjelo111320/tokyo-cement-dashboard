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

export interface StockTransferRow {
  source_plant_id:      string;
  source_plant_name:    string;
  dest_plant_id:        string;
  dest_plant_name:      string;
  material_id:          string;
  material_description: string;
  quantity:             number;
  dest_closing_stock:   number;
  price_lkr:            number | null;
  unit:                 string;
}

export interface StockTransfer {
  transfers: StockTransferRow[];
  unit:      string;
}

export interface LedgerMaterial {
  material_id:          string;
  material_description: string;
  closing_stock_mt:     number;
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

// ── Inventory dashboard types ─────────────────────────────────────────────────

export interface PlantInventoryRow {
  plant_id:          string;
  plant_name:        string;
  city:              string | null;
  on_hand_mt:        number;
  in_transit_out_mt: number;
  in_transit_in_mt:  number;
  status:            'ok' | 'low' | 'out';
}

export interface InventorySummary {
  rows:                 PlantInventoryRow[];
  total_on_hand_mt:     number;
  total_in_transit_out: number;
  total_in_transit_in:  number;
  alert_count:          number;
  unit:                 string;
}

export interface InventoryAlertRow {
  plant_id:      string;
  plant_name:    string;
  city:          string | null;
  material_id:   string;
  material_desc: string;
  on_hand_mt:    number;
  threshold_mt:  number;
  pct:           number;
  status:        'low' | 'out';
}

export interface InventoryAlerts {
  alerts: InventoryAlertRow[];
  unit:   string;
}

export interface MaterialThreshold {
  material_id:   string;
  material_desc: string;
  min_stock_mt:  number;
}
