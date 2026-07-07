import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLocationSummary, useLedgerPlants } from '@/features/material_ledger/hooks/useLedger';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { MultiPlantPicker } from '@/features/home/components/MultiPlantPicker';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { cn } from '@/utils/cn';
import type { LocationSummary, LocationSummaryRow, BrandGroupMeta } from '@/types/material_ledger.types';

type MaterialType = 'bags' | 'bulk' | 'all';
type DisplayUnit  = 'MT' | 'bags';
type ExportScope  = 'stock' | 'dispatch' | 'both';

function fmt(n: number): string {
  if (n === 0) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

const MAT_TYPES: { key: MaterialType; label: string }[] = [
  { key: 'bags', label: '50kg Bags' },
  { key: 'bulk', label: 'Bulk'      },
  { key: 'all',  label: 'All'       },
];

const EXPORT_SCOPES: { key: ExportScope; label: string }[] = [
  { key: 'stock',    label: 'Floor Stock only' },
  { key: 'dispatch', label: 'Dispatch only'    },
  { key: 'both',     label: 'Both tables'      },
];

const EMPTY_ROW: LocationSummaryRow = {
  plant_id: '', plant_name: '', city: null, brands: {},
  total_stock: 0, total_dispatch: 0, inventory_days: null,
};

// ── Export helpers ───────────────────────────────────────────────────────────

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildSectionRows(
  data: LocationSummary,
  activeBrands: BrandGroupMeta[],
  getValue: (row: LocationSummaryRow, brandId: string) => number,
  getTotalValue: (row: LocationSummaryRow) => number,
  convert: (mt: number) => number,
): { head: string[]; body: string[][] } {
  const head = ['Plant ID', 'Plant Name', ...activeBrands.map(b => b.label), 'Total'];
  const body = data.locations.map(row => [
    row.plant_id,
    row.plant_name,
    ...activeBrands.map(b => String(convert(getValue(row, b.id)))),
    String(convert(getTotalValue(row))),
  ]);
  body.push([
    'TOTAL',
    '',
    ...activeBrands.map(b => String(convert(getValue(data.totals, b.id)))),
    String(convert(getTotalValue(data.totals))),
  ]);
  return { head, body };
}

const SECTIONS: { key: 'stock' | 'dispatch'; title: string; getValue: (row: LocationSummaryRow, bid: string) => number; getTotal: (row: LocationSummaryRow) => number }[] = [
  { key: 'stock',    title: 'Warehouse Floor Stock', getValue: (r, bid) => r.brands[bid]?.stock ?? 0,    getTotal: r => r.total_stock },
  { key: 'dispatch', title: 'Dispatch - Period',      getValue: (r, bid) => r.brands[bid]?.dispatch ?? 0, getTotal: r => r.total_dispatch },
];

function sectionsForScope(scope: ExportScope) {
  if (scope === 'both') return SECTIONS;
  return SECTIONS.filter(s => s.key === scope);
}

function exportCsv(
  data: LocationSummary,
  activeBrands: BrandGroupMeta[],
  unitLabel: string,
  convert: (mt: number) => number,
  scope: ExportScope,
): void {
  const lines: string[] = [];

  sectionsForScope(scope).forEach(({ title, getValue, getTotal }) => {
    const { head, body } = buildSectionRows(data, activeBrands, getValue, getTotal, convert);
    lines.push(csvField(`${title} (${unitLabel})`));
    lines.push(head.map(csvField).join(','));
    body.forEach(r => lines.push(r.map(csvField).join(',')));
    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `location-summary-${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportPdf(
  data: LocationSummary,
  activeBrands: BrandGroupMeta[],
  unitLabel: string,
  convert: (mt: number) => number,
  matTypeLabel: string,
  scope: ExportScope,
): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(14);
  doc.text('Location Summary', 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Material type: ${matTypeLabel} · Unit: ${unitLabel} · Generated ${new Date().toLocaleString()}`, 14, 20);
  doc.setTextColor(0);

  let y = 28;
  sectionsForScope(scope).forEach(({ title, getValue, getTotal }) => {
    const { head, body } = buildSectionRows(data, activeBrands, getValue, getTotal, convert);
    doc.setFontSize(11);
    doc.text(`${title} (${unitLabel})`, 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [head],
      body,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [13, 31, 45] },
      margin: { left: 14, right: 14 },
    });
    const withTable = doc as unknown as { lastAutoTable: { finalY: number } };
    y = withTable.lastAutoTable.finalY + 12;
  });

  doc.save(`location-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Export button with scope prompt ─────────────────────────────────────────

function ExportButton({
  icon,
  label,
  onPick,
}: {
  icon: React.ReactNode;
  label: string;
  onPick: (scope: ExportScope) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 transition-all"
      >
        {icon} {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-44 overflow-hidden">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
              Include which table?
            </p>
            {EXPORT_SCOPES.map(({ key, label: scopeLabel }) => (
              <button
                key={key}
                onClick={() => { onPick(key); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {scopeLabel}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

function SummaryTable({
  title,
  locations,
  totals,
  activeBrands,
  getValue,
  getTotalValue,
  highlightZero,
  isLoading,
}: {
  title: string;
  locations: LocationSummaryRow[];
  totals: LocationSummaryRow;
  activeBrands: BrandGroupMeta[];
  getValue: (row: LocationSummaryRow, brandId: string) => number;
  getTotalValue: (row: LocationSummaryRow) => number;
  highlightZero: (row: LocationSummaryRow, brandId: string) => boolean;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">{title}</h3>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-[#0D1F2D] text-white">
            <tr>
              <th className="sticky left-0 z-10 bg-[#0D1F2D] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest whitespace-nowrap min-w-50 border-r border-[#1B3550]">
                Plant
              </th>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <th key={i} className="px-3 py-3">
                      <Skeleton className="h-2.5 w-14 ml-auto" />
                    </th>
                  ))
                : activeBrands.map(b => (
                    <th
                      key={b.id}
                      className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest whitespace-nowrap min-w-22.5 text-[#A8CFDF]"
                    >
                      {b.label}
                    </th>
                  ))
              }
              <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest whitespace-nowrap min-w-22.5 border-l border-[#1B3550] text-white">
                Total
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="bg-white">
                    <td className="sticky left-0 bg-white px-4 py-3 border-r border-gray-100">
                      <Skeleton className="h-3 w-36" />
                    </td>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-3 py-3 text-right">
                        <Skeleton className="h-3 w-10 ml-auto" />
                      </td>
                    ))}
                  </tr>
                ))
              : locations.length === 0 ? (
                  <tr>
                    <td colSpan={activeBrands.length + 2} className="px-4 py-6 text-center text-xs text-gray-400">
                      No plants match your filters
                    </td>
                  </tr>
                )
              : locations.map((row, i) => {
                  const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                  return (
                    <tr key={row.plant_id} className={cn('hover:bg-blue-50/30 transition-colors', rowBg)}>
                      <td className={cn(
                        'sticky left-0 z-10 px-4 py-2.5 text-xs font-semibold text-gray-900 whitespace-nowrap border-r border-gray-100',
                        rowBg,
                      )}>
                        {row.plant_name}
                        <p className="text-[9px] font-mono font-normal text-gray-400 mt-0.5">
                          {row.plant_id}{row.city ? ` · ${row.city}` : ''}
                        </p>
                      </td>
                      {activeBrands.map(b => {
                        const v     = getValue(row, b.id);
                        const alert = highlightZero(row, b.id);
                        return (
                          <td
                            key={b.id}
                            className={cn(
                              'px-3 py-2.5 text-right text-xs tabular-nums whitespace-nowrap',
                              alert   ? 'bg-red-50 text-red-600 font-semibold' :
                              v === 0 ? 'text-gray-300' : 'text-gray-800',
                            )}
                          >
                            {fmt(v)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums border-l border-gray-200 text-[#1D4E6B]">
                        {fmt(getTotalValue(row))}
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>

          {!isLoading && (
            <tfoot>
              <tr className="bg-[#0D1F2D]/5 border-t-2 border-[#0D1F2D]/20">
                <td className="sticky left-0 bg-[#0D1F2D]/5 px-4 py-3 text-xs font-bold text-gray-900 uppercase tracking-widest border-r border-gray-200">
                  Total
                </td>
                {activeBrands.map(b => (
                  <td key={b.id} className="px-3 py-3 text-right text-xs font-bold tabular-nums text-gray-900">
                    {fmt(getValue(totals, b.id))}
                  </td>
                ))}
                <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-[#1D4E6B] border-l border-gray-200">
                  {fmt(getTotalValue(totals))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function LocationSummaryView() {
  const [matType,        setMatType]        = useState<MaterialType>('bags');
  const [unit,           setUnit]           = useState<DisplayUnit>('MT');
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [activeOnly,     setActiveOnly]     = useState(false);
  const { allUnitScales } = useSettingsStore();
  const { data: plants = [] } = useLedgerPlants();

  const includeBags = matType === 'bags' || matType === 'all';
  const includeBulk = matType === 'bulk' || matType === 'all';

  const { data, isLoading, isError } = useLocationSummary(includeBags, includeBulk, selectedPlants, activeOnly);

  // Every admin-configured brand group always shows as a column now, even
  // ones with no data under the current material-type filter.
  const activeBrands: BrandGroupMeta[] = data?.brand_groups ?? [];

  // Location Summary's brand-group cells already sum multiple materials into
  // one MT figure server-side, so a per-material bags-per-MT conversion isn't
  // available here — by product decision, every quantity (bag or bulk alike)
  // converts using the one bag-weight ratio configured in Settings.
  const bagsPerMt = Object.values(allUnitScales).find(s => s.unit === 'bags')?.bagsPerMt ?? 20;
  const convert   = (mt: number) => unit === 'bags' ? Math.round(mt * bagsPerMt) : mt;
  const unitLabel = unit === 'bags' ? 'Bags' : 'MT';
  const matTypeLabel = MAT_TYPES.find(m => m.key === matType)?.label ?? matType;

  if (isError) {
    return <p className="text-sm text-red-500 text-center py-8">Failed to load location summary.</p>;
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Filters + export */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4 flex-wrap justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Material Type</span>
              <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                {MAT_TYPES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setMatType(key)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                      matType === key ? 'bg-[#1D4E6B] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Unit</span>
              <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                {(['MT', 'bags'] as DisplayUnit[]).map(u => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                      unit === u ? 'bg-[#1D4E6B] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800',
                    )}
                  >
                    {u === 'bags' ? 'Bags' : 'MT'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setActiveOnly(v => !v)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                activeOnly
                  ? 'bg-[#1B3550] text-white border-[#1B3550]'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
              )}
            >
              {activeOnly ? 'Active materials only ✓' : 'Active materials only'}
            </button>
          </div>

          {data && (
            <div className="flex items-center gap-2">
              <ExportButton
                icon={<Download size={12} />}
                label="CSV"
                onPick={scope => exportCsv(data, activeBrands, unitLabel, convert, scope)}
              />
              <ExportButton
                icon={<FileText size={12} />}
                label="PDF"
                onPick={scope => exportPdf(data, activeBrands, unitLabel, convert, matTypeLabel, scope)}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest shrink-0">Plants</span>
          <MultiPlantPicker plants={plants} selected={selectedPlants} onChange={setSelectedPlants} />
        </div>
      </div>

      {/* Stock table */}
      <SummaryTable
        title={`Warehouse Floor Stock (${unitLabel})`}
        locations={data?.locations ?? []}
        totals={data?.totals ?? EMPTY_ROW}
        activeBrands={activeBrands}
        getValue={(row, bid) => convert(row.brands[bid]?.stock ?? 0)}
        getTotalValue={row => convert(row.total_stock)}
        highlightZero={(row, bid) => (row.brands[bid]?.stock ?? 0) === 0 && (row.brands[bid]?.dispatch ?? 0) > 0}
        isLoading={isLoading}
      />

      {/* Dispatch table */}
      <SummaryTable
        title={`Dispatch — Period (${unitLabel})`}
        locations={data?.locations ?? []}
        totals={data?.totals ?? EMPTY_ROW}
        activeBrands={activeBrands}
        getValue={(row, bid) => convert(row.brands[bid]?.dispatch ?? 0)}
        getTotalValue={row => convert(row.total_dispatch)}
        highlightZero={() => false}
        isLoading={isLoading}
      />

    </div>
  );
}
