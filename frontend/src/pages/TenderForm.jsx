import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['open', 'bidding', 'awarded', 'in_progress', 'completed', 'cancelled'];

const emptyForm = {
  title: '', description: '', tender_type: 'private', issued_by: '',
  awarded_to: '', status: 'open', deadline: '', budget: '',
};

export default function TenderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [allInventory, setAllInventory] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    const handler = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    api.get('/suppliers').then(r => setAllSuppliers(r.data));
    api.get('/inventory').then(r => setAllInventory(r.data.filter(i => i.id))); // only items with stock records
    if (id) {
      api.get(`/tenders/${id}`).then(r => {
        const t = r.data;
        setForm({
          title: t.title || '',
          description: t.description || '',
          tender_type: t.tender_type || 'private',
          issued_by: t.issued_by || '',
          awarded_to: t.awarded_to || '',
          status: t.status || 'open',
          deadline: t.deadline ? t.deadline.substring(0, 10) : '',
          budget: t.budget || '',
        });
        setSuppliers((t.suppliers || []).map(s => ({ supplier_id: String(s.supplier_id), material_notes: s.material_notes || '' })));
        setItems((t.items || []).map(i => ({ item_id: String(i.item_id), quantity_needed: i.quantity_needed || '', notes: i.notes || '', stock_qty: i.stock_qty })));
      });
    }
  }, [id]);

  const addSupplier = () => setSuppliers([...suppliers, { supplier_id: '', material_notes: '' }]);
  const removeSupplier = i => setSuppliers(suppliers.filter((_, idx) => idx !== i));
  const updateSupplier = (i, field, val) => setSuppliers(suppliers.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  const addItem = () => { setIsDirty(true); setItems([...items, { item_id: '', quantity_needed: '', notes: '' }]); };
  const removeItem = i => { setIsDirty(true); setItems(items.filter((_, idx) => idx !== i)); };
  const updateItem = (i, field, val) => { setIsDirty(true);
    const updated = items.map((it, idx) => idx === i ? { ...it, [field]: val } : it);
    if (field === 'item_id') {
      const inv = allInventory.find(x => String(x.item_id) === val);
      updated[i].stock_qty = inv ? inv.quantity : null;
    }
    setItems(updated);
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        budget: form.budget || null,
        deadline: form.deadline || null,
        suppliers: suppliers.filter(s => s.supplier_id),
        items: items.filter(i => i.item_id),
      };
      if (id) {
        await api.put(`/tenders/${id}`, payload);
      } else {
        await api.post('/tenders', payload);
      }
      setIsDirty(false);
      navigate('/tenders');
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div style={{ maxWidth: 620 }}>
      <h2>{id ? 'Edit Tender' : 'New Tender'}</h2>
      <form onSubmit={submit}>
        <label>Title *
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>Type
          <select value={form.tender_type} onChange={e => setForm({ ...form, tender_type: e.target.value })}>
            <option value="government">Government</option>
            <option value="private">Private</option>
          </select>
        </label>
        <label>Issued By (organization that issued the tender)
          <input value={form.issued_by} onChange={e => setForm({ ...form, issued_by: e.target.value })} placeholder="e.g. Ministry of Infrastructure" />
        </label>
        <label>Description
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </label>
        <label>Deadline
          <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
        </label>
        <label>Budget
          <input type="number" step="0.01" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
        </label>

        {id && (
          <>
            <label>Status
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </label>
            <label>Awarded To (who received the tender)
              <input value={form.awarded_to} onChange={e => setForm({ ...form, awarded_to: e.target.value })} placeholder="e.g. ABC Construction Ltd" />
            </label>
          </>
        )}

        {/* Suppliers section */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>Raw Material Suppliers</strong>
            {canEdit && <button type="button" className="btn-sm" onClick={addSupplier}>+ Add Supplier</button>}
          </div>
          {suppliers.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>No suppliers linked yet.</p>}
          {suppliers.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <select value={s.supplier_id} onChange={e => updateSupplier(i, 'supplier_id', e.target.value)} style={{ flex: 1 }}>
                <option value="">— select supplier —</option>
                {allSuppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
              </select>
              <input placeholder="Materials / notes" value={s.material_notes} onChange={e => updateSupplier(i, 'material_notes', e.target.value)} style={{ flex: 2 }} />
              {canEdit && <button type="button" className="btn-sm btn-danger" onClick={() => removeSupplier(i)}>✕</button>}
            </div>
          ))}
        </div>

        {/* Inventory items section */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>Materials from Inventory</strong>
            {canEdit && <button type="button" className="btn-sm" onClick={addItem}>+ Add from Inventory</button>}
          </div>
          {items.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>No inventory items linked yet.</p>}
          {items.map((item, i) => {
            const inv = allInventory.find(x => String(x.item_id) === String(item.item_id));
            const stockQty = inv ? parseFloat(inv.quantity) : item.stock_qty;
            const needed = parseFloat(item.quantity_needed) || 0;
            const insufficient = stockQty !== null && needed > stockQty;
            return (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                <select value={item.item_id} onChange={e => updateItem(i, 'item_id', e.target.value)} style={{ flex: 2 }}>
                  <option value="">— select inventory item —</option>
                  {allInventory.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.item_name} — stock: {parseFloat(inv.quantity)} {inv.unit}
                    </option>
                  ))}
                </select>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="number" step="1" min="1" placeholder="Qty needed"
                    value={item.quantity_needed}
                    onChange={e => updateItem(i, 'quantity_needed', e.target.value)}
                    style={{ width: '100%', borderColor: insufficient ? '#e74c3c' : '' }}
                  />
                  {insufficient && (
                    <span style={{ fontSize: 11, color: '#e74c3c', display: 'block' }}>
                      Only {stockQty} in stock
                    </span>
                  )}
                </div>
                <input placeholder="Notes" value={item.notes} onChange={e => updateItem(i, 'notes', e.target.value)} style={{ flex: 2 }} />
                {canEdit && <button type="button" className="btn-sm btn-danger" onClick={() => removeItem(i)}>✕</button>}
              </div>
            );
          })}
        </div>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="btn-primary">{id ? 'Save Changes' : 'Create Tender'}</button>
          <button type="button" onClick={() => navigate('/tenders')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
