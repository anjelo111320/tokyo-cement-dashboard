import { divIcon, type DivIcon } from 'leaflet';

// ── Icon inner shapes — bold filled geometry, designed for ~22px circle ───────
// Each shape sits in a 16×16 coordinate space, translated to sit inside the
// white circle at (18,18) in the 36px pin SVG. Centre = (8,8) in local space.

// Factory — building body + two chimneys + white window slots
const FACTORY_INNER = `
<g transform="translate(10,10)">
  <rect x="1.5" y="0"   width="3.5" height="7"  fill="#F59E0B" rx="0.8"/>
  <rect x="8"   y="2"   width="3"   height="5"  fill="#F59E0B" rx="0.8"/>
  <rect x="0"   y="7"   width="16"  height="9"  fill="#F59E0B" rx="1"/>
  <rect x="2"   y="9"   width="2.5" height="3"  fill="white"   rx="0.4"/>
  <rect x="6.5" y="9"   width="2.5" height="3"  fill="white"   rx="0.4"/>
  <rect x="11"  y="9"   width="2.5" height="3"  fill="white"   rx="0.4"/>
</g>`;

// Warehouse / Depot — pitched roof + building body + door
const DEPOT_INNER = `
<g transform="translate(10,10)">
  <polygon points="8,0 15.5,7 0.5,7" fill="#2563EB"/>
  <rect    x="1"  y="7"  width="14" height="9"  fill="#2563EB" rx="0.8"/>
  <rect    x="5"  y="11" width="6"  height="5"  fill="white"   rx="0.4"/>
</g>`;

// Port / Terminal — bold anchor: thick ring, shaft, crossbar, flukes
const TERMINAL_INNER = `
<g transform="translate(10,10)">
  <circle cx="8" cy="3.5" r="3"   fill="none" stroke="#DC2626" stroke-width="2.8"/>
  <rect   x="7"  y="6.5" width="2.2" height="8.5" fill="#DC2626" rx="1"/>
  <rect   x="1"  y="9"   width="14"  height="2.2" fill="#DC2626" rx="1"/>
  <circle cx="2"  cy="10.1" r="2"   fill="#DC2626"/>
  <circle cx="14" cy="10.1" r="2"   fill="#DC2626"/>
</g>`;

// HQ / Admin — office tower with windows
const HQ_INNER = `
<g transform="translate(10,10)">
  <rect x="3"   y="1"   width="10" height="15" fill="#16A34A" rx="1"/>
  <rect x="4.5" y="3"   width="3"  height="3"  fill="white"   rx="0.4"/>
  <rect x="9.5" y="3"   width="3"  height="3"  fill="white"   rx="0.4"/>
  <rect x="4.5" y="8"   width="3"  height="3"  fill="white"   rx="0.4"/>
  <rect x="9.5" y="8"   width="3"  height="3"  fill="white"   rx="0.4"/>
  <rect x="6"   y="12"  width="4"  height="4"  fill="white"   rx="0.4"/>
</g>`;

// ── Pin builder ───────────────────────────────────────────────────────────────
function makePinIcon(
  fillColor: string,
  borderColor: string,
  svgInner: string,
  plantId: string,
): DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="56" viewBox="0 0 36 56">
      <path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.059 27.941 0 18 0z"
        fill="${fillColor}" stroke="${borderColor}" stroke-width="1.5"/>
      <circle cx="18" cy="18" r="11" fill="white" fill-opacity="0.96"/>
      ${svgInner}
      <rect x="3" y="45" width="30" height="11" rx="3"
        fill="${fillColor}" fill-opacity="0.92"/>
      <text x="18" y="53.5"
        text-anchor="middle"
        font-family="monospace"
        font-size="7.5"
        font-weight="bold"
        fill="white">${plantId}</text>
    </svg>`;
  return divIcon({
    html: svg,
    className: '',
    iconSize:   [36, 56],
    iconAnchor: [18, 44],
    popupAnchor:[0, -46],
  });
}

// ── Icon cache ────────────────────────────────────────────────────────────────
// Keyed by `${plantId}:${plantType}` so an admin changing a plant's type in
// the admin panel produces a fresh icon instead of serving a stale cached one.
const _cache = new Map<string, DivIcon>();

/** plantType comes from the plant's admin-managed Plant.plant_type field
 * (factory | terminal | hq | depot) — not derived from the plant ID. */
export function getPlantIcon(plantId: string, plantType: string): DivIcon {
  const cacheKey = `${plantId}:${plantType}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)!;

  let icon: DivIcon;
  if (plantType === 'factory') {
    icon = makePinIcon('#F59E0B', '#D97706', FACTORY_INNER,  plantId);
  } else if (plantType === 'terminal') {
    icon = makePinIcon('#DC2626', '#B91C1C', TERMINAL_INNER, plantId);
  } else if (plantType === 'hq') {
    icon = makePinIcon('#16A34A', '#15803D', HQ_INNER,       plantId);
  } else {
    icon = makePinIcon('#2563EB', '#1D4ED8', DEPOT_INNER,    plantId);
  }

  _cache.set(cacheKey, icon);
  return icon;
}
