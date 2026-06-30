/**
 * All React Query cache keys for the dashboard.
 * Every useQuery call must use a key from this factory — never inline strings.
 * Adding a new feature: add a new section here.
 */
export const queryKeys = {
  systemStatus: () => ['system-status'] as const,

  ledger: {
    kpis:        (plantId?: string, materialId?: string) => ['ledger', 'kpis', plantId ?? 'all', materialId ?? 'all'] as const,
    flow:        (plantId?: string, materialId?: string) => ['ledger', 'flow', plantId ?? 'all', materialId ?? 'all'] as const,
    consumption: (plantId?: string, materialId?: string) => ['ledger', 'consumption', plantId ?? 'all', materialId ?? 'all'] as const,
    transfers:      (plantId?: string, materialId?: string) => ['ledger', 'transfers', plantId ?? 'all', materialId ?? 'all'] as const,
    plantComparison: (materialId?: string) => ['ledger', 'plant-comparison', materialId ?? 'all'] as const,
    movements:   (plantId?: string, materialId?: string, objType?: string, category?: string, page?: number) =>
      ['ledger', 'movements', plantId ?? 'all', materialId ?? 'all', objType ?? 'all', category ?? 'all', page ?? 1] as const,
    materials:   () => ['ledger', 'materials'] as const,
    plants:      () => ['ledger', 'plants'] as const,
  },

  settings: {
    csvConfig: () => ['settings', 'csv-config'] as const,
  },
} as const;
