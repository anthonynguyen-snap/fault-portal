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
} from 'lucide-react';
import { Product, Manufacturer, FaultType } from '@/types';

// Generic CRUD panel used for all three entity types
type Tab = 'products' | 'manufacturers' | 'faultTypes';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('products');

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'products',      label: 'Products',      icon: Package   },
    { key: 'manufacturers', label: 'Manufacturers', icon: Building2 },
    { key: 'faultTypes',    label: 'Fault Types',   icon: Tag       },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Admin Settings</h1>
        <p className="page-subtitle">Manage products, manufacturers, and fault types</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'products'      && <ProductsPanel />}
      {activeTab === 'manufacturers' && <ManufacturersPanel />}
      {activeTab === 'faultTypes'    && <FaultTypesPanel />}
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
