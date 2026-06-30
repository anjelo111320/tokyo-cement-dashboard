import React, { createContext, useContext, useState } from 'react';
import type { DateRangePreset } from '@/types/common.types';

interface FilterContextValue {
  plantId: string | undefined;
  setPlantId: (id: string | undefined) => void;
  datePreset: DateRangePreset;
  setDatePreset: (preset: DateRangePreset) => void;
  dateFrom: string | undefined;
  setDateFrom: (d: string | undefined) => void;
  dateTo: string | undefined;
  setDateTo: (d: string | undefined) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [plantId, setPlantId] = useState<string | undefined>(undefined);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('7d');
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);

  return (
    <FilterContext.Provider value={{ plantId, setPlantId, datePreset, setDatePreset, dateFrom, setDateFrom, dateTo, setDateTo }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used within FilterProvider');
  return ctx;
}
