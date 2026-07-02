/**
 * All React Query cache keys for the dashboard.
 * Every useQuery call must use a key from this factory — never inline strings.
 * Adding a new feature: add a new section here.
 */
export const queryKeys = {
  systemStatus: () => ['system-status'] as const,

  ledger: {
    kpis:      (plantId?: string, materialId?: string) => ['ledger', 'kpis', plantId ?? 'all', materialId ?? 'all'] as const,
    transfers: (plantId?: string, materialId?: string) => ['ledger', 'transfers', plantId ?? 'all', materialId ?? 'all'] as const,
    movements: (plantId?: string, materialId?: string, objType?: string, category?: string, page?: number) =>
      ['ledger', 'movements', plantId ?? 'all', materialId ?? 'all', objType ?? 'all', category ?? 'all', page ?? 1] as const,
    materials: (plantIds?: string[]) => ['ledger', 'materials', plantIds?.join(',') ?? 'all'] as const,
    plants:    () => ['ledger', 'plants'] as const,
  },

  inventory: {
    summary: (materialIds?: string[], plantIds?: string[], zeroStockMode?: string) =>
      ['inventory', 'summary', materialIds?.join(',') ?? 'all', plantIds?.join(',') ?? 'all', zeroStockMode ?? 'accurate'] as const,
    alerts: (materialIds?: string[]) =>
      ['inventory', 'alerts', materialIds?.join(',') ?? 'all'] as const,
    thresholds: () => ['inventory', 'thresholds'] as const,
  },

  report: {
    inventory: (materialIds?: string[], plantIds?: string[]) =>
      ['report', 'inventory', materialIds?.join(',') ?? 'all', plantIds?.join(',') ?? 'all'] as const,
  },

  location: {
    locationSummary: (includeBags: boolean, includeBulk: boolean) =>
      ['location', 'summary', includeBags, includeBulk] as const,
  },

  settings: {
    csvConfig: () => ['settings', 'csv-config'] as const,
  },
} as const;
