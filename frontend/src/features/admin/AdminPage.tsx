import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService, type AdminPlant, type AdminMaterial, type AdminBrandGroup, type SharePointConfig } from '@/services/admin.service';
import { cn } from '@/utils/cn';
import { Trash2, Plus, X, RotateCcw } from 'lucide-react';

type Tab = 'plants' | 'materials' | 'sharepoint' | 'users';

const TABS: { key: Tab; label: string }[] = [
  { key: 'plants',     label: 'Plants'      },
  { key: 'materials',  label: 'Materials'   },
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
const BLANK_PLANT: AdminPlant = { plant_id: '', name: '', city: null, lat: null, lng: null, plant_type: 'depot', is_active: true };

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
                <tr key={p.plant_id} className={cn('transition-colors', hidden ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50')}>
                  <td className="px-3 py-2 font-mono text-gray-500">
                    {p.plant_id}
                    {hidden && <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 bg-gray-200 text-gray-500 rounded">HIDDEN</span>}
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

const BLANK_MAT: AdminMaterial = { material_id: '', description: '', brand_group: null, is_bag: true, is_bulk: false, is_active: true };

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

function MaterialsTab() {
  const qc = useQueryClient();
  const { data: mats = [], isLoading } = useQuery({ queryKey: ['admin', 'materials'], queryFn: adminService.getMaterials });
  const [edits,   setEdits]   = useState<Record<string, Partial<AdminMaterial>>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [draft,   setDraft]   = useState<AdminMaterial>({ ...BLANK_MAT });

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
                <tr key={m.material_id} className={cn('transition-colors', hidden ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50')}>
                  <td className="px-3 py-2 font-mono text-gray-500">
                    {m.material_id}
                    {hidden && <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 bg-gray-200 text-gray-500 rounded">HIDDEN</span>}
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
            <button onClick={() => toggleMut.mutate({ id: u.id, is_active: !u.is_active })}
              className={cn('text-xs font-semibold transition-colors', u.is_active ? 'text-red-400 hover:text-red-600' : 'text-green-500 hover:text-green-700')}>
              {u.is_active ? 'Deactivate' : 'Activate'}
            </button>
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
      {tab === 'sharepoint' && <SharePointTab />}
      {tab === 'users'      && <UsersTab />}
    </div>
  );
}
