import { useEffect, useState } from 'react';
import api from '../api';
import Modal from '../components/Modal';

const STATUS_COLORS = { pending: '#f39c12', ordered: '#2980b9', received: '#27ae60', cancelled: '#c0392b' };
const empty = { supplier_id: '', notes: '', items: [{ item_id: '', quantity: 1, unit_price: 0 }] };

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/purchases').then(r => setPurchases(r.data));

  useEffect(() => {
    load();
    api.get('/suppliers').then(r => setSuppliers(r.data));
    api.get('/catalog').then(r => setCatalog(r.data));
  }, []);

  const setLineItem = (idx, field, val) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: val };
    if (field === 'item_id') {
      const cat = catalog.find(c => c.id === parseInt(val));
      if (cat) items[idx].unit_price = cat.unit_price;
    }
    setForm({ ...form, items });
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/purchases', form);
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  const updateStatus = async (id, status) => {
    await api.patch(`/purchases/${id}/status`, { status });
    load();
  };

  const del = async id => {
    if (!confirm('Delete?')) return;
    setError('');
    try {
      await api.delete(`/purchases/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const total = form ? form.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Purchases</h2>
        <button className="btn-primary" onClick={() => { setForm(JSON.parse(JSON.stringify(empty))); setError(''); }}>+ New Purchase</button>
      </div>

      {error && !form && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      {form && (
        <Modal title="New Purchase Order" onClose={() => setForm(null)} style={{ maxWidth: 620 }}>
          <form onSubmit={submit}>
            <label>Supplier
              <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">— select —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>Notes<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
            <h4>Items</h4>
            {form.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select value={item.item_id} onChange={e => setLineItem(idx, 'item_id', e.target.value)} style={{ flex: 2 }}>
                  <option value="">— item —</option>
                  {catalog.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" step="1" min="1" value={item.quantity} onChange={e => setLineItem(idx, 'quantity', parseInt(e.target.value) || 1)} style={{ width: 70 }} placeholder="Qty" />
                <input type="number" step="0.01" value={item.unit_price} onChange={e => setLineItem(idx, 'unit_price', parseFloat(e.target.value))} style={{ width: 80 }} placeholder="Price" />
                <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}>✕</button>
              </div>
            ))}
            <button type="button" className="btn-sm" onClick={() => setForm({ ...form, items: [...form.items, { item_id: '', quantity: 1, unit_price: 0 }] })}>+ Add</button>
            <div style={{ marginTop: 8, fontWeight: 600 }}>Total: {total.toFixed(2)}</div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn-primary">Create</button>
              <button type="button" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      <table className="data-table">
        <thead><tr><th>#</th><th>Supplier</th><th>Status</th><th>Total</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          {purchases.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.supplier_name || '—'}</td>
              <td><span className="badge" style={{ background: STATUS_COLORS[p.status] }}>{p.status}</span></td>
              <td>{parseFloat(p.total_amount).toFixed(2)}</td>
              <td>{new Date(p.created_at).toLocaleDateString()}</td>
              <td>
                <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)} style={{ fontSize: 12, marginRight: 6 }}>
                  {['pending','ordered','received','cancelled'].map(s => <option key={s}>{s}</option>)}
                </select>
                <button className="btn-sm btn-danger" onClick={() => del(p.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!purchases.length && <tr><td colSpan={6} className="empty">No purchases yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
