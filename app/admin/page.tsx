'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  CheckCircle,
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
} from 'lucide-react';
import { Product, Manufacturer, FaultType } from '@/types';
import { CHANGELOG, CHANGELOG_SEEN_KEY, LATEST_VERSION, type ChangelogVersion } from '@/lib/changelog';

// Generic CRUD panel used for all three entity types
type Tab = 'products' | 'manufacturers' | 'faultTypes' | 'staff' | 'logins' | 'kpiTargets' | 'roster' | 'changelog';

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

  const tabs: { key: Tab; label: string; icon: React.ElementType; badge?: boolean; onSelect?: () => void }[] = [
    { key: 'products',      label: 'Products',      icon: Package      },
    { key: 'manufacturers', label: 'Manufacturers', icon: Building2    },
    { key: 'faultTypes',    label: 'Fault Types',   icon: Tag          },
    { key: 'staff',         label: 'Staff',         icon: Users        },
    { key: 'logins',        label: 'Logins',        icon: KeyRound     },
    { key: 'kpiTargets',    label: 'KPI Targets',   icon: Target       },
    { key: 'roster',        label: 'Roster',        icon: CalendarDays },
    { key: 'changelog',     label: 'Changelog',     icon: History,     badge: hasNewChangelog, onSelect: handleChangelogTab },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Admin Settings</h1>
        <p className="page-subtitle">Manage products, manufacturers, and fault types</p>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { if (t.onSelect) t.onSelect(); else setActiveTab(t.key); }}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={15} />
            {t.label}
            {t.badge && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-500 rounded-full border-2 border-slate-100" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'products'      && <ProductsPanel />}
      {activeTab === 'manufacturers' && <ManufacturersPanel />}
      {activeTab === 'faultTypes'    && <FaultTypesPanel />}
      {activeTab === 'staff'         && <StaffPanel />}
      {activeTab === 'logins'        && <LoginsPanel />}
      {activeTab === 'kpiTargets'    && <KpiTargetsPanel />}
      {activeTab === 'roster'        && <RosterSettingsPanel />}
      {activeTab === 'changelog'     && <ChangelogPanel />}
    </div>
  );
}

// ─── Products Panel ────────────────────────────────────────────────────────────

function ProductsPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', manufacturerName: '', unitCostUSD: '', manufacturerNumbers: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/products');
    const json = await res.json();
    setProducts(json.data || []);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: '', manufacturerName: '', unitCostUSD: '', manufacturerNumbers: '' });
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
    });
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
      if (json.error) throw new Error(json.error);
      setShowModal(false);
      setSuccess(editing ? 'Product updated.' : 'Product created.');
      setTimeout(() => setSuccess(''), 3000);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
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
      <table className="data-table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Manufacturer</th>
            <th>Unit Cost</th>
            <th>Manufacturer Numbers</th>
            <th className="w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-10 text-slate-400">No products yet. Add one above.</td></tr>
          ) : (
            products.map(p => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td className="text-slate-500">{p.manufacturerName}</td>
                <td className="font-semibold">${p.unitCostUSD.toFixed(2)}</td>
                <td className="text-slate-400 text-xs">{p.manufacturerNumbers.join(', ') || '—'}</td>
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
              <input value={form.manufacturerName} onChange={e => setForm(f=>({...f,manufacturerName:e.target.value}))} className="form-input" placeholder="e.g. Acme Corp" />
            </div>
            <div>
              <label className="form-label">Unit Cost (USD)</label>
              <input type="number" step="0.01" value={form.unitCostUSD} onChange={e => setForm(f=>({...f,unitCostUSD:e.target.value}))} className="form-input" placeholder="0.00" min={0} />
            </div>
            <div>
              <label className="form-label">Manufacturer Numbers</label>
              <input value={form.manufacturerNumbers} onChange={e => setForm(f=>({...f,manufacturerNumbers:e.target.value}))} className="form-input" placeholder="MN-001, MN-002, MN-003 (comma separated)" />
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
  const [mfrs, setMfrs] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Manufacturer | null>(null);
  const [form, setForm] = useState({ name: '', contactEmail: '', phone: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []);

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
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/manufacturers?id=${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <CrudPanel title="Manufacturers" description="Manufacturer contact details for claim communications." loading={loading} success={success} onNew={openNew} newLabel="Add Manufacturer">
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
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/fault-types?id=${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <CrudPanel title="Fault Types" description="These appear as options in the fault submission form." loading={loading} success={success} onNew={openNew} newLabel="Add Fault Type">
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
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/staff');
    const json = await res.json();
    setStaff(json.data || []);
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
    if (!confirm(`Remove "${name}" from the team list?`)) return;
    await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Staff Members</h2>
          <p className="text-xs text-slate-500">Names available in the fault submission dropdown</p>
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
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(member => (
                <tr key={member.id}>
                  <td className="font-medium text-slate-800">{member.name}</td>
                  <td>
                    <button
                      onClick={() => handleDelete(member.id, member.name)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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

function groupByDay(events: LoginEvent[]): { label: string; items: LoginEvent[] }[] {
  const groups: Record<string, LoginEvent[]> = {};
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  for (const e of events) {
    const day = e.date || e.loggedIn.slice(0, 10);
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
