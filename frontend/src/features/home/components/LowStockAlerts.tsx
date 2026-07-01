/**
 * LowStockAlerts — alert panel shown when any plant is below its threshold.
 * Hidden entirely when there are no alerts.
 */

import { AlertTriangle } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';
import type { InventoryAlerts } from '@/types/material_ledger.types';

interface Props {
  alerts: InventoryAlerts | undefined;
}

export function LowStockAlerts({ alerts }: Props) {
  if (!alerts || alerts.alerts.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={16} className="text-red-600 shrink-0" />
        <h3 className="text-sm font-bold text-red-800">
          Low Stock Alerts — {alerts.alerts.length} plant{alerts.alerts.length !== 1 ? 's' : ''} below minimum
        </h3>
      </div>

      <div className="space-y-3">
        {alerts.alerts.map((alert, i) => {
          const isOut = alert.status === 'out';
          const barColor = isOut ? '#DC2626' : '#F59E0B';
          const badgeClass = isOut
            ? 'bg-red-100 text-red-700'
            : 'bg-amber-100 text-amber-700';

          return (
            <div key={`${alert.plant_id}-${alert.material_id}-${i}`}
              className="bg-white rounded-lg border border-red-100 p-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{alert.plant_name}</p>
                  <p className="text-[10px] text-gray-500">{alert.city ?? ''} · {alert.plant_id}</p>
                  <p className="text-[10px] text-primary-600 font-medium truncate mt-0.5">{alert.material_desc}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
                  {isOut ? 'OUT OF STOCK' : 'LOW STOCK'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${alert.pct}%`, backgroundColor: barColor }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 shrink-0 w-20 text-right">
                  {formatNumber(alert.on_hand_mt, 2)} / {formatNumber(alert.threshold_mt, 1)} {alerts.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
