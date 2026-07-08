import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService, type AdminPlant, type AdminMaterial, type AdminBrandGroup, type SharePointConfig } from '@/services/admin.service';
import { cn } from '@/utils/cn';
import { Trash2, Plus, X, RotateCcw, Check, Upload, Database } from 'lucide-react';

type Tab = 'plants' | 'materials' | 'datasets' | 'sharepoint' | 'users';

const TABS: { key: Tab; label: string }[] = [
  { key: 'plants',     label: 'Plants'      },
  { key: 'materials',  label: 'Materials'   },
  { key: 'datasets',   label: 'Datasets'    },
  { key: 'sharepoint', label: 'SharePoint'  },
  { key: 'users',      label: 'Users'       },
];

// ── Small reusable primitives ──────────────────────────────────────────────────

function SaveBtn({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#1D4E6B] text-white hover:bg-[#163a52] disabled:opacity-50 transition-colors">
      {loading ? 'Saving…' : 'Save'}
    </button>
  );
}

// ── Plants tab ─────────────────────────────────────────────────────────────────

const PLANT_TYPES = ['depot', 'factory', 'terminal', 'hq'];
const BLANK_PLANT: AdminPlant = { plant_id: '', name: '', city: null, lat: null, lng: null, plant_type: 'depot', is_active: true, is_new: false };

function PlantsTab() {
  const qc = useQueryClient();
  const { data: plants = [], isLoading } = useQuery({ queryKey: ['admin', 'plants'], queryFn: adminService.getPlants });
  const [edits,   setEdits]   = useState<Record<string, Partial<AdminPlant>>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [draft,   setDraft]   = useState<AdminPlant>({ ...BLANK_PLANT });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'plants'] });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AdminPlant> }) => adminService.updatePlant(id, body),
    onSuccess: (_data, { id }) => { invalidate(); setEdits(prev => { const n = { ...prev }; delete n[id]; return n; }); },
  });
  const createMut = useMutation({
    mutationFn: (body: AdminPlant) => adminService.createPlant(body),
    onSuccess: () => { invalidate(); setShowAdd(false); setDraft({ ...BLANK_PLANT }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => adminService.deletePlant(id),
    onSuccess: invalidate,
  });

  function field(key: keyof AdminPlant, cls = 'w-40') {
    return (
      <input
        className={cn('border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1D4E6B]', cls)}
        value={(draft[key] as string) ?? ''}
        onChange={ev => setDraft(d => ({ ...d, [key]: ev.target.value }))}
        placeholder={String(key)}
      />
    );
  }

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1D4E6B] text-white hover:bg-[#163a52] transition-colors"
        >
          {showAdd ? <><X size={12} /> Cancel</> : <><Plus size={12} /> Add Plant</>}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-xs">
          <thead className="bg-[#0D1F2D] text-white">
            <tr>
              {['ID', 'Name', 'City', 'Type', 'Active', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-widest text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">

            {/* ── Add row ── */}
            {showAdd && (
              <tr className="bg-blue-50">
                <td className="px-3 py-2">{field('plant_id', 'w-20')}</td>
                <td className="px-3 py-2">{field('name', 'w-44')}</td>
                <td className="px-3 py-2">{field('city', 'w-28')}</td>
                <td className="px-3 py-2">
                  <select
                    className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1D4E6B]"
                    value={draft.plant_type}
                    onChange={ev => setDraft(d => ({ ...d, plant_type: ev.target.value }))}
                  >
                    {PLANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={draft.is_active}
                    onChange={ev => setDraft(d => ({ ...d, is_active: ev.target.checked }))} />
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => createMut.mutate(draft)}
                    disabled={!draft.plant_id || !draft.name || createMut.isPending}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#1D4E6B] text-white hover:bg-[#163a52] disabled:opacity-40 transition-colors"
                  >
                    {createMut.isPending ? 'Saving…' : 'Create'}
                  </button>
                </td>
              </tr>
            )}

            {/* ── Existing rows ── */}
            {plants.map(p => {
              const e      = edits[p.plant_id] ?? {};
              const dirty  = !!edits[p.plant_id];
              const hidden = !p.is_active;
              const set    = (key: keyof AdminPlant, val: unknown) =>
                setEdits(prev => ({ ...prev, [p.plant_id]: { ...prev[p.plant_id], [key]: val } }));

              return (
                <tr key={p.plant_id} className={cn(
                  'transition-colors',
                  hidden ? 'bg-gray-50 opacity-60' : p.is_new ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50',
                )}>
                  <td className="px-3 py-2 font-mono text-gray-500">
                    {p.plant_id}
                    {hidden && <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 bg-gray-200 text-gray-500 rounded">HIDDEN</span>}
                    {!hidden && p.is_new && (
                      <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 bg-yellow-200 text-yellow-800 rounded" title="Discovered from CSV — not yet reviewed">NEW</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="border border-gray-200 rounded px-2 py-1 text-xs w-44 focus:outline-none focus:ring-1 focus:ring-[#1D4E6B] disabled:opacity-50"
                      value={(e.name ?? p.name) as string}
                      disabled={hidden}
                      onChange={ev => set('name', ev.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="border border-gray-200 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-[#1D4E6B] disabled:opacity-50"
                      value={(e.city ?? p.city) ?? ''}
                      disabled={hidden}
                      onChange={ev => set('city', ev.target.value || null)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1D4E6B] disabled:opacity-50"
                      value={e.plant_type ?? p.plant_type}
                      disabled={hidden}
                      onChange={ev => set('plant_type', ev.target.value)}
                    >
                      {PLANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn('text-[10px] font-bold', p.is_active ? 'text-green-600' : 'text-gray-400')}>
                      {p.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {dirty && !hidden && (
                        <SaveBtn
                          onClick={() => updateMut.mutate({ id: p.plant_id, body: e })}
                          loading={updateMut.isPending}
                        />
                      )}
                      {!hidden && p.is_new && !dirty && (
                        <button
                          onClick={() => updateMut.mutate({ id: p.plant_id, body: { is_new: false } })}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
                          title="Dismiss — mark as reviewed"
                        >
                          <Check size={10} /> Dismiss
                        </button>
                      )}
                      {hidden ? (
                        <button
                          onClick={() => updateMut.mutate({ id: p.plant_id, body: { is_active: true } })}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          title="Restore plant — make visible again"
                        >
                          <RotateCcw size={10} /> Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (window.confirm(`Hide plant ${p.plant_id} — ${p.name}?\nIt will disappear from the dashboard but stays in the database (recoverable from this page).`))
                              deleteMut.mutate(p.plant_id);
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Hide plant from dashboard"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Materials tab ──────────────────────────────────────────────────────────────

const BLANK_MAT: AdminMaterial = { material_id: '', description: '', brand_group: null, is_bag: true, is_bulk: false, is_active: true, is_new: false, in_dataset: true };

/** Brand group dropdown, fed by the admin-managed brand_groups table. Includes
 * an inline "add new group" flow so a new group is usable immediately —
 * it then shows up everywhere else that reads brand_groups (Location Summary
 * report, this same dropdown for other materials). */
function BrandGroupSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (val: string | null) => void;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const { data: groups = [] } = useQuery({ queryKey: ['admin', 'brand-groups'], queryFn: adminService.getBrandGroups });
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const createMut = useMutation({
    mutationFn: (label: string) => adminService.createBrandGroup(label),
    onSuccess: (group: AdminBrandGroup) => {
      qc.invalidateQueries({ queryKey: ['admin', 'brand-groups'] });
      onChange(group.id);
      setAdding(false);
      setNewLabel('');
    },
  });

  if (adding) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          className="border border-gray-200 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-[#1D4E6B]"
          placeholder="New group"
          value={newLabel}
          onChange={ev => setNewLabel(ev.target.value)}
          onKeyDown={ev => {
            if (ev.key === 'Enter' && newLabel.trim()) createMut.mutate(newLabel.trim());
            if (ev.key === 'Escape') setAdding(false);
          }}
        />
        <button
          onClick={() => newLabel.trim() && createMut.mutate(newLabel.trim())}
          disabled={!newLabel.trim() || createMut.isPending}
          className="text-[10px] font-bold text-green-600 hover:text-green-700 disabled:opacity-40"
          title="Save new group"
        >
          {createMut.isPending ? '…' : 'Add'}
        </button>
        <button onClick={() => setAdding(false)} className="text-gray-300 hover:text-red-500" title="Cancel">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <select
      className="border border-gray-200 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-[#1D4E6B] disabled:opacity-50"
      value={value ?? ''}
      disabled={disabled}
      onChange={ev => {
        if (ev.target.value === '__add__') { setAdding(true); return; }
        onChange(ev.target.value || null);
      }}
    >
      <option value="">— None —</option>
      {groups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
      <option value="__add__">+ Add new group…</option>
    </select>
  );
}

/** Lists every brand group with how many materials currently use it, and lets
 * an admin delete one. Deleting auto-unassigns those materials (sets their
 * brand_group back to — None —) server-side in the same transaction — see
 * DELETE /admin/brand-groups/{id}. */
function ManageBrandGroupsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: groups = [] }    = useQuery({ queryKey: ['admin', 'brand-groups'], queryFn: adminService.getBrandGroups });
  const { data: mats = [] }      = useQuery({ queryKey: ['admin', 'materials'],    queryFn: adminService.getMaterials });

  const countFor = (groupId: string) => mats.filter(m => m.brand_group === groupId).length;

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminService.deleteBrandGroup(id),
    onSuccess: ({ unassigned_count }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'brand-groups'] });
      qc.invalidateQueries({ queryKey: ['admin', 'materials'] });
      if (unassigned_count > 0) {
        window.alert(`Deleted. ${unassigned_count} material${unassigned_count !== 1 ? 's' : ''} moved to — None —.`);
      }
    },
  });

  function handleDelete(group: AdminBrandGroup) {
    const count = countFor(group.id);
    const warning = count > 0
      ? `Delete "${group.label}"?\n${count} material${count !== 1 ? 's' : ''} currently in this group will be moved to — None — (Unassigned).`
      : `Delete "${group.label}"? No materials are currently assigned to it.`;
    if (window.confirm(warning)) deleteMut.mutate(group.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-sm font-bold text-gray-900">Manage Brand Groups</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {groups.length === 0 ? (
            <p className="px-5 py-6 text-xs text-gray-400 text-center">No brand groups yet.</p>
          ) : (
            groups.map(g => (
              <div key={g.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{g.label}</p>
                  <p className="text-[10px] text-gray-400">
                    {countFor(g.id)} material{countFor(g.id) !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(g)}
                  disabled={deleteMut.isPending}
                  className="shrink-0 text-gray-300 hover:text-red-500 disabled:opacity-40 transition-colors"
                  title={`Delete ${g.label}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MaterialsTab() {
  const qc = useQueryClient();
  const { data: mats = [], isLoading } = useQuery({ queryKey: ['admin', 'materials'], queryFn: adminService.getMaterials });
  const [edits,          setEdits]          = useState<Record<string, Partial<AdminMaterial>>>({});
  const [showAdd,        setShowAdd]        = useState(false);
  const [draft,          setDraft]          = useState<AdminMaterial>({ ...BLANK_MAT });
  const [showManageGroups, setShowManageGroups] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'materials'] });

  const syncMut   = useMutation({ mutationFn: adminService.syncMaterials,   onSuccess: invalidate });
  const createMut = useMutation({
    mutationFn: (body: AdminMaterial) => adminService.createMaterial(body),
    onSuccess: () => { invalidate(); setShowAdd(false); setDraft({ ...BLANK_MAT }); },
  });
  const saveMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AdminMaterial> }) => adminService.updateMaterial(id, body),
    onSuccess: (_data, { id }) => { invalidate(); setEdits(prev => { const n = { ...prev }; delete n[id]; return n; }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => adminService.deleteMaterial(id),
    onSuccess: invalidate,
  });

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 justify-end">
        <button onClick={() => setShowManageGroups(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
          Manage Groups
        </button>
        <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
          {syncMut.isPending ? 'Syncing…' : 'Sync from CSV'}
        </button>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1D4E6B] text-white hover:bg-[#163a52] transition-colors"
        >
          {showAdd ? <><X size={12} /> Cancel</> : <><Plus size={12} /> Add Material</>}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-xs">
          <thead className="bg-[#0D1F2D] text-white">
            <tr>
              {['ID', 'Description', 'Brand Group', 'Bag', 'Bulk', 'Active', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-widest text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">

            {/* ── Add row ── */}
            {showAdd && (
              <tr className="bg-blue-50">
                <td className="px-3 py-2">
                  <input className="border border-gray-200 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-[#1D4E6B]"
                    placeholder="ID" value={draft.material_id}
                    onChange={ev => setDraft(d => ({ ...d, material_id: ev.target.value }))} />
                </td>
                <td className="px-3 py-2">
                  <input className="border border-gray-200 rounded px-2 py-1 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-[#1D4E6B]"
                    placeholder="Description" value={draft.description}
                    onChange={ev => setDraft(d => ({ ...d, description: ev.target.value }))} />
                </td>
                <td className="px-3 py-2">
                  <BrandGroupSelect
                    value={draft.brand_group}
                    onChange={val => setDraft(d => ({ ...d, brand_group: val }))}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={draft.is_bag}
                    onChange={ev => setDraft(d => ({ ...d, is_bag: ev.target.checked }))} />
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={draft.is_bulk}
                    onChange={ev => setDraft(d => ({ ...d, is_bulk: ev.target.checked }))} />
                </td>
                <td className="px-3 py-2 text-center">—</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => createMut.mutate(draft)}
                    disabled={!draft.material_id || !draft.description || createMut.isPending}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#1D4E6B] text-white hover:bg-[#163a52] disabled:opacity-40 transition-colors"
                  >
                    {createMut.isPending ? 'Saving…' : 'Create'}
                  </button>
                </td>
              </tr>
            )}

            {/* ── Existing rows ── */}
            {mats.map(m => {
              const e      = edits[m.material_id] ?? {};
              const dirty  = !!edits[m.material_id];
              const hidden = !m.is_active;
              const set    = (key: keyof AdminMaterial, val: unknown) =>
                setEdits(prev => ({ ...prev, [m.material_id]: { ...prev[m.material_id], [key]: val } }));

              return (
                <tr key={m.material_id} className={cn(
                  'transition-colors',
                  hidden ? 'bg-gray-50 opacity-60'
                  : m.is_new ? 'bg-yellow-50 hover:bg-yellow-100'
                  : !m.in_dataset ? 'bg-gray-50/70 opacity-50 hover:opacity-80'
                  : 'hover:bg-gray-50',
                )}>
                  <td className="px-3 py-2 font-mono text-gray-500">
                    {m.material_id}
                    {hidden && <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 bg-gray-200 text-gray-500 rounded">HIDDEN</span>}
                    {!hidden && m.is_new && (
                      <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 bg-yellow-200 text-yellow-800 rounded" title="Discovered from CSV — not yet reviewed">NEW</span>
                    )}
                    {!hidden && !m.is_new && !m.in_dataset && (
                      <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 bg-gray-100 text-gray-400 rounded" title="This material has no data in the currently active dataset — it is not shown on any dashboard screen">NOT IN DATASET</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input className="border border-gray-200 rounded px-2 py-1 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-[#1D4E6B] disabled:opacity-50"
                      value={(e.description ?? m.description) as string}
                      disabled={hidden}
                      onChange={ev => set('description', ev.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <BrandGroupSelect
                      value={(e.brand_group ?? m.brand_group) ?? null}
                      disabled={hidden}
                      onChange={val => set('brand_group', val)}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" defaultChecked={m.is_bag} disabled={hidden}
                      onChange={ev => set('is_bag', ev.target.checked)} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" defaultChecked={m.is_bulk} disabled={hidden}
                      onChange={ev => set('is_bulk', ev.target.checked)} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn('text-[10px] font-bold', m.is_active ? 'text-green-600' : 'text-gray-400')}>
                      {m.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {dirty && !hidden && (
                        <SaveBtn
                          onClick={() => saveMut.mutate({ id: m.material_id, body: e })}
                          loading={saveMut.isPending}
                        />
                      )}
                      {!hidden && m.is_new && !dirty && (
                        <button
                          onClick={() => saveMut.mutate({ id: m.material_id, body: { is_new: false } })}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
                          title="Dismiss — mark as reviewed"
                        >
                          <Check size={10} /> Dismiss
                        </button>
                      )}
                      {hidden ? (
                        <button
                          onClick={() => saveMut.mutate({ id: m.material_id, body: { is_active: true } })}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          title="Restore material — make visible again"
                        >
                          <RotateCcw size={10} /> Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (window.confirm(`Hide material ${m.material_id} — ${m.description}?\nIt will disappear from the dashboard but stays in the database (recoverable from this page).`))
                              deleteMut.mutate(m.material_id);
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Hide material from dashboard"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showManageGroups && <ManageBrandGroupsModal onClose={() => setShowManageGroups(false)} />}
    </div>
  );
}

// ── Datasets tab ───────────────────────────────────────────────────────────────
// Library of admin-uploaded inventory CSVs, stored in the DB until deleted.
// Exactly one dataset (or the bundled default) is active and drives every
// dashboard screen. Switching invalidates the entire query cache since all
// inventory numbers change.

function DatasetsTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'datasets'], queryFn: adminService.getDatasets });
  const datasets = data?.datasets ?? [];
  const defaultActive = data?.active_dataset_id == null;

  // Every mutation changes what the whole dashboard shows → flush everything.
  const afterSwitch = (msg: string) => {
    setError('');
    setNotice(msg);
    qc.invalidateQueries();
  };
  const fail = (e: Error) => { setNotice(''); setError(e.message); };

  const uploadMut = useMutation({
    mutationFn: (file: File) => adminService.uploadDataset(file),
    onSuccess: () => { afterSwitch('Dataset uploaded and activated — all screens now use it.'); if (fileRef.current) fileRef.current.value = ''; },
    onError: fail,
  });
  const activateMut = useMutation({
    mutationFn: (id: string) => adminService.activateDataset(id),
    onSuccess: () => afterSwitch('Dataset activated.'),
    onError: fail,
  });
  const defaultMut = useMutation({
    mutationFn: adminService.activateDefaultDataset,
    onSuccess: () => afterSwitch('Switched back to the bundled default dataset.'),
    onError: fail,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => adminService.deleteDataset(id),
    onSuccess: () => afterSwitch('Dataset deleted.'),
    onError: fail,
  });

  const busy = uploadMut.isPending || activateMut.isPending || defaultMut.isPending || deleteMut.isPending;

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-xs text-gray-500">
        Upload an inventory CSV to test the dashboard with a different dataset. Uploaded files are
        stored in the database until you delete them. The active dataset drives <strong>every</strong> screen —
        materials and plants are matched by ID, and names always come from the database.
        Required columns: Plant, Material, Material Description, Obj Type, Category, Quantity.
      </p>

      {/* ── Upload ── */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Upload size={13} /> Upload new dataset</p>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#1D4E6B] file:text-white file:text-xs file:font-semibold hover:file:bg-[#163a52] file:cursor-pointer"
          />
          <button
            onClick={() => { const f = fileRef.current?.files?.[0]; if (f) uploadMut.mutate(f); }}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1D4E6B] text-white hover:bg-[#163a52] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {uploadMut.isPending ? 'Uploading…' : 'Upload & activate'}
          </button>
        </div>
      </div>

      {error  && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {notice && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{notice}</p>}

      {/* ── Default (bundled) entry ── */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 rounded-xl border',
        defaultActive ? 'border-[#1B3550] bg-[#0D1F2D]/5 ring-1 ring-[#1B3550]/20' : 'border-gray-200 bg-white',
      )}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Database size={15} className="text-gray-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900">Default (bundled)</p>
            <p className="text-[10px] text-gray-400">Ships with the app — always available</p>
          </div>
        </div>
        {defaultActive ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">ACTIVE</span>
        ) : (
          <button onClick={() => defaultMut.mutate()} disabled={busy}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 transition-colors shrink-0">
            {defaultMut.isPending ? 'Switching…' : 'Switch to this'}
          </button>
        )}
      </div>

      {/* ── Uploaded datasets ── */}
      {datasets.length === 0 ? (
        <p className="text-xs text-gray-400 px-1">No uploaded datasets yet.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
          {datasets.map(d => (
            <div key={d.id} className={cn(
              'flex items-center justify-between px-4 py-3',
              d.is_active ? 'bg-[#0D1F2D]/5' : 'bg-white hover:bg-gray-50',
            )}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 truncate">{d.filename}</p>
                <p className="text-[10px] text-gray-400">
                  {d.row_count.toLocaleString()} rows · uploaded {new Date(d.uploaded_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {d.is_active ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">ACTIVE</span>
                ) : (
                  <button onClick={() => activateMut.mutate(d.id)} disabled={busy}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 transition-colors">
                    {activateMut.isPending ? 'Switching…' : 'Switch to this'}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (window.confirm(`Delete dataset "${d.filename}"?${d.is_active ? '\nIt is currently ACTIVE — the dashboard will fall back to the bundled default.' : ''}`))
                      deleteMut.mutate(d.id);
                  }}
                  disabled={busy}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-40 transition-colors"
                  title="Delete dataset"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SharePoint tab ─────────────────────────────────────────────────────────────

function SharePointTab() {
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useQuery({ queryKey: ['admin', 'sharepoint'], queryFn: adminService.getSharePoint });
  const [form, setForm] = useState<Partial<SharePointConfig>>({});
  const saveMut = useMutation({
    mutationFn: () => adminService.updateSharePoint(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sharepoint'] }),
  });
  const testMut = useMutation({ mutationFn: adminService.testSharePoint });

  const field = (key: keyof SharePointConfig, label: string, placeholder: string, secret = false) => (
    <div key={key}>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">{label}</label>
      <input
        type={secret ? 'password' : 'text'}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1D4E6B]"
        placeholder={placeholder}
        defaultValue={(cfg as any)?.[key] ?? ''}
        onChange={ev => setForm(prev => ({ ...prev, [key]: ev.target.value }))}
      />
    </div>
  );

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;

  return (
    <div className="max-w-md space-y-4">
      <p className="text-xs text-gray-500">Configure Microsoft SharePoint credentials so the scheduler can pull the latest CSV automatically. Requires an Azure AD App Registration with <code>Files.Read.All</code> permission.</p>
      <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
        {field('tenant_id',    'Tenant ID',      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
        {field('client_id',    'Client ID',      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
        {field('client_secret','Client Secret',  '••••••••••••••••', true)}
        {field('site_url',     'Site URL / Site ID', 'company.sharepoint.com:/sites/inventory')}
        {field('drive_id',     'Drive ID',       'b!abc123...')}
        {field('file_path',    'File Path',      'General/inventory.csv')}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="sp-active" defaultChecked={cfg?.is_active ?? false}
            onChange={ev => setForm(prev => ({ ...prev, is_active: ev.target.checked }))} />
          <label htmlFor="sp-active" className="text-xs text-gray-700">Enable automatic SharePoint pull</label>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1D4E6B] text-white hover:bg-[#163a52] transition-colors">
          {saveMut.isPending ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => testMut.mutate()} disabled={testMut.isPending}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
          {testMut.isPending ? 'Testing…' : 'Test Connection'}
        </button>
        {testMut.isSuccess && <span className="text-xs text-green-600 self-center">Connection OK</span>}
        {testMut.isError && <span className="text-xs text-red-500 self-center">Connection failed</span>}
      </div>
    </div>
  );
}

// ── Users tab ──────────────────────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ['admin', 'users'], queryFn: adminService.getUsers });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('viewer');
  const createMut = useMutation({
    mutationFn: () => adminService.createUser({ email, password, role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setEmail(''); setPassword(''); },
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminService.updateUser(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => adminService.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (e: Error) => window.alert(e.message),
  });

  return (
    <div className="space-y-4 max-w-xl">
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-700">Add new user</p>
        <div className="flex gap-2">
          <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1D4E6B]"
            placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1D4E6B]"
            type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <select className="border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1D4E6B]"
            value={role} onChange={e => setRole(e.target.value)}>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={() => createMut.mutate()} disabled={!email || !password || createMut.isPending}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#1D4E6B] text-white hover:bg-[#163a52] disabled:opacity-40 transition-colors">
            Create
          </button>
        </div>
      </div>
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
            <div>
              <span className="text-xs font-semibold text-gray-900">{u.email}</span>
              <span className={cn('ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded',
                u.role === 'admin' ? 'bg-[#E05540]/10 text-[#E05540]' : 'bg-gray-100 text-gray-500')}>
                {u.role}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleMut.mutate({ id: u.id, is_active: !u.is_active })}
                className={cn('text-xs font-semibold transition-colors', u.is_active ? 'text-red-400 hover:text-red-600' : 'text-green-500 hover:text-green-700')}>
                {u.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Permanently delete ${u.email}?\nThis cannot be undone. Any datasets/thresholds/SharePoint settings they saved will stay, just without an owner on record.`)) {
                    deleteMut.mutate(u.id);
                  }
                }}
                disabled={deleteMut.isPending}
                className="text-gray-300 hover:text-red-500 disabled:opacity-40 transition-colors"
                title={`Delete ${u.email}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main AdminPage ─────────────────────────────────────────────────────────────

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('plants');

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage plants, materials, users, and integrations.</p>
      </div>

      {/* Tab bar */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
              tab === t.key ? 'bg-[#1D4E6B] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800',
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'plants'     && <PlantsTab />}
      {tab === 'materials'  && <MaterialsTab />}
      {tab === 'datasets'   && <DatasetsTab />}
      {tab === 'sharepoint' && <SharePointTab />}
      {tab === 'users'      && <UsersTab />}
    </div>
  );
}
