import { PackageOpen, TrendingUp, TrendingDown, Archive, Factory, Layers } from 'lucide-react';
import { KpiCardSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { formatNumber } from '@/utils/formatters';
import { useLedgerKpis } from '../hooks/useLedger';

interface Props { plantId?: string; materialId?: string }

interface CardProps {
  title: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  accentColor: string;
  subtitle?: string;
  price?: number | null;
}

function Card({ title, value, unit, icon, accentColor, subtitle, price }: CardProps) {
  return (
    <article className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentColor}1a` }}>
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 mb-1">
        <span className="text-2xl font-bold text-gray-900 leading-none">{value}</span>
        <span className="text-sm text-gray-500 mb-0.5">{unit}</span>
      </div>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      {price != null && (
        <p className="text-xs text-gray-400 mt-1">Price: {formatNumber(price, 0)}</p>
      )}
    </article>
  );
}

export function LedgerKpiCards({ plantId, materialId }: Props) {
  const { data: kpis, isLoading, isError, refetch } = useLedgerKpis(plantId, materialId);

  if (isError) return <ErrorState message="Failed to load KPIs" onRetry={refetch} />;
  if (isLoading) return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)}
    </div>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <Card title="Opening Stock" value={formatNumber(kpis!.opening_stock_mt, 2)} unit={kpis!.unit}
        icon={<Archive size={18} />} accentColor="#3D8BAD"
        subtitle="Start of period balance" price={kpis!.opening_price_lkr} />
      <Card title="Total Receipts" value={formatNumber(kpis!.total_receipts_mt, 2)} unit={kpis!.unit}
        icon={<TrendingUp size={18} />} accentColor="#22C55E"
        subtitle="Stock received / produced" price={kpis!.receipts_price_lkr} />
      <Card title="Total Consumption" value={formatNumber(kpis!.total_consumption_mt, 2)} unit={kpis!.unit}
        icon={<TrendingDown size={18} />} accentColor="#E05540"
        subtitle="Sales + internal use" price={kpis!.consumption_price_lkr} />
      <Card title="Closing Stock" value={formatNumber(kpis!.closing_stock_mt, 2)} unit={kpis!.unit}
        icon={<PackageOpen size={18} />} accentColor="#1B3550"
        subtitle="End of period balance" price={kpis!.closing_price_lkr} />
      <Card title="Active Plants" value={formatNumber(kpis!.active_plants)} unit="plants"
        icon={<Factory size={18} />} accentColor="#8B5CF6"
        subtitle="With non-zero movements" />
      <Card title="Materials Tracked" value={formatNumber(kpis!.materials_tracked)} unit="SKUs"
        icon={<Layers size={18} />} accentColor="#F59E0B"
        subtitle="Distinct material codes" />
    </div>
  );
}
