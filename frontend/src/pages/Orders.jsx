import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { downloadQuotationPdf } from '../utils/quotationPdf';

const STATUS_COLORS = { pending: '#f39c12', confirmed: '#2980b9', shipped: '#8e44ad', delivered: '#27ae60', cancelled: '#c0392b' };
const PAY_COLORS   = { unpaid: '#e74c3c', partial: '#f39c12', paid: '#27ae60' };

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/orders')
      .then(r => setOrders(r.data))
      .catch(() => setError('Failed to load orders.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.customer_name?.toLowerCase().includes(q) || String(o.id).includes(q);
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const del = async id => {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    try {
      await api.delete(`/orders/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete order.');
    }
  };

  const downloadPdf = async (orderId) => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      downloadQuotationPdf(res.data);
    } catch {
      setError('Could not generate PDF.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Orders</h2>
        <Link to="/orders/new" className="btn-primary" style={{ textDecoration: 'none', padding: '8px 16px', borderRadius: 4, background: '#0969da', color: '#fff', fontSize: 14 }}>+ New Order</Link>
      </div>

      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="search-row">
        <input className="search-input" placeholder="Search by customer or order #…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['pending','confirmed','shipped','delivered','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || statusFilter) && <button className="btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>Clear</button>}
        <span style={{ fontSize: 13, color: '#888' }}>{filtered.length} of {orders.length}</span>
      </div>

      {loading ? (
        <div className="loading">Loading orders…</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th><th>Date</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.customer_name || '—'}</td>
                <td><span className="badge" style={{ background: STATUS_COLORS[o.status] }}>{o.status}</span></td>
                <td><span className="badge" style={{ background: PAY_COLORS[o.payment_status] || '#999' }}>{o.payment_status || 'unpaid'}</span></td>
                <td>Rs. {parseFloat(o.total_amount).toFixed(2)}</td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
                <td>
                  <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)} style={{ fontSize: 12, marginRight: 6 }}>
                    {['pending','confirmed','shipped','delivered','cancelled'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <Link to={`/orders/${o.id}/edit`} className="btn-sm" style={{ textDecoration: 'none', marginRight: 4 }}>Edit</Link>
                  <button className="btn-sm" onClick={() => downloadPdf(o.id)} style={{ marginRight: 4 }}>⬇ PDF</button>
                  <button className="btn-sm btn-danger" onClick={() => del(o.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={7} className="empty">{orders.length ? 'No orders match your search.' : 'No orders yet.'}</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
