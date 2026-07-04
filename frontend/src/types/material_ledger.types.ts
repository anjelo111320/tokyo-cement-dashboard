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

export interface PlantReportRow {
  plant_id:                  string;
  plant_name:                string;
  city:                      string | null;
  on_hand_mt:                number;
  transit_out_mt:            number;
  transit_in_mt:             number;
  net_transit_mt:            number;
  inventory_without_transit: number;
}

export interface MaterialReportCard {
  material_id:                     string;
  material_description:            string;
  plants:                          PlantReportRow[];
  total_on_hand:                   number;
  total_transit_out:               number;
  total_transit_in:                number;
  total_inventory_without_transit: number;
}

export interface InventoryReport {
  materials: MaterialReportCard[];
  unit:      string;
}

export interface LedgerMaterial {
  material_id:          string;
  material_description: string;
  brand_group:          string | null;
  closing_stock_mt:     number;
  ever_stocked:         boolean;
}

export interface LedgerPlant {
  plant_id:        string;
  name:            string;
  city:            string | null;
  address:         string | null;
  country:         string | null;
  postal_code:     string | null;
  customer_number: string | null;
  plant_type:      string;
  latitude:        number | null;
  longitude:       number | null;
  has_ledger_data: boolean;
}

/** Admin-managed brand group — shared shape for filter dropdowns and Settings thresholds. */
export interface BrandGroupOption {
  id:         string;
  label:      string;
  sort_order: number;
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
  ever_stocked:  boolean;
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

// ── Location Summary types ────────────────────────────────────────────────────

export interface BrandGroupStock {
  stock:      number;
  dispatch:   number;
  transit_in: number;
}

export interface LocationSummaryRow {
  location_id:    string;
  location_label: string;
  brands:         Record<string, BrandGroupStock>;
  total_stock:    number;
  total_dispatch: number;
  inventory_days: number | null;
}

export interface BrandGroupMeta {
  id:       string;
  label:    string;
  has_data: boolean;
}

export interface LocationSummary {
  locations:     LocationSummaryRow[];
  totals:        LocationSummaryRow;
  brand_groups:  BrandGroupMeta[];
  has_date_data: boolean;
  unit:          string;
}
