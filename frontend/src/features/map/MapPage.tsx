import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import { Layers, List, Map as MapIcon, Factory, Warehouse, Anchor, Building2, ArrowLeft, MapPin, Search, X } from 'lucide-react';
import { formatNumber, calcUtilization } from '@/utils/formatters';
import { useLedgerKpis } from '@/features/material_ledger/hooks/useLedger';
import { getPlantTypeInfo } from './components/plantTypeUtils';
import { materialLedgerService } from '@/services/material_ledger.service';
import { queryKeys } from '@/constants/queryKeys';
import { MapBottomSheet } from './components/MapBottomSheet';
import type { SelectedMapItem } from './components/MapBottomSheet';
import { MapErrorBoundary } from './components/MapErrorBoundary';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { cn } from '@/utils/cn';
import {
  getPlantIcon,
  FACTORY_PLANT_IDS, TERMINAL_PLANT_IDS, HQ_PLANT_IDS,
} from './components/mapIcons';
import type { LedgerPlant } from '@/types/material_ledger.types';

// ── Tile layers ───────────────────────────────────────────────────────────────
const CARTO = '&copy; OpenStreetMap contributors &copy; CARTO';
const TILE_LAYERS = {
  light:    { label: 'Light',     url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',     attribution: CARTO, theme: 'light' as const },
  dark:     { label: 'Dark',      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',      attribution: CARTO, theme: 'dark' as const },
  voyager:  { label: 'Color',     url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: CARTO, theme: 'light' as const },
  satellite: { label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri', theme: 'dark' as const },
} as const;
type TileLayerKey = keyof typeof TILE_LAYERS;
type MobileTab = 'map' | 'list';

// ── FlyTo helper ──────────────────────────────────────────────────────────────
function FlyToController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const [lat, lng] = target;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const id = requestAnimationFrame(() => {
      try { map.setView([lat, lng], 11, { animate: true }); } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(id);
  }, [map, target]);
  return null;
}

function TypeIcon({ plantId, size = 14 }: { plantId: string; size?: number }) {
  const { Icon, iconColor } = getPlantTypeInfo(plantId);
  return <Icon size={size} style={{ color: iconColor }} aria-hidden="true" />;
}

// ── Plant list (mobile list tab / desktop side panel) ─────────────────────────
function PlantList({ plants, selectedId, onSelect, onFly }: {
  plants: LedgerPlant[];
  selectedId: string | null;
  onSelect: (p: LedgerPlant) => void;
  onFly: (lat: number, lng: number) => void;
}) {
  const groups = [
    { label: 'Factories', filter: (p: LedgerPlant) => FACTORY_PLANT_IDS.has(p.plant_id) },
    { label: 'Depots',    filter: (p: LedgerPlant) => !FACTORY_PLANT_IDS.has(p.plant_id) && !TERMINAL_PLANT_IDS.has(p.plant_id) && !HQ_PLANT_IDS.has(p.plant_id) },
    { label: 'Terminals', filter: (p: LedgerPlant) => TERMINAL_PLANT_IDS.has(p.plant_id) },
    { label: 'HQ / Admin', filter: (p: LedgerPlant) => HQ_PLANT_IDS.has(p.plant_id) },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-gray-50 lg:bg-white">
      {groups.map(({ label, filter }) => {
        const items = plants.filter(filter);
        if (!items.length) return null;
        return (
          <div key={label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">{label} ({items.length})</p>
            <div className="space-y-1">
              {items.map((p) => (
                <button
                  key={p.plant_id}
                  onClick={() => {
                    onSelect(p);
                    if (p.latitude && p.longitude) onFly(p.latitude, p.longitude);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150',
                    selectedId === p.plant_id
                      ? 'border-primary-600 bg-primary-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-primary-300',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <TypeIcon plantId={p.plant_id} size={15} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{p.city ?? '—'} · {p.plant_id}</p>
                    </div>
                    {p.has_ledger_data && (
                      <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold shrink-0">Data</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Desktop plant detail panel ────────────────────────────────────────────────
function DesktopPlantDetail({ plant, onBack }: { plant: LedgerPlant; onBack: () => void }) {
  const { Icon, iconColor, iconBg, typeLabel } = getPlantTypeInfo(plant.plant_id);
  const { data: kpis, isLoading: kpisLoading } = useLedgerKpis(plant.plant_id);

  const utilization = calcUtilization(
    kpis?.opening_stock_mt     ?? 0,
    kpis?.total_receipts_mt    ?? 0,
    kpis?.total_consumption_mt ?? 0,
  );

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Back button */}
      <button onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-xs font-semibold text-primary-700 hover:bg-gray-50 transition-colors border-b border-gray-100">
        <ArrowLeft size={13} />
        Back to plant list
      </button>

      <div className="p-4 flex-1 space-y-4">
        {/* Header: icon + name + address + pill */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: iconBg }}>
            <Icon size={20} style={{ color: iconColor }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{typeLabel}</p>
              <span className={cn(
                'text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0',
                plant.has_ledger_data ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
              )}>
                {plant.has_ledger_data ? 'Live Data' : 'No Data'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-gray-900 leading-tight">{plant.name}</h3>
            <div className="flex items-start gap-1 mt-1.5">
              <MapPin size={11} className="text-gray-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500 leading-snug">
                {[plant.address, plant.city, plant.postal_code, plant.country].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        </div>

        {/* 2 info cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Plant ID</p>
            <p className="text-base font-bold text-gray-900">{plant.plant_id}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Customer No.</p>
            <p className="text-base font-bold text-gray-900">{plant.customer_number ?? '—'}</p>
          </div>
        </div>

        {/* Analytics */}
        {plant.has_ledger_data && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Ledger Analytics</p>

            {kpisLoading ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                </div>
                <Skeleton className="h-10 rounded-xl" />
              </div>
            ) : kpis ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    { label: 'Opening Stock',     value: kpis.opening_stock_mt,     color: '#3D8BAD' },
                    { label: 'Total Receipts',    value: kpis.total_receipts_mt,    color: '#22C55E' },
                    { label: 'Total Consumption', value: kpis.total_consumption_mt, color: '#E05540' },
                    { label: 'Closing Stock',     value: kpis.closing_stock_mt,     color: '#1B3550' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                      <p className="text-sm font-bold" style={{ color }}>
                        {formatNumber(value, 2)}
                        <span className="text-[10px] font-normal text-gray-400 ml-1">{kpis.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>

                {/* Utilization */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] text-gray-400">Utilization Rate</p>
                    <p className="text-xs font-bold" style={{
                      color: utilization >= 80 ? '#22C55E' : utilization >= 50 ? '#F59E0B' : '#E05540',
                    }}>
                      {formatNumber(utilization, 1)}%
                    </p>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${utilization}%`,
                        backgroundColor: utilization >= 80 ? '#22C55E' : utilization >= 50 ? '#F59E0B' : '#E05540',
                      }} />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Map canvas ────────────────────────────────────────────────────────────────
function MapCanvas({ plants, tileLayer, flyTarget, selectedId, onSelectPlant, isLoading }: {
  plants: LedgerPlant[];
  tileLayer: TileLayerKey;
  flyTarget: [number, number] | null;
  selectedId: string | null;
  onSelectPlant: (p: LedgerPlant) => void;
  isLoading: boolean;
}) {
  const visiblePlants = plants.filter((p) => p.latitude != null && p.longitude != null);

  if (isLoading) return <Skeleton className="absolute inset-0 rounded-none" />;

  return (
    <MapContainer
      center={[7.8731, 80.7718]}   // Sri Lanka geographic center
      zoom={7}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer key={tileLayer} url={TILE_LAYERS[tileLayer].url} attribution={TILE_LAYERS[tileLayer].attribution} maxZoom={19} />
      <FlyToController target={flyTarget} />

      {visiblePlants.map((plant) => (
        <Marker
          key={plant.plant_id}
          position={[plant.latitude!, plant.longitude!]}
          icon={getPlantIcon(plant.plant_id)}
          eventHandlers={{ click: () => onSelectPlant(plant) }}
        >
          {/* Highlight ring for selected plant */}
          {selectedId === plant.plant_id && (
            <Circle
              center={[plant.latitude!, plant.longitude!]}
              radius={FACTORY_PLANT_IDS.has(plant.plant_id) ? 6000 : 3000}
              pathOptions={{ color: '#1D4E6B', fillColor: '#1D4E6B', fillOpacity: 0.06, weight: 2 }}
            />
          )}
          {/* Subtle ring for plants with ledger data */}
          {plant.has_ledger_data && selectedId !== plant.plant_id && (
            <Circle
              center={[plant.latitude!, plant.longitude!]}
              radius={2000}
              pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.04, weight: 1, dashArray: '4 4' }}
            />
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function MapPage() {
  const [selectedItem, setSelectedItem] = useState<SelectedMapItem | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('map');
  const [tileLayer, setTileLayer] = useState<TileLayerKey>('light');
  const [styleOpen, setStyleOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  const { data: plants = [], isLoading } = useQuery({
    queryKey: queryKeys.ledger.plants(),
    queryFn: () => materialLedgerService.getPlants(),
    staleTime: 30 * 60_000,
  });

  const handleSelectPlant = useCallback((plant: LedgerPlant) => {
    setSelectedItem({ type: 'plant', data: plant });
    if (plant.latitude && plant.longitude) {
      setFlyTarget([plant.latitude, plant.longitude]);
    }
  }, []);

  const handleFly = useCallback((lat: number, lng: number) => {
    setFlyTarget([lat, lng]);
    setMobileTab('map');
  }, []);

  const isDarkMap = TILE_LAYERS[tileLayer].theme === 'dark';

  const DOT_COLORS: Record<TileLayerKey, string> = {
    light: '#e5e5e5', dark: '#1a1a2e', voyager: '#3d8bad', satellite: '#16653a',
  };

  const btnBase = cn(
    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-md border transition-all duration-200 backdrop-blur-sm whitespace-nowrap',
    isDarkMap ? 'bg-gray-900/90 border-gray-700 text-gray-200 hover:bg-gray-800/90' : 'bg-white/95 border-gray-200 text-gray-700 hover:bg-gray-100',
  );
  const btnActive = 'bg-[#1D4E6B] text-white border-[#2E6B8A] scale-95 hover:bg-[#1B3550] hover:text-white';

  // Stats
  const factoryCount  = plants.filter((p) => FACTORY_PLANT_IDS.has(p.plant_id)).length;
  const depotCount    = plants.filter((p) => !FACTORY_PLANT_IDS.has(p.plant_id) && !TERMINAL_PLANT_IDS.has(p.plant_id) && !HQ_PLANT_IDS.has(p.plant_id)).length;
  const withDataCount = plants.filter((p) => p.has_ledger_data).length;

  // Search filter
  const q = search.trim().toLowerCase();
  const filteredPlants = q
    ? plants.filter((p) =>
        p.plant_id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.city ?? '').toLowerCase().includes(q) ||
        (p.address ?? '').toLowerCase().includes(q) ||
        (p.postal_code ?? '').toLowerCase().includes(q),
      )
    : plants;

  const LEGEND_ITEMS = [
    { Icon: Factory,   color: '#F59E0B', label: 'Cement Factory' },
    { Icon: Warehouse, color: '#2563EB', label: 'Distribution Depot' },
    { Icon: Anchor,    color: '#DC2626', label: 'Port / Terminal' },
    { Icon: Building2, color: '#16A34A', label: 'HQ / Admin' },
  ];

  // Combined controls overlay (Style + Legend toggles)
  const MapControls = (
    <div className="absolute top-3 right-3 z-999 pointer-events-auto flex flex-col items-end gap-2">
      <div className="flex items-start gap-2">

        {/* Map search — autocomplete */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation(); // prevent Leaflet swallowing keystrokes
              if (e.key === 'Escape') setSearch('');
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Search ID, name, city…"
            className={cn(
              'pl-8 pr-7 py-2 text-xs rounded-xl border shadow-md backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary-400 w-52 placeholder:text-gray-400',
              isDarkMap
                ? 'bg-gray-900/90 border-gray-700 text-gray-200 placeholder:text-gray-500'
                : 'bg-white/95 border-gray-200 text-gray-700',
            )}
          />
          {search && (
            <button
              onClick={(e) => { e.stopPropagation(); setSearch(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear"
            >
              <X size={13} />
            </button>
          )}

          {/* Results dropdown */}
          {q && (
            <div className={cn(
              'absolute top-full left-0 mt-1.5 w-64 rounded-xl border shadow-xl overflow-hidden z-10',
              isDarkMap ? 'bg-gray-900/97 border-gray-700' : 'bg-white border-gray-200',
            )}>
              {filteredPlants.length === 0 ? (
                <p className={cn('px-3 py-3 text-xs', isDarkMap ? 'text-gray-400' : 'text-gray-500')}>
                  No plants found
                </p>
              ) : (
                <>
                  <p className={cn('px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border-b',
                    isDarkMap ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-100')}>
                    {filteredPlants.length} result{filteredPlants.length !== 1 ? 's' : ''}
                  </p>
                  <ul className="max-h-56 overflow-y-auto">
                    {filteredPlants.slice(0, 8).map((p) => (
                      <li key={p.plant_id}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPlant(p);
                            setSearch('');
                          }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                            isDarkMap ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50',
                          )}
                        >
                          <TypeIcon plantId={p.plant_id} size={13} />
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-xs font-semibold truncate', isDarkMap ? 'text-gray-200' : 'text-gray-800')}>
                              {p.name}
                            </p>
                            <p className={cn('text-[10px] truncate', isDarkMap ? 'text-gray-500' : 'text-gray-400')}>
                              {p.city ?? ''} · {p.plant_id}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* Legend toggle */}
        <div className="relative">
          <button
            onClick={() => { setLegendOpen((p) => !p); setStyleOpen(false); }}
            className={cn(btnBase, legendOpen && btnActive)}
          >
            <List size={13} />
            Legend
          </button>
          <div className={cn(
            'absolute top-full right-0 mt-2 w-44 rounded-xl shadow-xl border overflow-hidden transition-all duration-300 ease-out origin-top-right',
            isDarkMap ? 'bg-gray-900/95 border-gray-700' : 'bg-white/97 border-gray-200',
            legendOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none',
          )}>
            <div className={cn('px-3 py-2 border-b text-[10px] font-bold uppercase tracking-widest', isDarkMap ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-400')}>
              Map Legend
            </div>
            <div className="p-2 space-y-1">
              {LEGEND_ITEMS.map(({ Icon, color, label }) => (
                <div key={label} className={cn('flex items-center gap-2.5 px-2 py-1.5 rounded-lg', isDarkMap ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50')}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22` }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                  <span className={cn('text-xs', isDarkMap ? 'text-gray-300' : 'text-gray-700')}>{label}</span>
                </div>
              ))}
              {/* Ledger data indicator */}
              <div className={cn('flex items-center gap-2.5 px-2 py-1.5 rounded-lg', isDarkMap ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50')}>
                <div className="w-6 h-6 rounded-lg border-2 border-dashed border-green-500 flex items-center justify-center shrink-0">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                </div>
                <span className={cn('text-xs', isDarkMap ? 'text-gray-300' : 'text-gray-700')}>Has Ledger Data</span>
              </div>
            </div>
          </div>
        </div>

        {/* Style picker */}
        <div className="relative">
          <button
            onClick={() => { setStyleOpen((p) => !p); setLegendOpen(false); }}
            className={cn(btnBase, styleOpen && btnActive)}
          >
            <Layers size={13} className={cn('transition-transform duration-300', styleOpen && 'rotate-180')} />
            Style
            <span className="w-2.5 h-2.5 rounded-full border border-current/30 shrink-0" style={{ backgroundColor: DOT_COLORS[tileLayer] }} />
          </button>
          <div className={cn(
            'absolute top-full right-0 mt-2 w-40 rounded-xl shadow-xl border overflow-hidden transition-all duration-300 ease-out origin-top-right',
            isDarkMap ? 'bg-gray-900/95 border-gray-700' : 'bg-white/97 border-gray-200',
            styleOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none',
          )}>
            <div className={cn('px-3 py-2 border-b text-[10px] font-bold uppercase tracking-widest', isDarkMap ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-400')}>
              Map Style
            </div>
            {(Object.entries(TILE_LAYERS) as [TileLayerKey, typeof TILE_LAYERS[TileLayerKey]][]).map(([key, layer]) => {
              const isActive = tileLayer === key;
              return (
                <button key={key} onClick={() => { setTileLayer(key); setStyleOpen(false); }}
                  className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-all duration-150',
                    isActive ? 'bg-[#1D4E6B] text-white' : isDarkMap ? 'text-gray-300 hover:bg-gray-700/60' : 'text-gray-700 hover:bg-gray-50')}>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: DOT_COLORS[key], boxShadow: isActive ? '0 0 0 2px #2E6B8A' : 'none' }} />
                  {layer.label}
                  {isActive && <span className="ml-auto text-[9px] bg-[#2E6B8A] text-white px-1.5 py-0.5 rounded-full">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────────────────── */}
      <div className="lg:hidden flex flex-col" style={{ height: 'calc(100dvh - 56px - env(safe-area-inset-top) - 64px - env(safe-area-inset-bottom))' }}>
        {/* Tab bar */}
        <div className="flex bg-white border-b border-gray-200 shrink-0">
          {([
            { id: 'map' as MobileTab,  label: 'Map',                    icon: <MapIcon size={14} /> },
            { id: 'list' as MobileTab, label: `Plants (${plants.length})`, icon: <List size={14} /> },
          ]).map(({ id, label, icon }) => (
            <button key={id} onClick={() => setMobileTab(id)}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2',
                mobileTab === id ? 'border-[#2E6B8A] text-[#2E6B8A] bg-primary-100/40' : 'border-transparent text-gray-500')}>
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Map tab */}
        {mobileTab === 'map' && (
          <div className="relative flex-1 overflow-hidden">
            <MapErrorBoundary>
              <MapCanvas plants={plants} tileLayer={tileLayer} flyTarget={flyTarget}
                selectedId={selectedItem?.data.plant_id ?? null}
                onSelectPlant={handleSelectPlant} isLoading={isLoading} />
            </MapErrorBoundary>
            {!isLoading && MapControls}
          </div>
        )}

        {/* List tab */}
        {mobileTab === 'list' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-100 bg-white shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search plant ID, name, city…"
                  className="w-full pl-8 pr-7 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-gray-400"
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search">
                    <X size={13} />
                  </button>
                )}
              </div>
              {q && (
                <p className="text-[10px] text-gray-400 mt-1.5 px-0.5">
                  {filteredPlants.length} result{filteredPlants.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <PlantList plants={filteredPlants} selectedId={selectedItem?.data.plant_id ?? null}
              onSelect={handleSelectPlant} onFly={handleFly} />
          </div>
        )}
      </div>

      {/* ── DESKTOP ────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        {/* Side panel */}
        <aside className="w-72 shrink-0 flex flex-col bg-white border-r border-gray-200">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Tokyo Cement Plant Network</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Factories', value: factoryCount, color: 'text-[#0D1F2D]' },
                { label: 'Depots',    value: depotCount,   color: 'text-primary-700' },
                { label: 'With Data', value: withDataCount, color: 'text-green-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className={cn('text-base font-bold', color)}>{value}</p>
                  <p className="text-[10px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Search bar */}
          {!selectedItem && (
            <div className="px-3 py-2.5 border-b border-gray-100">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search plant ID, name, city…"
                  className="w-full pl-8 pr-7 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-gray-400"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {q && (
                <p className="text-[10px] text-gray-400 mt-1.5 px-0.5">
                  {filteredPlants.length} result{filteredPlants.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
          {selectedItem
            ? <DesktopPlantDetail plant={selectedItem.data} onBack={() => { setSelectedItem(null); }} />
            : <PlantList plants={filteredPlants} selectedId={null} onSelect={handleSelectPlant} onFly={handleFly} />
          }
          <div className="px-4 py-3 border-t border-gray-100 bg-primary-50">
            <p className="text-[10px] text-primary-700 text-center">Sri Lanka — 30 Tokyo Cement locations</p>
          </div>
        </aside>

        {/* Map */}
        <div className="relative flex-1">
          <MapErrorBoundary>
            <MapCanvas plants={plants} tileLayer={tileLayer} flyTarget={flyTarget}
              selectedId={selectedItem?.data.plant_id ?? null}
              onSelectPlant={handleSelectPlant} isLoading={isLoading} />
          </MapErrorBoundary>
          {!isLoading && MapControls}
        </div>
      </div>

      {/* Bottom sheet (mobile tap) */}
      <MapBottomSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
    </>
  );
}
