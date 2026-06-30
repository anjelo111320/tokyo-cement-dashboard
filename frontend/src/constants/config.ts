export const config = {
  // Empty string = relative URL — Vite proxy forwards /api/* to the backend.
  // This works for both localhost and phones on the same WiFi.
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  refreshIntervalMs: Number(import.meta.env.VITE_REFRESH_INTERVAL_MS ?? 300_000),
  mapTileUrl: import.meta.env.VITE_MAP_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
} as const;
