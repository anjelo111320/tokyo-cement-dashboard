/**
 * Animated in-transit stock transfer arcs overlaid on the Leaflet map.
 *
 * Renders as an SVG portaled into the Leaflet map container so it stays
 * perfectly synced with pan/zoom. Three staggered dots travel along each
 * bezier arc from source plant (coral) to destination plant (sky-blue).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap, useMapEvents } from 'react-leaflet';
import {
  useLedgerTransfers,
  useLedgerPlants,
} from '@/features/material_ledger/hooks/useLedger';
import type { StockTransferRow } from '@/types/material_ledger.types';

// ── Types ──────────────────────────────────────────────────────────────────────

type PixelPos = { x: number; y: number };

type AggTransfer = {
  source_plant_id: string;
  source_plant_name: string;
  dest_plant_id: string;
  dest_plant_name: string;
  total_qty: number;
  unit: string;
  material_count: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function quadPath(s: PixelPos, d: PixelPos, bend: number): string {
  const cx = (s.x + d.x) / 2 - (d.y - s.y) * bend;
  const cy = (s.y + d.y) / 2 + (d.x - s.x) * bend;
  return `M ${s.x} ${s.y} Q ${cx} ${cy} ${d.x} ${d.y}`;
}

function aggregateTransfers(rawTransfers: StockTransferRow[]): AggTransfer[] {
  const m = new Map<string, AggTransfer>();
  for (const t of rawTransfers) {
    const key = `${t.source_plant_id}__${t.dest_plant_id}`;
    const ex = m.get(key);
    if (ex) {
      ex.total_qty += t.quantity;
      ex.material_count += 1;
    } else {
      m.set(key, {
        source_plant_id: t.source_plant_id,
        source_plant_name: t.source_plant_name,
        dest_plant_id: t.dest_plant_id,
        dest_plant_name: t.dest_plant_name,
        total_qty: t.quantity,
        unit: t.unit,
        material_count: 1,
      });
    }
  }
  return [...m.values()];
}

// ── Config ────────────────────────────────────────────────────────────────────

// Alternating bend directions so parallel routes don't overlap
const BENDS = [0.45, -0.45, 0.3, -0.3, 0.6, -0.6];

const DOTS = [
  { r: 5,   opacity: 1,    glow: true  },
  { r: 3.5, opacity: 0.55, glow: false },
  { r: 2.5, opacity: 0.25, glow: false },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function TransferArcs() {
  const map = useMap();
  const { data: plantsRaw = [] } = useLedgerPlants();
  const { data: transfersData }  = useLedgerTransfers();

  const [positions, setPositions] = useState<Record<string, PixelPos>>({});

  const plants = useMemo(
    () => plantsRaw.filter(p => p.latitude != null && p.longitude != null),
    [plantsRaw],
  );

  const aggTransfers = useMemo(
    () => aggregateTransfers(transfersData?.transfers ?? []),
    [transfersData],
  );

  // Convert lat/lng → container pixel coords (recalculated on every move/zoom).
  // Guard: if the container is still 0×0 (flex/fixed layout not yet settled on
  // desktop), latLngToContainerPoint returns (0,0) for every plant, collapsing
  // all arcs to the top-left corner.  Skip and wait for the ResizeObserver.
  const recompute = useCallback(() => {
    const el = map.getContainer();
    if (!el.clientWidth || !el.clientHeight) return;
    const next: Record<string, PixelPos> = {};
    for (const p of plants) {
      const pt = map.latLngToContainerPoint([p.latitude!, p.longitude!]);
      next[p.plant_id] = { x: pt.x, y: pt.y };
    }
    setPositions(next);
  }, [map, plants]);

  // Watch the map container for size changes.  On desktop the fixed+flex layout
  // takes up to two animation frames to settle, so a single-RAF approach misses
  // the window where clientWidth/Height first become non-zero.  The observer
  // fires reliably as soon as the container transitions from 0 → real dimensions,
  // and again on any subsequent resize (browser window resize, panel toggle).
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    // Double-RAF: give the browser two frames so the fixed+flex layout is
    // guaranteed to have resolved before we attempt the first recompute.
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

  // Keep arcs in sync during pan, zoom, and tile resets
  useMapEvents({ move: recompute, zoomend: recompute, viewreset: recompute, resize: recompute });

  const container = map.getContainer();
  if (aggTransfers.length === 0) return null;

  return createPortal(
    <>
      {/* ── SVG arc layer ──────────────────────────────────────────────── */}
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 590,          // above shadows (500), below markers (600)
        }}
      >
        <defs>
          {/* Per-route gradient: coral (source) → sky-blue (dest) */}
          {aggTransfers.map((t, i) => {
            const s = positions[t.source_plant_id];
            const d = positions[t.dest_plant_id];
            if (!s || !d) return null;
            return (
              <linearGradient
                key={i}
                id={`tf-grad-${i}`}
                x1={s.x} y1={s.y}
                x2={d.x} y2={d.y}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%"   stopColor="#E05540" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.9" />
              </linearGradient>
            );
          })}

          {/* Glow filter for the leading dot */}
          <filter id="tf-dot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {aggTransfers.map((t, i) => {
          const s = positions[t.source_plant_id];
          const d = positions[t.dest_plant_id];
          if (!s || !d) return null;

          const bend   = BENDS[i % BENDS.length];
          const pathD  = quadPath(s, d, bend);
          const pathId = `tf-path-${i}`;
          const dur    = 2.0 + i * 0.4;   // stagger duration per route

          return (
            <g key={pathId}>
              {/* Reference path for animateMotion (invisible) */}
              <path id={pathId} d={pathD} fill="none" />

              {/* Soft glow halo behind the arc */}
              <path
                d={pathD} fill="none"
                stroke={`url(#tf-grad-${i})`}
                strokeWidth={7} opacity={0.1}
              />

              {/* Dashed arc line */}
              <path
                d={pathD} fill="none"
                stroke={`url(#tf-grad-${i})`}
                strokeWidth={2} opacity={0.65}
                strokeDasharray="7 5" strokeLinecap="round"
              />

              {/* 3 dots: leading (bright + glow) → trailing (faded) */}
              {DOTS.map(({ r, opacity, glow }, di) => (
                <circle
                  key={di}
                  r={r}
                  fill="#E05540"
                  opacity={opacity}
                  filter={glow ? 'url(#tf-dot-glow)' : undefined}
                >
                  <animateMotion
                    dur={`${dur}s`}
                    begin={`${((dur / DOTS.length) * di).toFixed(2)}s`}
                    repeatCount="indefinite"
                  >
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

    </>,
    container,
  );
}
