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
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const load = () => api.get('/tenders').then(r => setTenders(r.data));
  useEffect(() => { load(); }, []);

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
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Issued By</th>
            <th>Status</th>
            <th>Awarded To</th>
            <th>Deadline</th>
            <th>Budget</th>
            <th>Suppliers</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {tenders.map(t => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td>
                <span className="badge" style={{ background: TYPE_COLORS[t.tender_type] }}>
                  {t.tender_type}
                </span>
              </td>
              <td>{t.issued_by || '—'}</td>
              <td>
                <span className="badge" style={{ background: STATUS_COLORS[t.status] }}>
                  {t.status.replace('_', ' ')}
                </span>
              </td>
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
          {!tenders.length && <tr><td colSpan={9} className="empty">No tenders yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
