'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Package,
  Building2,
  Tag,
  Users,
  Target,
  CalendarDays,
  KeyRound,
  Eye,
  EyeOff,
  History,
  Database,
  RefreshCw,
  FileText,
  ExternalLink,
  FolderOpen,
  Save,
  Rocket,
  ImageIcon,
  Link as LinkIcon,
} from 'lucide-react';
import { Product, Manufacturer, FaultType } from '@/types';
import { CHANGELOG, CHANGELOG_SEEN_KEY, LATEST_VERSION, type ChangelogVersion } from '@/lib/changelog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';

// Generic CRUD panel used for all three entity types
type Tab = 'products' | 'manufacturers' | 'faultTypes' | 'staff' | 'logins' | 'kpiTargets' | 'roster' | 'health' | 'changelog' | 'evidenceFolders' | 'launches';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [hasNewChangelog, setHasNewChangelog] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(CHANGELOG_SEEN_KEY);
      setHasNewChangelog(seen !== LATEST_VERSION);
    } catch { /* no-op */ }
  }, []);

  function handleChangelogTab() {
    setActiveTab('changelog');
    try { localStorage.setItem(CHANGELOG_SEEN_KEY, LATEST_VERSION ?? ''); } catch { /* no-op */ }
    setHasNewChangelog(false);
  }

  const tabGroups: { label: string; tabs: { key: Tab; label: string; icon: React.ElementType; badge?: boolean; onSelect?: () => void }[] }[] = [
    {
      label: 'Catalogue',
      tabs: [
        { key: 'products',      label: 'Products',      icon: Package   },
        { key: 'manufacturers', label: 'Manufacturers', icon: Building2 },
        { key: 'faultTypes',    label: 'Fault Types',   icon: Tag       },
      ],
    },
    {
      label: 'Team',
      tabs: [
        { key: 'staff',  label: 'Staff',  icon: Users        },
        { key: 'logins', label: 'Logins', icon: KeyRound     },
        { key: 'roster', label: 'Roster', icon: CalendarDays },
      ],
    },
    {
      label: 'Portal',
      tabs: [
        { key: 'kpiTargets',      label: 'KPI Targets',      icon: Target      },
        { key: 'evidenceFolders', label: 'Evidence Folders', icon: FolderOpen  },
        { key: 'launches',        label: 'Launches',         icon: Rocket      },
        { key: 'health',          label: 'Health',           icon: Database    },
        { key: 'changelog',       label: 'Changelog',        icon: History, badge: hasNewChangelog, onSelect: handleChangelogTab },
      ],
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Admin Settings</h1>
        <p className="page-subtitle">Manage portal data, team settings, health checks, and release history</p>
      </div>

      {/* Grouped tab bar */}
      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        {tabGroups.map(group => (
          <div key={group.label} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {group.label}
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {group.tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => { if (t.onSelect) t.onSelect(); else setActiveTab(t.key); }}
                  className={`relative flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-all ${
                    activeTab === t.key
                      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <t.icon size={15} />
                  {t.label}
                  {t.badge && (
                    <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeTab === 'products'      && <ProductsPanel />}
      {activeTab === 'manufacturers' && <ManufacturersPanel />}
      {activeTab === 'faultTypes'    && <FaultTypesPanel />}
      {activeTab === 'staff'         && <StaffPanel />}
      {activeTab === 'logins'        && <LoginsPanel />}
      {activeTab === 'kpiTargets'      && <KpiTargetsPanel />}
      {activeTab === 'evidenceFolders' && <EvidenceFoldersPanel />}
      {activeTab === 'launches'        && <ProductLaunchesPanel />}
      {activeTab === 'roster'          && <RosterSettingsPanel />}
      {activeTab === 'health'          && <IntegrationHealthPanel />}
      {activeTab === 'changelog'       && <ChangelogPanel />}
    </div>
  );
}

// ─── Products Panel ────────────────────────────────────────────────────────────

function ProductsPanel() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', manufacturerName: '', unitCostUSD: '', manufacturerNumbers: '', claimable: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [customMfr, setCustomMfr] = useState(false);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const [prodRes, mfrRes] = await Promise.all([
      fetch(`/api/products?_t=${Date.now()}`),
      fetch('/api/manufacturers'),
    ]);
    const prodJson = await prodRes.json();
    const mfrJson  = await mfrRes.json();
    setProducts(prodJson.data || []);
    setManufacturers((mfrJson.data || []).map((m: { name: string }) => m.name).sort());
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: '', manufacturerName: '', unitCostUSD: '', manufacturerNumbers: '', claimable: true });
    setCustomMfr(false);
    setError('');
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      manufacturerName: p.manufacturerName,
      unitCostUSD: String(p.unitCostUSD),
      manufacturerNumbers: p.manufacturerNumbers.join(', '),
      claimable: p.claimable !== false,
    });
    setCustomMfr(false);
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.manufacturerName) { setError('Name and manufacturer are required'); return; }
    setSaving(true); setError('');
    try {
      const body = {
        ...(editing ? { id: editing.id } : {}),
        name: form.name,
        manufacturerName: form.manufacturerName,
        unitCostUSD: parseFloat(form.unitCostUSD) || 0,
        claimable: form.claimable,
        manufacturerNumbers: form.manufacturerNumbers
          .split(',').map(s => s.trim()).filter(Boolean),
      };
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Product could not be saved to Google Sheets');
      setShowModal(false);
      setSuccess(editing ? 'Product updated.' : `Product created in Google Sheets${json.meta?.sheetRow ? ` row ${json.meta.sheetRow}` : ''}.`);
      setTimeout(() => setSuccess(''), 3000);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: 'Delete product?',
      message: `Delete "${name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <CrudPanel
      title="Products"
      description="Products auto-fill manufacturer name and unit cost when selected in the fault form."
      loading={loading}
      success={success}
      onNew={openNew}
      newLabel="Add Product"
    >
      {confirmDialog}
      <table className="data-table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Manufacturer</th>
            <th>Unit Cost</th>
            <th>Manufacturer Numbers</th>
            <th>Claim Status</th>
            <th className="w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-10 text-slate-400">No products yet. Add one above.</td></tr>
          ) : (
            products.map(p => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td className="text-slate-500">{p.manufacturerName}</td>
                <td className="font-semibold">${p.unitCostUSD.toFixed(2)}</td>
                <td className="text-slate-400 text-xs">{p.manufacturerNumbers.join(', ') || '—'}</td>
                <td className="text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.claimable !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.claimable !== false ? 'Claimable' : 'Track only'}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="text-brand-600 hover:text-brand-800 p-1">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(p.id, p.name)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showModal && (
        <Modal
          title={editing ? 'Edit Product' : 'Add Product'}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          saving={saving}
          error={error}
        >
          <div className="space-y-3">
            <div>
              <label className="form-label">Product Name *</label>
              <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="form-input" placeholder="e.g. Widget Pro 3000" />
            </div>
            <div>
              <label className="form-label">Manufacturer Name *</label>
              {!customMfr ? (
                <div className="flex gap-2">
                  <select
                    value={form.manufacturerName}
                    onChange={e => {
                      if (e.target.value === '__new__') { setCustomMfr(true); setForm(f => ({ ...f, manufacturerName: '' })); }
                      else setForm(f => ({ ...f, manufacturerName: e.target.value }));
                    }}
                    className="form-input flex-1"
                  >
                    <option value="">Select manufacturer…</option>
                    {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                    <option value="__new__">＋ Add new manufacturer…</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={form.manufacturerName}
                    onChange={e => setForm(f => ({ ...f, manufacturerName: e.target.value }))}
                    className="form-input flex-1"
                    placeholder="e.g. Acme Corp"
                  />
                  <button type="button" onClick={() => { setCustomMfr(false); setForm(f => ({ ...f, manufacturerName: '' })); }}
                    className="text-xs text-slate-500 hover:text-slate-700 whitespace-nowrap px-2">
                    ← Back
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="form-label">Unit Cost (USD)</label>
              <input type="number" step="0.01" value={form.unitCostUSD} onChange={e => setForm(f=>({...f,unitCostUSD:e.target.value}))} className="form-input" placeholder="0.00" min={0} />
            </div>
            <div>
              <label className="form-label">Manufacturer Numbers</label>
              <input value={form.manufacturerNumbers} onChange={e => setForm(f=>({...f,manufacturerNumbers:e.target.value}))} className="form-input" placeholder="MN-001, MN-002, MN-003 (comma separated)" />
            </div>
            <div>
              <label className="form-label">Claim Status</label>
              <label className={`flex items-center gap-3 cursor-pointer select-none rounded-xl border px-4 py-3 transition-colors ${form.claimable ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <input type="checkbox" checked={form.claimable} onChange={e => setForm(f=>({...f,claimable:e.target.checked}))}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800">Claimable product</p>
                  <p className="text-xs text-slate-500 mt-0.5">Uncheck for products we track but cannot claim against the manufacturer (e.g. discontinued / 1st gen)</p>
                </div>
              </label>
              <p className="text-xs text-slate-400 mt-1">These appear as a dropdown when this product is selected.</p>
            </div>
          </div>
        </Modal>
      )}
    </CrudPanel>
  );
}

// ─── Manufacturers Panel ───────────────────────────────────────────────────────

function ManufacturersPanel() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [mfrs, setMfrs] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Manufacturer | null>(null);
  const [form, setForm] = useState({ name: '', contactEmail: '', phone: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const res = await fetch('/api/manufacturers');
    const json = await res.json();
    setMfrs(json.data || []);
    setLoading(false);
  }

  function openNew() {
    setEditing(null); setForm({ name: '', contactEmail: '', phone: '', notes: '' }); setError(''); setShowModal(true);
  }

  function openEdit(m: Manufacturer) {
    setEditing(m); setForm({ name: m.name, contactEmail: m.contactEmail, phone: m.phone, notes: m.notes }); setError(''); setShowModal(true);
  }

  async function handleSave() {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const body = editing ? { id: editing.id, ...form } : form;
      const res = await fetch('/api/manufacturers', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setShowModal(false);
      setSuccess(editing ? 'Updated.' : 'Created.');
      setTimeout(() => setSuccess(''), 3000);
      await load();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: 'Delete manufacturer?',
      message: `Delete "${name}"?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await fetch(`/api/manufacturers?id=${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <CrudPanel title="Manufacturers" description="Manufacturer contact details for claim communications." loading={loading} success={success} onNew={openNew} newLabel="Add Manufacturer">
      {confirmDialog}
      <table className="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Notes</th><th className="w-24">Actions</th></tr></thead>
        <tbody>
          {mfrs.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-10 text-slate-400">No manufacturers yet.</td></tr>
          ) : (
            mfrs.map(m => (
              <tr key={m.id}>
                <td className="font-medium">{m.name}</td>
                <td className="text-slate-500 text-xs">{m.contactEmail || '—'}</td>
                <td className="text-slate-500 text-xs">{m.phone || '—'}</td>
                <td className="text-slate-400 text-xs">{m.notes || '—'}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(m)} className="text-brand-600 hover:text-brand-800 p-1"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(m.id, m.name)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showModal && (
        <Modal title={editing ? 'Edit Manufacturer' : 'Add Manufacturer'} onClose={() => setShowModal(false)} onSave={handleSave} saving={saving} error={error}>
          <div className="space-y-3">
            <div><label className="form-label">Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="form-input" /></div>
            <div><label className="form-label">Contact Email</label><input type="email" value={form.contactEmail} onChange={e=>setForm(f=>({...f,contactEmail:e.target.value}))} className="form-input" /></div>
            <div><label className="form-label">Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="form-input" /></div>
            <div><label className="form-label">Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3} className="form-input resize-none" /></div>
          </div>
        </Modal>
      )}
    </CrudPanel>
  );
}

// ─── Fault Types Panel ─────────────────────────────────────────────────────────

function FaultTypesPanel() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [fts, setFts] = useState<FaultType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FaultType | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/fault-types');
    const json = await res.json();
    setFts(json.data || []);
    setLoading(false);
  }

  function openNew() { setEditing(null); setForm({ name: '', description: '' }); setError(''); setShowModal(true); }
  function openEdit(ft: FaultType) { setEditing(ft); setForm({ name: ft.name, description: ft.description }); setError(''); setShowModal(true); }

  async function handleSave() {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const body = editing ? { id: editing.id, ...form } : form;
      const res = await fetch('/api/fault-types', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setShowModal(false);
      setSuccess(editing ? 'Updated.' : 'Created.');
      setTimeout(() => setSuccess(''), 3000);
      await load();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: 'Delete fault type?',
      message: `Delete "${name}"?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await fetch(`/api/fault-types?id=${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <CrudPanel title="Fault Types" description="These appear as options in the fault submission form." loading={loading} success={success} onNew={openNew} newLabel="Add Fault Type">
      {confirmDialog}
      <table className="data-table">
        <thead><tr><th>Fault Type</th><th>Description</th><th className="w-24">Actions</th></tr></thead>
        <tbody>
          {fts.length === 0 ? (
            <tr><td colSpan={3} className="text-center py-10 text-slate-400">No fault types yet.</td></tr>
          ) : (
            fts.map(ft => (
              <tr key={ft.id}>
                <td className="font-medium">{ft.name}</td>
                <td className="text-slate-500 text-xs">{ft.description || '—'}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(ft)} className="text-brand-600 hover:text-brand-800 p-1"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(ft.id, ft.name)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showModal && (
        <Modal title={editing ? 'Edit Fault Type' : 'Add Fault Type'} onClose={() => setShowModal(false)} onSave={handleSave} saving={saving} error={error}>
          <div className="space-y-3">
            <div><label className="form-label">Fault Type Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="form-input" placeholder="e.g. Screen Defect" /></div>
            <div><label className="form-label">Description</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} className="form-input resize-none" placeholder="Optional description" /></div>
          </div>
        </Modal>
      )}
    </CrudPanel>
  );
}

// ─── Staff Panel ───────────────────────────────────────────────────────────────

function StaffPanel() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  type StaffMember = { id: string; name: string };
  type StaffProfile = {
    id?: string;
    staffId: string;
    staffName: string;
    shippingAddress: string;
    phone: string;
    personalEmail: string;
    contractLink: string;
    startDate: string;
    notes: string;
    updatedAt?: string;
  };
  const blankProfile: StaffProfile = {
    staffId: '',
    staffName: '',
    shippingAddress: '',
    phone: '',
    personalEmail: '',
    contractLink: '',
    startDate: '',
    notes: '',
  };
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, StaffProfile>>({});
  const [editingProfile, setEditingProfile] = useState<StaffMember | null>(null);
  const [profileForm, setProfileForm] = useState<StaffProfile>(blankProfile);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [error, setError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const [staffRes, profileRes] = await Promise.all([
      fetch('/api/staff'),
      fetch('/api/staff/profiles'),
    ]);
    const staffJson = await staffRes.json();
    const profileJson = await profileRes.json();
    setStaff(staffJson.data || []);
    const profileMap: Record<string, StaffProfile> = {};
    for (const profile of (profileJson.data || []) as StaffProfile[]) {
      profileMap[profile.staffId] = profile;
    }
    setProfiles(profileMap);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newName.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setNewName('');
      setSuccess('Staff member added.');
      setTimeout(() => setSuccess(''), 3000);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: 'Remove staff member?',
      message: `Remove "${name}" from the team list?`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
    await load();
  }

  function openProfile(member: StaffMember) {
    setEditingProfile(member);
    setProfileError('');
    setProfileForm({
      ...blankProfile,
      ...(profiles[member.id] || {}),
      staffId: member.id,
      staffName: member.name,
    });
  }

  async function saveProfile() {
    if (!editingProfile) return;
    setProfileSaving(true);
    setProfileError('');
    try {
      const res = await fetch('/api/staff/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setProfiles(prev => ({ ...prev, [editingProfile.id]: json.data }));
      setEditingProfile(null);
      setSuccess('Staff profile saved.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to save staff profile');
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Staff Members</h2>
          <p className="text-xs text-slate-500">Names, private profile details, and staff documents for admin reference</p>
        </div>
        {success && (
          <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
            <CheckCircle size={13} /> {success}
          </span>
        )}
      </div>

      {/* Add new */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Team Member</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => { setNewName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. Sarah Johnson"
            className="form-input flex-1"
          />
          <button onClick={handleAdd} disabled={saving} className="btn-primary px-4">
            <Plus size={15} /> Add
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={13} className="text-red-500" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : staff.length === 0 ? (
          <div className="py-12 text-center">
            <Users size={28} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No staff members added yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Private Details</th>
                <th>Contract</th>
                <th className="w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(member => {
                const profile = profiles[member.id];
                const hasProfile = !!profile && Boolean(
                  profile.shippingAddress ||
                  profile.phone ||
                  profile.personalEmail ||
                  profile.contractLink ||
                  profile.startDate ||
                  profile.notes
                );
                return (
                  <tr key={member.id}>
                    <td className="font-medium text-slate-800">{member.name}</td>
                    <td>
                      {hasProfile ? (
                        <div className="text-xs text-slate-500">
                          {profile.phone && <p>{profile.phone}</p>}
                          {profile.personalEmail && <p>{profile.personalEmail}</p>}
                          {profile.shippingAddress && <p className="truncate max-w-xs">{profile.shippingAddress}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No profile saved</span>
                      )}
                    </td>
                    <td>
                      {profile?.contractLink ? (
                        <a href={profile.contractLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                          <FileText size={12} /> Open <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openProfile(member)}
                          className="text-brand-600 hover:text-brand-800 p-1"
                          title="Edit private profile"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(member.id, member.name)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          title="Remove staff member"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editingProfile && (
        <Modal
          title={`Private Profile — ${editingProfile.name}`}
          onClose={() => setEditingProfile(null)}
          onSave={saveProfile}
          saving={profileSaving}
          error={profileError}
        >
          <div className="space-y-4">
            <div>
              <label className="form-label">Shipping Address</label>
              <textarea
                value={profileForm.shippingAddress}
                onChange={e => setProfileForm(f => ({ ...f, shippingAddress: e.target.value }))}
                rows={3}
                className="form-input resize-none"
                placeholder="Street, suburb, state, postcode"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Phone</label>
                <input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} className="form-input" placeholder="Phone number" />
              </div>
              <div>
                <label className="form-label">Start Date</label>
                <input type="date" value={profileForm.startDate} onChange={e => setProfileForm(f => ({ ...f, startDate: e.target.value }))} className="form-input" />
              </div>
            </div>
            <div>
              <label className="form-label">Personal Email</label>
              <input type="email" value={profileForm.personalEmail} onChange={e => setProfileForm(f => ({ ...f, personalEmail: e.target.value }))} className="form-input" placeholder="name@example.com" />
            </div>
            <div>
              <label className="form-label">Contract / Document Link</label>
              <input type="url" value={profileForm.contractLink} onChange={e => setProfileForm(f => ({ ...f, contractLink: e.target.value }))} className="form-input" placeholder="Google Drive, Dropbox, or signed contract URL" />
            </div>
            <div>
              <label className="form-label">Admin Notes</label>
              <textarea
                value={profileForm.notes}
                onChange={e => setProfileForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="form-input resize-none"
                placeholder="Anything private admins need to know..."
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Logins Panel ─────────────────────────────────────────────────────────────

interface AgentWithAuth {
  id: string;
  name: string;
  email: string | null;
  role: 'admin' | 'staff';
  hasPassword: boolean;
  lastLogin: string | null;
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function LoginsPanel() {
  const [agents, setAgents] = useState<AgentWithAuth[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AgentWithAuth | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', role: 'staff' as 'admin' | 'staff' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/staff/auth');
    const json = await res.json();
    setAgents(json.data || []);
    setLoading(false);
  }

  function openEdit(agent: AgentWithAuth) {
    setEditing(agent);
    setForm({ email: agent.email || '', password: '', confirmPassword: '', role: agent.role });
    setError('');
    setShowPw(false);
    setShowModal(true);
  }

  async function handleSave() {
    if (!editing) return;
    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password && form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSaving(true); setError('');
    try {
      // Update email and role
      const emailRes = await fetch('/api/auth/set-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: editing.id, email: form.email }),
      });
      const emailJson = await emailRes.json();
      if (emailJson.error) throw new Error(emailJson.error);

      // Update role
      await fetch('/api/staff/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: editing.id, role: form.role }),
      });

      // Update password if provided
      if (form.password) {
        const pwRes = await fetch('/api/auth/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: editing.id, password: form.password }),
        });
        const pwJson = await pwRes.json();
        if (pwJson.error) throw new Error(pwJson.error);
      }

      setShowModal(false);
      setSuccess(`${editing.name} updated.`);
      setTimeout(() => setSuccess(''), 3000);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Staff Logins</h2>
          <p className="text-xs text-slate-500">Set email, password and role for each team member's portal access</p>
        </div>
        {success && (
          <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
            <CheckCircle size={13} /> {success}
          </span>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : agents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No staff members found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Password</th>
                <th>Last Login</th>
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id}>
                  <td className="font-medium">{agent.name}</td>
                  <td className="text-slate-500 text-xs">{agent.email || <span className="text-amber-500 italic">Not set</span>}</td>
                  <td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      agent.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {agent.role}
                    </span>
                  </td>
                  <td>
                    {agent.hasPassword ? (
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle size={12} /> Set
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
                        <AlertCircle size={12} /> Not set
                      </span>
                    )}
                  </td>
                  <td className="text-xs text-slate-500">
                    {formatLastLogin(agent.lastLogin)}
                  </td>
                  <td>
                    <button onClick={() => openEdit(agent)} className="text-brand-600 hover:text-brand-800 p-1">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <strong>Note:</strong> Staff members need an email and password to log in. Admins have access to all pages; staff see a limited view.
        Login automatically clocks staff in, and logout clocks them out.
      </div>

      <LoginHistoryFeed agents={agents.map(a => ({ id: a.id, name: a.name }))} />

      {showModal && editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-900">Edit Login — {editing.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Leave password blank to keep current</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="form-input"
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="form-label">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'staff' }))}
                  className="form-input"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="form-label">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="form-input pr-10"
                    placeholder={editing.hasPassword ? 'Leave blank to keep current' : 'Set a password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {form.password && (
                <div>
                  <label className="form-label">Confirm password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className="form-input"
                    placeholder="Repeat new password"
                  />
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={14} className="text-red-500" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Login History Feed ────────────────────────────────────────────────────────

interface LoginEvent {
  id: string;
  agentId: string;
  name: string;
  role: string;
  loggedIn: string;
  date: string;
}

function fmtLoginTime(iso: string): { time: string; relative: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });

  let relative = '';
  if (diffMins < 2) relative = 'just now';
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHours < 24) relative = `${diffHours}h ago`;
  else if (diffDays === 1) relative = 'yesterday';
  else if (diffDays < 7) relative = `${diffDays}d ago`;
  else relative = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

  return { time, relative };
}

function acstDate(d: Date): string {
  // Returns YYYY-MM-DD in Australia/Adelaide timezone (ACST/ACDT)
  return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Adelaide' });
}

function groupByDay(events: LoginEvent[]): { label: string; items: LoginEvent[] }[] {
  const groups: Record<string, LoginEvent[]> = {};
  const today     = acstDate(new Date());
  const yesterday = acstDate(new Date(Date.now() - 86400000));

  for (const e of events) {
    const day = e.date || acstDate(new Date(e.loggedIn));
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, items]) => ({
      label: day === today ? 'Today' : day === yesterday ? 'Yesterday' : new Date(day + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }),
      items,
    }));
}

function LoginHistoryFeed({ agents }: { agents: { id: string; name: string }[] }) {
  const [events, setEvents]           = useState<LoginEvent[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterAgent, setFilterAgent] = useState('');
  const [days, setDays]               = useState(7);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (filterAgent) params.set('agentId', filterAgent);
    fetch(`/api/admin/login-history?${params}`)
      .then(r => r.json())
      .then(d => setEvents(d.data || []))
      .catch(err => console.error('[LoginHistoryFeed]', err))
      .finally(() => setLoading(false));
  }, [days, filterAgent]);

  const groups = groupByDay(events);

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Login History</h3>
          <p className="text-xs text-slate-400 mt-0.5">Every portal login by staff over the selected period</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <option value="">All staff</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
                  <div className="h-2.5 bg-slate-50 rounded animate-pulse w-1/5" />
                </div>
                <div className="h-3 bg-slate-100 rounded animate-pulse w-16" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-400">No logins recorded in this period</p>
          </div>
        ) : (
          <div>
            {groups.map(({ label, items }) => (
              <div key={label}>
                {/* Day header */}
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{items.length} login{items.length !== 1 ? 's' : ''}</span>
                </div>
                {/* Events */}
                <div className="divide-y divide-slate-50">
                  {items.map(e => {
                    const { time, relative } = fmtLoginTime(e.loggedIn);
                    const initials = e.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold ${
                          e.role === 'admin' ? 'bg-indigo-500' : 'bg-brand-500'
                        }`}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{e.name}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            e.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {e.role}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-medium text-slate-700">{time}</p>
                          <p className="text-[10px] text-slate-400">{relative}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared Components ─────────────────────────────────────────────────────────

function CrudPanel({
  title, description, loading, success, onNew, newLabel, children,
}: {
  title: string; description: string; loading: boolean; success: string;
  onNew: () => void; newLabel: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          {success && (
            <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
              <CheckCircle size={13} /> {success}
            </span>
          )}
          <button onClick={onNew} className="btn-primary text-sm">
            <Plus size={15} /> {newLabel}
          </button>
        </div>
      </div>
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : children}
      </div>
    </div>
  );
}

function Modal({
  title, onClose, onSave, saving, error, children,
}: {
  title: string; onClose: () => void; onSave: () => void;
  saving: boolean; error: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
        </div>
        <div className="p-6">
          {children}
          {error && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={14} className="text-red-500" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={onSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Targets Panel ─────────────────────────────────────────────────────────

interface KPIConfig {
  repliesPerDay: number;
  resolveRate: number;
  csat: number;
}

function KpiTargetsPanel() {
  const [config, setConfig] = useState<KPIConfig>({ repliesPerDay: 60, resolveRate: 30, csat: 3.0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/config');
      const json = await res.json();
      setConfig(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function validateField(key: string, value: string): boolean {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setFieldErrors(e => ({ ...e, [key]: 'Must be a positive number' }));
      return false;
    }
    setFieldErrors(e => ({ ...e, [key]: '' }));
    return true;
  }

  async function handleSave() {
    setError('');
    setFieldErrors({});

    // Validate all fields
    const isValid =
      validateField('repliesPerDay', String(config.repliesPerDay)) &&
      validateField('resolveRate', String(config.resolveRate)) &&
      validateField('csat', String(config.csat));

    if (!isValid) return;

    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setSuccess('KPI targets updated');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card p-12 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">KPI Targets</h2>
          <p className="text-xs text-slate-500">Configure performance targets for team metrics</p>
        </div>
        {success && (
          <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
            <CheckCircle size={13} /> {success}
          </span>
        )}
      </div>

      <div className="card p-6">
        <div className="space-y-5">
          {/* Daily Replies Target */}
          <div>
            <label className="form-label">Daily Replies Target</label>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={config.repliesPerDay}
                  onChange={e => setConfig(c => ({ ...c, repliesPerDay: parseFloat(e.target.value) || 0 }))}
                  className={`form-input ${fieldErrors.repliesPerDay ? 'border-red-300' : ''}`}
                />
                <p className="text-xs text-slate-400 mt-1.5">Minimum messages sent per agent per day</p>
                {fieldErrors.repliesPerDay && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.repliesPerDay}</p>
                )}
              </div>
              <span className="text-sm text-slate-500 font-medium">replies/day</span>
            </div>
          </div>

          {/* One-Touch Resolution Rate */}
          <div>
            <label className="form-label">One-Touch Resolution Rate</label>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={config.resolveRate}
                  onChange={e => setConfig(c => ({ ...c, resolveRate: parseFloat(e.target.value) || 0 }))}
                  className={`form-input ${fieldErrors.resolveRate ? 'border-red-300' : ''}`}
                />
                <p className="text-xs text-slate-400 mt-1.5">Percentage of tickets resolved in one reply</p>
                {fieldErrors.resolveRate && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.resolveRate}</p>
                )}
              </div>
              <span className="text-sm text-slate-500 font-medium">%</span>
            </div>
          </div>

          {/* Minimum CSAT Score */}
          <div>
            <label className="form-label">Minimum CSAT Score</label>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={config.csat}
                  onChange={e => setConfig(c => ({ ...c, csat: parseFloat(e.target.value) || 0 }))}
                  className={`form-input ${fieldErrors.csat ? 'border-red-300' : ''}`}
                />
                <p className="text-xs text-slate-400 mt-1.5">Average customer satisfaction rating target</p>
                {fieldErrors.csat && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.csat}</p>
                )}
              </div>
              <span className="text-sm text-slate-500 font-medium">/ 5.0</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={14} className="text-red-500" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Roster Settings Panel ─────────────────────────────────────────────────────

function RosterSettingsPanel() {
  const [resetDate, setResetDate] = useState('');
  const [rotStart,  setRotStart]  = useState('');
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saveOk,    setSaveOk]    = useState('');
  const [saveErr,   setSaveErr]   = useState('');

  // Per-agent leave reset dates
  const [agents,          setAgents]          = useState<{ id: string; name: string; colour: string; leaveResetDate: string | null }[]>([]);
  const [agentDates,      setAgentDates]      = useState<Record<string, string>>({});
  const [agentSaving,     setAgentSaving]     = useState<string | null>(null);
  const [agentSaveOk,     setAgentSaveOk]     = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/roster/config').then(r => r.json()),
      fetch('/api/roster/agents').then(r => r.json()),
    ]).then(([configJson, agentJson]) => {
      setRotStart(configJson.data?.rotationStartDate ?? '');
      setResetDate(configJson.data?.annualLeaveResetDate ?? '');
      const agentData = agentJson.data ?? [];
      setAgents(agentData);
      const map: Record<string, string> = {};
      agentData.forEach((a: { id: string; leaveResetDate: string | null }) => {
        map[a.id] = a.leaveResetDate ?? '';
      });
      setAgentDates(map);
    }).finally(() => setLoading(false));
  }, []);

  async function handleAgentDateSave(agentId: string) {
    setAgentSaving(agentId);
    try {
      const res = await fetch(`/api/roster/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveResetDate: agentDates[agentId] || null }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setAgentSaveOk(agentId);
      setTimeout(() => setAgentSaveOk(null), 2500);
    } catch {
      // silent — could add error state if needed
    } finally {
      setAgentSaving(null);
    }
  }

  function windowLabel(dateStr: string): string {
    if (!dateStr) return '';
    const [, mm, dd] = dateStr.split('-');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisYear = today.getFullYear();
    const thisYearReset = new Date(`${thisYear}-${mm}-${dd}T00:00:00`);
    const startYear = today >= thisYearReset ? thisYear : thisYear - 1;
    const start = new Date(`${startYear}-${mm}-${dd}T00:00:00`);
    const end   = new Date(`${startYear + 1}-${mm}-${dd}T00:00:00`);
    end.setDate(end.getDate() - 1);
    const fmt = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(start)} → ${fmt(end)}`;
  }

  async function handleSave() {
    setSaving(true); setSaveErr(''); setSaveOk('');
    try {
      const res = await fetch('/api/roster/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rotationStartDate:    rotStart,
          annualLeaveResetDate: resetDate || null,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSaveOk('Roster settings saved.');
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-0.5">Rotation Start Date</h3>
        <p className="text-xs text-slate-500 mb-3">The Monday from which the weekly shift rotation is calculated.</p>
        <input
          type="date"
          value={rotStart}
          onChange={e => setRotStart(e.target.value)}
          className="form-input"
        />
      </div>

      <div className="border-t border-slate-100 pt-6">
        <h3 className="text-sm font-bold text-slate-800 mb-0.5">Annual Leave Reset Date</h3>
        <p className="text-xs text-slate-500 mb-3">
          Sets the start of each 12-month leave window. Each agent receives 5 days per window —
          non-accrued, full grant on reset. Agents must give 2 weeks&apos; notice to book annual leave.
        </p>
        <input
          type="date"
          value={resetDate}
          onChange={e => { setResetDate(e.target.value); setSaveOk(''); }}
          className="form-input"
        />
        {resetDate && (
          <p className="text-xs text-slate-500 mt-2">
            Current window: <span className="font-semibold text-slate-700">{windowLabel(resetDate)}</span>
          </p>
        )}
      </div>

      {saveErr && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700">{saveErr}</p>
        </div>
      )}
      {saveOk && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700">{saveOk}</p>
        </div>
      )}

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Per-agent leave reset date overrides */}
      {agents.length > 0 && (
        <div className="border-t border-slate-100 pt-6 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-0.5">Agent Leave Reset Dates</h3>
            <p className="text-xs text-slate-500">
              Override the global reset date for individual agents. Leave blank to use the global date above.
              Both annual and sick leave use this date.
            </p>
          </div>
          <div className="space-y-2">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: agent.colour }} />
                <span className="text-sm font-semibold text-slate-700 w-24 flex-shrink-0">{agent.name}</span>
                <input
                  type="date"
                  value={agentDates[agent.id] ?? ''}
                  onChange={e => setAgentDates(prev => ({ ...prev, [agent.id]: e.target.value }))}
                  className="form-input flex-1 text-sm"
                  placeholder="Use global default"
                />
                <button
                  onClick={() => handleAgentDateSave(agent.id)}
                  disabled={agentSaving === agent.id}
                  className="btn-primary text-xs px-3 py-1.5 flex-shrink-0"
                >
                  {agentSaving === agent.id ? '…' : agentSaveOk === agent.id ? '✓ Saved' : 'Save'}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">
            Tip: after updating, the Leave Log page will reflect each agent&apos;s new window immediately.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Integration Health Panel ──────────────────────────────────────────────────

type IntegrationStatus = 'connected' | 'partial' | 'broken' | 'not_configured';

type IntegrationCheck = {
  name: string;
  status: IntegrationStatus;
  detail: string;
  latencyMs?: number;
  checkedAt: string;
};

type IntegrationGroup = {
  name: string;
  status: IntegrationStatus;
  summary: string;
  checks: IntegrationCheck[];
};

type IntegrationHealth = {
  checkedAt: string;
  status: IntegrationStatus;
  summary: string;
  groups: IntegrationGroup[];
};

const HEALTH_STYLES: Record<IntegrationStatus, { label: string; card: string; pill: string; dot: string; icon: string }> = {
  connected: {
    label: 'Connected',
    card: 'border-emerald-200 bg-emerald-50/60',
    pill: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    icon: 'text-emerald-600',
  },
  partial: {
    label: 'Partial',
    card: 'border-amber-200 bg-amber-50/60',
    pill: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
    icon: 'text-amber-600',
  },
  broken: {
    label: 'Broken',
    card: 'border-red-200 bg-red-50/60',
    pill: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
    icon: 'text-red-600',
  },
  not_configured: {
    label: 'Not configured',
    card: 'border-slate-200 bg-slate-50',
    pill: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    icon: 'text-slate-500',
  },
};

type DataQualityIssue = {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: 'red' | 'amber' | 'blue';
  detail: string;
};

function DataQualitySection() {
  const [issues, setIssues] = useState<DataQualityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/data-quality', { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setIssues(json.data ?? []);
      })
      .catch(err => setError(err.message || 'Could not check data quality'))
      .finally(() => setLoading(false));
  }, []);

  const activeIssues = issues.filter(i => i.count > 0);
  const total = activeIssues.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        {total > 0
          ? <AlertTriangle size={15} className="text-amber-500" />
          : <CheckCircle2 size={15} className="text-emerald-500" />}
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Data Quality</h3>
          <p className="text-xs text-slate-500">
            {loading ? 'Checking…' : error ? error : total > 0 ? `${total} item${total !== 1 ? 's' : ''} worth cleaning up` : 'No obvious cleanup items found'}
          </p>
        </div>
      </div>
      {!loading && !error && activeIssues.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {activeIssues.map(issue => (
            <Link
              key={issue.id}
              href={issue.href}
              title={issue.detail}
              className={`rounded-xl border px-3 py-2 transition-colors hover:bg-white ${
                issue.tone === 'red'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-amber-200 bg-white/70 text-amber-800'
              }`}
            >
              <p className="text-xl font-bold font-mono leading-tight">{issue.count}</p>
              <p className="text-xs font-semibold leading-tight">{issue.label}</p>
            </Link>
          ))}
        </div>
      )}
      {!loading && !error && activeIssues.length === 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm text-emerald-800">
          Clean enough to trust at a glance.
        </div>
      )}
    </div>
  );
}

function IntegrationHealthPanel() {
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/integration-health', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Health check failed');
      setHealth(json);
    } catch (err: any) {
      setError(err.message || 'Health check failed');
    } finally {
      setLoading(false);
    }
  }

  const overall = health ? HEALTH_STYLES[health.status] : HEALTH_STYLES.not_configured;

  return (
    <div className="max-w-4xl space-y-5">
      <DataQualitySection />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Integration Health</h2>
          <p className="text-sm text-slate-500 mt-0.5">Check whether the portal can reach Google Sheets, Supabase, and Commslayer.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Run Health Check
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className={`rounded-xl border px-5 py-4 ${overall.card}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall Status</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${overall.dot}`} />
              <span className="text-xl font-bold text-slate-900">{overall.label}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{health?.summary ?? 'Run a health check to test integrations.'}</p>
          </div>
          {health?.checkedAt && (
            <div className="text-right text-xs text-slate-500">
              <p className="font-semibold text-slate-600">Last checked</p>
              <p>{new Date(health.checkedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
          )}
        </div>
      </div>

      {loading && !health ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5">
              <div className="h-4 w-28 rounded bg-slate-100 animate-pulse" />
              <div className="mt-4 space-y-2">
                <div className="h-3 rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-slate-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {health?.groups.map(group => {
            const style = HEALTH_STYLES[group.status];
            return (
              <div key={group.name} className={`rounded-xl border bg-white p-4 ${style.card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{group.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{group.summary}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${style.pill}`}>
                    {style.label}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {group.checks.map(check => {
                    const checkStyle = HEALTH_STYLES[check.status];
                    return (
                      <div key={check.name} className="rounded-lg border border-white/70 bg-white/75 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {check.status === 'connected'
                              ? <CheckCircle size={14} className={checkStyle.icon} />
                              : <AlertCircle size={14} className={checkStyle.icon} />}
                            <span className="truncate text-sm font-medium text-slate-800">{check.name}</span>
                          </div>
                          {typeof check.latencyMs === 'number' && (
                            <span className="text-[10px] font-medium text-slate-400">{check.latencyMs}ms</span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{check.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Changelog Panel ───────────────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<string, string> = {
  Cases:          'bg-blue-100 text-blue-700',
  Returns:        'bg-indigo-100 text-indigo-700',
  Refunds:        'bg-purple-100 text-purple-700',
  Orders:         'bg-violet-100 text-violet-700',
  Inventory:      'bg-teal-100 text-teal-700',
  Promotions:     'bg-pink-100 text-pink-700',
  Replenishment:  'bg-orange-100 text-orange-700',
  Roster:         'bg-cyan-100 text-cyan-700',
  Dashboard:      'bg-brand-100 text-brand-700',
  Performance:    'bg-emerald-100 text-emerald-700',
  Security:       'bg-red-100 text-red-700',
  Admin:          'bg-slate-200 text-slate-700',
  'UI/UX':        'bg-amber-100 text-amber-700',
};

function ChangelogPanel() {
  const [expanded, setExpanded] = useState<string | null>(CHANGELOG[0]?.version ?? null);

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Portal Changelog</h2>
          <p className="text-sm text-slate-500 mt-0.5">A record of every feature release and improvement made to this portal.</p>
        </div>
        <span className="badge bg-brand-100 text-brand-700 text-xs">
          {CHANGELOG.length} releases
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[22px] top-3 bottom-3 w-px bg-slate-200" aria-hidden="true" />

        <div className="space-y-3">
          {CHANGELOG.map((v: ChangelogVersion) => {
            const isOpen = expanded === v.version;
            return (
              <div key={v.version} className="relative pl-12">
                {/* Dot */}
                <div className={`absolute left-[14px] top-3.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center
                  ${v.isLatest ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'}`}>
                  {v.isLatest && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>

                {/* Card */}
                <div className={`card transition-shadow ${isOpen ? 'shadow-md' : ''}`}>
                  {/* Card header — always visible */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : v.version)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors rounded-xl"
                  >
                    {/* Version pill */}
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0
                      ${v.isLatest ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {v.version}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{v.label}</span>
                        {v.isLatest && (
                          <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{v.summary}</p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-400">
                        {new Date(v.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-slate-400 tabular-nums">{v.changes.length} changes</span>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded change list */}
                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 py-4 space-y-2">
                      {v.changes.map((c, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className={`mt-0.5 flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap
                            ${CATEGORY_COLOURS[c.category] ?? 'bg-slate-100 text-slate-600'}`}>
                            {c.category}
                          </span>
                          <p className="text-sm text-slate-700 leading-snug">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Evidence Folders Panel ───────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function EvidenceFoldersPanel() {
  const [folders, setFolders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  const currentMonth = new Date().getMonth(); // 0-indexed
  const currentYear  = new Date().getFullYear();
  const isJanuary    = currentMonth === 0;

  useEffect(() => {
    fetch('/api/settings/evidence-folders')
      .then(r => r.json())
      .then(d => { setFolders(d.data ?? {}); setLoading(false); });
  }, []);

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await fetch('/api/settings/evidence-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folders),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-slate-500 py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Evidence Folders</h2>
        <p className="text-sm text-slate-500 mt-1">
          Paste your Google Drive folder link for each month. Staff will see the current month&apos;s link automatically on the Submit Fault Case form — no manual updating needed.
        </p>
      </div>

      {/* Year rollover alert — shown every January */}
      {isJanuary && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">New year — update your evidence folders</p>
            <p className="text-xs text-amber-700 mt-0.5">
              It&apos;s {currentYear}. Create new monthly folders in Google Drive for this year and paste the links below.
            </p>
          </div>
        </div>
      )}

      <div className="card divide-y divide-slate-100 overflow-hidden p-0">
        {MONTHS.map((month, i) => {
          const key       = String(i + 1);
          const isCurrent = i === currentMonth;
          const url       = folders[key] ?? '';
          return (
            <div key={month} className={`flex items-center gap-3 px-4 py-3 ${isCurrent ? 'bg-brand-50' : ''}`}>
              <div className="w-24 flex-shrink-0">
                <span className={`text-sm font-medium ${isCurrent ? 'text-brand-700' : 'text-slate-700'}`}>{month}</span>
                {isCurrent && <span className="ml-2 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">Current</span>}
              </div>
              <input
                type="url"
                value={url}
                onChange={e => setFolders(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder="https://drive.google.com/drive/folders/..."
                className="form-input flex-1 text-xs font-mono"
              />
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-slate-400 hover:text-brand-600">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary gap-2">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save Folders'}
        </button>
        {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle size={14} /> Saved</span>}
      </div>
    </div>
  );
}

// ─── Product Launches Panel ───────────────────────────────────────────────────
interface Launch {
  id: string;
  name: string;
  description: string;
  price_aud: number | null;
  image_url: string;
  launch_date: string | null;
  link: string;
  archived: boolean;
}

const BLANK_LAUNCH = { name: '', description: '', priceAud: '', imageUrl: '', launchDate: '', link: '' };

function ProductLaunchesPanel() {
  const [launches, setLaunches]   = useState<Launch[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Launch | null>(null);
  const [form, setForm]           = useState(BLANK_LAUNCH);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr]             = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    // Keep expired launches available here for editing or reference; the
    // dashboard endpoint hides them automatically after 14 days.
    const res = await fetch('/api/product-launches?includeExpired=true').then(r => r.json());
    setLaunches(res.data ?? []);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(BLANK_LAUNCH);
    setErr('');
    setShowModal(true);
  }

  function openEdit(l: Launch) {
    setEditing(l);
    setForm({
      name: l.name,
      description: l.description,
      priceAud: l.price_aud != null ? String(l.price_aud) : '',
      imageUrl: l.image_url,
      launchDate: l.launch_date ?? '',
      link: l.link,
    });
    setErr('');
    setShowModal(true);
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      setForm(f => ({ ...f, imageUrl: res.data.url }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Product name is required'); return; }
    setSaving(true); setErr('');
    try {
      const body = {
        ...(editing ? { id: editing.id } : {}),
        name:       form.name.trim(),
        description: form.description.trim(),
        priceAud:   form.priceAud ? parseFloat(form.priceAud) : null,
        imageUrl:   form.imageUrl,
        launchDate: form.launchDate || null,
        link:       form.link.trim(),
      };
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch('/api/product-launches', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      setShowModal(false);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    await fetch('/api/product-launches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, archived: true }),
    });
    load();
  }

  if (loading) return <div className="text-sm text-slate-500 py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Product Launches</h2>
          <p className="text-sm text-slate-500 mt-0.5">Launches appear on the dashboard until 14 days after their launch date.</p>
        </div>
        <button onClick={openNew} className="btn-primary gap-2"><Plus size={14} /> Add Launch</button>
      </div>

      {launches.length === 0 ? (
        <div className="card p-10 text-center text-slate-400 text-sm">No launches yet — add one above.</div>
      ) : (
        <div className="space-y-3">
          {launches.map(l => {
            const isLive = l.launch_date ? new Date(l.launch_date) <= new Date() : true;
            return (
              <div key={l.id} className="card p-4 flex items-center gap-4">
                {l.image_url ? (
                  <img src={l.image_url} alt={l.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-slate-100" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={20} className="text-slate-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{l.name}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isLive ? 'Live' : 'Coming Soon'}
                    </span>
                  </div>
                  {l.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{l.description}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    {l.price_aud != null && <span className="font-semibold text-slate-700">${l.price_aud.toFixed(2)} AUD</span>}
                    {l.launch_date && <span>{new Date(l.launch_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(l)} className="btn-ghost p-2"><Pencil size={14} /></button>
                  <button onClick={() => handleArchive(l.id)} className="btn-ghost p-2 text-slate-400 hover:text-red-500"><X size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{editing ? 'Edit Launch' : 'New Product Launch'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Image upload */}
              <div>
                <label className="form-label">Product Photo</label>
                <div
                  className="relative rounded-xl border-2 border-dashed border-slate-200 hover:border-brand-400 transition-colors cursor-pointer overflow-hidden"
                  style={{ minHeight: form.imageUrl ? 'auto' : '120px' }}
                  onClick={() => document.getElementById('launch-img-input')?.click()}
                >
                  {form.imageUrl ? (
                    <div className="relative">
                      <img src={form.imageUrl} alt="preview" className="w-full max-h-48 object-contain bg-slate-50" />
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, imageUrl: '' })); }}
                        className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-slate-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                      {uploading ? <RefreshCw size={20} className="animate-spin mb-2" /> : <ImageIcon size={20} className="mb-2" />}
                      <span className="text-xs">{uploading ? 'Uploading…' : 'Click to upload product photo'}</span>
                    </div>
                  )}
                  <input
                    id="launch-img-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Product Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="e.g. PowerPack Ultra" />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="form-input resize-none" placeholder="Key feature or positioning statement…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Retail Price (AUD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input type="number" step="0.01" min="0" value={form.priceAud} onChange={e => setForm(f => ({ ...f, priceAud: e.target.value }))} className="form-input pl-7" placeholder="49.95" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Launch Date</label>
                  <input type="date" value={form.launchDate} onChange={e => setForm(f => ({ ...f, launchDate: e.target.value }))} className="form-input" />
                </div>
              </div>
              <div>
                <label className="form-label">Link <span className="text-slate-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <LinkIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="url" value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} className="form-input pl-8" placeholder="https://snapwireless.com.au/…" />
                </div>
              </div>
              {err && <p className="text-sm text-red-600">{err}</p>}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : editing ? 'Save Changes' : 'Add Launch'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
