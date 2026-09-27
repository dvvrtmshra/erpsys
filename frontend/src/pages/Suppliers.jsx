import { useEffect, useState } from 'react';
import api from '../api';

const empty = { name: '', contact_person: '', email: '', phone: '', address: '' };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/suppliers').then(r => setSuppliers(r.data));
  useEffect(() => { load(); }, []);

  const save = async e => {
    e.preventDefault();
    setError('');
    try {
      if (form.id) {
        await api.put(`/suppliers/${form.id}`, form);
      } else {
        await api.post('/suppliers', form);
      }
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  const del = async id => {
    if (!confirm('Delete this supplier?')) return;
    await api.delete(`/suppliers/${id}`);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Suppliers</h2>
        <button className="btn-primary" onClick={() => setForm(empty)}>+ Add Supplier</button>
      </div>

      {form && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{form.id ? 'Edit Supplier' : 'New Supplier'}</h3>
            <form onSubmit={save}>
              <label>Name *<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
              <label>Contact Person<input value={form.contact_person || ''} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></label>
              <label>Email<input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
              <label>Phone<input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
              <label>Address<textarea value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
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
        <thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
        <tbody>
          {suppliers.map(s => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.contact_person || '—'}</td>
              <td>{s.email || '—'}</td>
              <td>{s.phone || '—'}</td>
              <td>
                <button className="btn-sm" onClick={() => setForm(s)}>Edit</button>
                <button className="btn-sm btn-danger" onClick={() => del(s.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!suppliers.length && <tr><td colSpan={5} className="empty">No suppliers yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
