import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  open: '#27ae60', bidding: '#f39c12', awarded: '#2980b9',
  in_progress: '#8e44ad', completed: '#16a085', cancelled: '#c0392b',
};
const TYPE_COLORS = { government: '#1a6b3a', private: '#1a4d8f' };

export default function Tenders() {
  const [tenders, setTenders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const load = () => api.get('/tenders').then(r => setTenders(r.data));
  useEffect(() => { load(); }, []);

  const filtered = tenders.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      t.title?.toLowerCase().includes(q) ||
      t.issued_by?.toLowerCase().includes(q) ||
      t.awarded_to?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const del = async id => {
    if (!confirm('Delete this tender?')) return;
    try {
      await api.delete(`/tenders/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Tenders</h2>
        {canEdit && (
          <Link to="/tenders/new" className="btn-primary" style={{ textDecoration: 'none', padding: '8px 16px', borderRadius: 4, background: '#0969da', color: '#fff', fontSize: 14 }}>
            + New Tender
          </Link>
        )}
      </div>

      <div className="search-row">
        <input className="search-input" placeholder="Search by title, issued by…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['open','bidding','awarded','in_progress','completed','cancelled'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        {(search || statusFilter) && <button className="btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>Clear</button>}
        <span style={{ fontSize: 13, color: '#888' }}>{filtered.length} of {tenders.length}</span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th><th>Type</th><th>Issued By</th><th>Status</th><th>Awarded To</th>
            <th>Deadline</th><th>Budget</th><th>Suppliers</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map(t => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td><span className="badge" style={{ background: TYPE_COLORS[t.tender_type] }}>{t.tender_type}</span></td>
              <td>{t.issued_by || '—'}</td>
              <td><span className="badge" style={{ background: STATUS_COLORS[t.status] }}>{t.status.replace('_', ' ')}</span></td>
              <td>{t.awarded_to || '—'}</td>
              <td>{t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}</td>
              <td>{t.budget ? parseFloat(t.budget).toLocaleString() : '—'}</td>
              <td>
                {t.supplier_count > 0 && <span>{t.supplier_count} supplier{t.supplier_count > 1 ? 's' : ''}</span>}
                {t.supplier_count > 0 && t.item_count > 0 && ', '}
                {t.item_count > 0 && <span>{t.item_count} inv. item{t.item_count > 1 ? 's' : ''}</span>}
                {!t.supplier_count && !t.item_count && <span style={{ color: '#aaa' }}>none</span>}
              </td>
              {canEdit && (
                <td>
                  <Link to={`/tenders/${t.id}/edit`} className="btn-sm" style={{ textDecoration: 'none' }}>Edit</Link>
                  <button className="btn-sm btn-danger" onClick={() => del(t.id)}>Delete</button>
                </td>
              )}
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={9} className="empty">{tenders.length ? 'No tenders match your search.' : 'No tenders yet'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
