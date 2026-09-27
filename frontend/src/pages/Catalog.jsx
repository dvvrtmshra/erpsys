import { useEffect, useState } from 'react';
import api from '../api';

const empty = { sku: '', name: '', description: '', unit_price: '', unit: 'unit' };

export default function Catalog() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/catalog').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async e => {
    e.preventDefault();
    setError('');
    try {
      if (form.id) {
        await api.put(`/catalog/${form.id}`, form);
      } else {
        await api.post('/catalog', form);
      }
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving item');
    }
  };

  const del = async id => {
    if (!confirm('Delete this item?')) return;
    await api.delete(`/catalog/${id}`);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Catalog</h2>
        <button className="btn-primary" onClick={() => setForm(empty)}>+ Add Item</button>
      </div>

      {form && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{form.id ? 'Edit Item' : 'New Item'}</h3>
            <form onSubmit={save}>
              <label>SKU *<input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} required /></label>
              <label>Name *<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
              <label>Description<textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
              <label>Unit Price<input type="number" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} /></label>
              <label>Unit<input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></label>
              {error && <p className="error">{error}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Save</button>
                <button type="button" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>SKU</th><th>Name</th><th>Unit Price</th><th>Unit</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.sku}</td>
              <td>{item.name}</td>
              <td>{parseFloat(item.unit_price).toFixed(2)}</td>
              <td>{item.unit}</td>
              <td>
                <button className="btn-sm" onClick={() => setForm(item)}>Edit</button>
                <button className="btn-sm btn-danger" onClick={() => del(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={5} className="empty">No items yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
