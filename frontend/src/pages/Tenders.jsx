import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const STATUS_COLORS = { open: '#27ae60', closed: '#7f8c8d', awarded: '#2980b9', cancelled: '#c0392b' };

export default function Tenders() {
  const [tenders, setTenders] = useState([]);

  const load = () => api.get('/tenders').then(r => setTenders(r.data));
  useEffect(() => { load(); }, []);

  const del = async id => {
    if (!confirm('Delete this tender?')) return;
    await api.delete(`/tenders/${id}`);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Tenders</h2>
        <Link to="/tenders/new" className="btn-primary" style={{ textDecoration: 'none', padding: '8px 16px', borderRadius: 4, background: '#0969da', color: '#fff', fontSize: 14 }}>+ New Tender</Link>
      </div>
      <table className="data-table">
        <thead><tr><th>Title</th><th>Status</th><th>Deadline</th><th>Budget</th><th>Awarded To</th><th>Actions</th></tr></thead>
        <tbody>
          {tenders.map(t => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td><span className="badge" style={{ background: STATUS_COLORS[t.status] }}>{t.status}</span></td>
              <td>{t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}</td>
              <td>{t.budget ? parseFloat(t.budget).toFixed(2) : '—'}</td>
              <td>{t.awarded_supplier_name || '—'}</td>
              <td>
                <Link to={`/tenders/${t.id}/edit`} className="btn-sm" style={{ textDecoration: 'none' }}>Edit</Link>
                <button className="btn-sm btn-danger" onClick={() => del(t.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!tenders.length && <tr><td colSpan={6} className="empty">No tenders yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
