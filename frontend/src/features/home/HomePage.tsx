import { useQuery } from '@tanstack/react-query';
import {
  PackageOpen, TrendingUp, TrendingDown, Archive,
} from 'lucide-react';
import { queryKeys } from '@/constants/queryKeys';
import { materialLedgerService } from '@/services/material_ledger.service';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCardSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { formatNumber, formatDateTime } from '@/utils/formatters';
import { PlantComparisonChart } from './components/PlantComparisonChart';
import { PerformanceMatrix } from './components/PerformanceMatrix';

// ── KPI card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  accentColor: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  price?: number | null;
}

function KpiCard({ title, value, unit, icon, accentColor, subtitle, trend, price }: KpiCardProps) {
  return (
    <article className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}1a` }}>
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 mb-1">
        <span className="text-2xl font-bold text-gray-900 leading-none">{value}</span>
        <span className="text-sm text-gray-500 mb-0.5">{unit}</span>
        {trend === 'up' && <TrendingUp size={14} className="text-green-500 mb-0.5" />}
        {trend === 'down' && <TrendingDown size={14} className="text-red-500 mb-0.5" />}
      </div>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      {price != null && (
        <p className="text-xs text-gray-400 mt-1">Price: {formatNumber(price, 0)}</p>
      )}
    </article>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function HomePage() {
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useQuery({
    queryKey: queryKeys.ledger.kpis(),
    queryFn: () => materialLedgerService.getKpis(),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="p-4 lg:p-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Operations Overview"
        subtitle={`Tokyo Cement — Material Ledger · ${formatDateTime(new Date().toISOString())}`}
      />

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <section className="mb-6" aria-label="Key metrics">
        {kpisError && <ErrorState message="Failed to load KPIs" />}
        {kpisLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
        ) : kpis && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Opening Stock" value={formatNumber(kpis.opening_stock_mt, 2)}
              unit={kpis.unit} icon={<Archive size={18} />} accentColor="#3D8BAD"
              subtitle="Beginning of period" trend="neutral" price={kpis.opening_price_lkr}
            />
            <KpiCard
              title="Total Receipts" value={formatNumber(kpis.total_receipts_mt, 2)}
              unit={kpis.unit} icon={<TrendingUp size={18} />} accentColor="#22C55E"
              subtitle="Produced + received" trend="up" price={kpis.receipts_price_lkr}
            />
            <KpiCard
              title="Total Consumption" value={formatNumber(kpis.total_consumption_mt, 2)}
              unit={kpis.unit} icon={<TrendingDown size={18} />} accentColor="#E05540"
              subtitle="Sales + internal use" trend="down" price={kpis.consumption_price_lkr}
            />
            <KpiCard
              title="Closing Stock" value={formatNumber(kpis.closing_stock_mt, 2)}
              unit={kpis.unit} icon={<PackageOpen size={18} />} accentColor="#1B3550"
              subtitle="End of period balance" trend="neutral" price={kpis.closing_price_lkr}
            />
          </div>
        )}
      </section>

      {/* ── Plant Comparison ──────────────────────────────────────────── */}
      <div className="mb-4">
        <PlantComparisonChart />
      </div>

      {/* ── Performance Matrix ────────────────────────────────────────── */}
      <div className="mb-4">
        <PerformanceMatrix />
      </div>
    </div>
  );
}
