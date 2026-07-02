import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap, useMapEvents } from 'react-leaflet';
import { useInventoryAlerts } from '@/features/material_ledger/hooks/useLedger';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import type { LedgerPlant } from '@/types/material_ledger.types';

type PixelPos = { x: number; y: number };

interface PlantAlertSummary {
  out: number;
  low: number;
}

export function StockAlertBubbles({ plants, onSelectPlant }: {
  plants: LedgerPlant[];
  onSelectPlant: (p: LedgerPlant) => void;
}) {
  const map = useMap();
  const { data: alertsData } = useInventoryAlerts();
  const { zeroStockMode } = useSettingsStore();
  const [positions, setPositions] = useState<Record<string, PixelPos>>({});

  const alertsByPlant = useMemo<Record<string, PlantAlertSummary>>(() => {
    if (!alertsData) return {};
    const result: Record<string, PlantAlertSummary> = {};
    for (const row of alertsData.alerts) {
      // Option B (accurate): skip plant-materials never actually stocked
      if (zeroStockMode === 'accurate' && !row.ever_stocked) continue;
      // Option A (active_only): never show out-of-stock, only low
      if (zeroStockMode === 'active_only' && row.status === 'out') continue;

      if (!result[row.plant_id]) result[row.plant_id] = { out: 0, low: 0 };
      if (row.status === 'out') result[row.plant_id].out++;
      else result[row.plant_id].low++;
    }
    return result;
  }, [alertsData, zeroStockMode]);

  const alertPlants = useMemo(
    () => plants.filter(p => p.latitude != null && p.longitude != null && alertsByPlant[p.plant_id]),
    [plants, alertsByPlant],
  );

  const recompute = useCallback(() => {
    const el = map.getContainer();
    if (!el.clientWidth || !el.clientHeight) return;
    const next: Record<string, PixelPos> = {};
    for (const p of alertPlants) {
      const pt = map.latLngToContainerPoint([p.latitude!, p.longitude!]);
      next[p.plant_id] = { x: pt.x, y: pt.y };
    }
    setPositions(next);
  }, [map, alertPlants]);

  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    let raf1: number, raf2: number;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => recompute());
    });
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [map, recompute]);

  useMapEvents({ move: recompute, zoomend: recompute, viewreset: recompute, resize: recompute });

  const container = map.getContainer();
  if (alertPlants.length === 0) return null;

  return createPortal(
    <>
      {alertPlants.map(plant => {
        const pos = positions[plant.plant_id];
        if (!pos) return null;
        const summary = alertsByPlant[plant.plant_id];

        return (
          <button
            key={plant.plant_id}
            onClick={() => onSelectPlant(plant)}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y - 72,
              transform: 'translateX(-50%)',
              pointerEvents: 'auto',
              zIndex: 650,
            }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 px-2.5 py-1.5 text-left min-w-max flex flex-col gap-1"
          >
            <p className="text-[10px] font-bold text-gray-800 max-w-[120px] truncate leading-none">
              {plant.name}
            </p>
            <div className="flex items-center gap-1">
              {summary.out > 0 && (
                <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full leading-none">
                  {summary.out} out
                </span>
              )}
              {summary.low > 0 && (
                <span className="text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full leading-none">
                  {summary.low} low
                </span>
              )}
            </div>
            {/* Tail arrow pointing down toward pin */}
            <div style={{
              position: 'absolute',
              bottom: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '6px solid white',
              filter: 'drop-shadow(0 1px 0 #e5e7eb)',
            }} />
          </button>
        );
      })}
    </>,
    container,
  );
}
