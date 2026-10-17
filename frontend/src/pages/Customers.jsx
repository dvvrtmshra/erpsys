import { useEffect, useState } from 'react';
import api from '../api';
import Modal from '../components/Modal';

const empty = { name: '', contact_person: '', email: '', phone: '', address: '' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = () => api.get('/customers').then(r => setCustomers(r.data));
  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q ||
      c.name?.toLowerCase().includes(q) ||
      c.contact_person?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q);
  });

  const save = async e => {
    e.preventDefault();
    setError('');
    try {
      if (form.id) {
        await api.put(`/customers/${form.id}`, form);
      } else {
        await api.post('/customers', form);
      }
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  const del = async id => {
    if (!confirm('Delete this customer?')) return;
    setError('');
    try {
      await api.delete(`/customers/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Customers</h2>
        <button className="btn-primary" onClick={() => { setForm(empty); setError(''); }}>+ Add Customer</button>
      </div>

      <div className="search-row">
        <input className="search-input" placeholder="Search by name, contact, email…" value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button className="btn-sm" onClick={() => setSearch('')}>Clear</button>}
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{filtered.length} of {customers.length}</span>
      </div>

      {error && !form && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      {form && (
        <Modal title={form.id ? 'Edit Customer' : 'New Customer'} onClose={() => setForm(null)}>
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
        </Modal>
      )}

      <table className="data-table">
        <thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Address</th><th>Actions</th></tr></thead>
        <tbody>
          {filtered.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.contact_person || '—'}</td>
              <td>{c.email || '—'}</td>
              <td>{c.phone || '—'}</td>
              <td>{c.address || '—'}</td>
              <td>
                <button className="btn-sm" onClick={() => { setForm(c); setError(''); }}>Edit</button>
                <button className="btn-sm btn-danger" onClick={() => del(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={6} className="empty">{customers.length ? 'No customers match your search.' : 'No customers yet'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
