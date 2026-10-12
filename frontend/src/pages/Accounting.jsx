import { useEffect, useState } from 'react';
import api from '../api';
import Modal from '../components/Modal';

const empty = { type: 'income', amount: '', description: '', reference: '', entry_date: '' };

export default function Accounting() {
  const [data, setData] = useState({ entries: [], summary: { income: 0, expense: 0, balance: 0 } });
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const load = () => api.get('/accounting').then(r => setData(r.data));
  useEffect(() => { load(); }, []);

  const filtered = data.entries.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      e.description?.toLowerCase().includes(q) ||
      e.reference?.toLowerCase().includes(q);
    const matchType = !typeFilter || e.type === typeFilter;
    return matchSearch && matchType;
  });

  const save = async e => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/accounting', form);
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  const del = async id => {
    if (!confirm('Delete this entry?')) return;
    setError('');
    try {
      await api.delete(`/accounting/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const { income, expense, balance } = data.summary;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Accounting</h2>
        <button className="btn-primary" onClick={() => { setForm(empty); setError(''); }}>+ Add Entry</button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div className="summary-card" style={{ borderColor: '#27ae60' }}>
          <div style={{ color: '#27ae60', fontSize: 22, fontWeight: 700 }}>{income.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Total Income</div>
        </div>
        <div className="summary-card" style={{ borderColor: '#c0392b' }}>
          <div style={{ color: '#c0392b', fontSize: 22, fontWeight: 700 }}>{expense.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Total Expenses</div>
        </div>
        <div className="summary-card" style={{ borderColor: balance >= 0 ? '#2980b9' : '#c0392b' }}>
          <div style={{ color: balance >= 0 ? '#2980b9' : '#c0392b', fontSize: 22, fontWeight: 700 }}>{balance.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Balance</div>
        </div>
      </div>

      <div className="search-row">
        <input className="search-input" placeholder="Search by description or reference…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        {(search || typeFilter) && <button className="btn-sm" onClick={() => { setSearch(''); setTypeFilter(''); }}>Clear</button>}
        <span style={{ fontSize: 13, color: '#888' }}>{filtered.length} of {data.entries.length}</span>
      </div>

      {error && !form && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      {form && (
        <Modal title="New Entry" onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <label>Type
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </label>
            <label>Amount *<input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></label>
            <label>Description<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <label>Reference<input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></label>
            <label>Date<input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></label>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn-primary">Save</button>
              <button type="button" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      <table className="data-table">
        <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Description</th><th>Reference</th><th>Actions</th></tr></thead>
        <tbody>
          {filtered.map(e => (
            <tr key={e.id}>
              <td>{e.entry_date ? new Date(e.entry_date).toLocaleDateString() : '—'}</td>
              <td><span className="badge" style={{ background: e.type === 'income' ? '#27ae60' : '#c0392b' }}>{e.type}</span></td>
              <td>{parseFloat(e.amount).toFixed(2)}</td>
              <td>{e.description || '—'}</td>
              <td>{e.reference || '—'}</td>
              <td><button className="btn-sm btn-danger" onClick={() => del(e.id)}>Delete</button></td>
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={6} className="empty">{data.entries.length ? 'No entries match your search.' : 'No entries yet'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
