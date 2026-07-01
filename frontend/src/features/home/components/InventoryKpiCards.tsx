/** InventoryKpiCards — 4 top-level KPI cards for the inventory dashboard. */

import { Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { KpiCardSkeleton } from '@/components/common/LoadingSkeleton';
import { convertQty, type UnitScale } from '@/hooks/useSettingsStore';
import type { InventorySummary } from '@/types/material_ledger.types';

interface Props {
  summary:   InventorySummary | undefined;
  isLoading: boolean;
  unitScale?: UnitScale;
}

interface CardProps {
  title:       string;
  value:       string;
  unit:        string;
  subtitle:    string;
  icon:        React.ReactNode;
  accentColor: string;
  highlight?:  boolean;   // true for the alert card when alerts > 0
}

function Card({ title, value, unit, subtitle, icon, accentColor, highlight }: CardProps) {
  return (
    <article className={`rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow ${
      highlight ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}1a` }}>
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 mb-1">
        <span className={`text-2xl font-bold leading-none ${highlight ? 'text-red-700' : 'text-gray-900'}`}>
          {value}
        </span>
        <span className="text-sm text-gray-500 mb-0.5">{unit}</span>
      </div>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </article>
  );
}

export function InventoryKpiCards({ summary, isLoading, unitScale }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }
  if (!summary) return null;

  const scale = unitScale ?? { unit: 'MT' as const, bagsPerMt: 1 };
  const alertCount = summary.alert_count;
  const onHand   = convertQty(summary.total_on_hand_mt,     scale);
  const transOut = convertQty(summary.total_in_transit_out,  scale);
  const transIn  = convertQty(summary.total_in_transit_in,   scale);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        title="Available Stock"
        value={onHand.value}
        unit={onHand.unit}
        subtitle="Physical stock balance (EB)"
        icon={<Package size={18} />}
        accentColor="#1B3550"
      />
      <Card
        title="In Transit OUT"
        value={transOut.value}
        unit={transOut.unit}
        subtitle="Dispatched from factories"
        icon={<TrendingUp size={18} />}
        accentColor="#F59E0B"
      />
      <Card
        title="In Transit IN"
        value={transIn.value}
        unit={transIn.unit}
        subtitle="Received at depots"
        icon={<TrendingDown size={18} />}
        accentColor="#22C55E"
      />
      <Card
        title="⚠ Low Stock Alerts"
        value={String(alertCount)}
        unit={alertCount === 1 ? 'plant' : 'plants'}
        subtitle={alertCount === 0 ? 'All plants above minimum' : 'Below minimum threshold'}
        icon={<AlertTriangle size={18} />}
        accentColor="#DC2626"
        highlight={alertCount > 0}
      />
    </div>
  );
}
