import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const STATUS_COLORS = { pending: '#f39c12', confirmed: '#2980b9', shipped: '#8e44ad', delivered: '#27ae60', cancelled: '#c0392b' };

export default function Orders() {
  const [orders, setOrders] = useState([]);

  const load = () => api.get('/orders').then(r => setOrders(r.data));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await api.patch(`/orders/${id}/status`, { status });
    load();
  };

  const del = async id => {
    if (!confirm('Delete this order?')) return;
    await api.delete(`/orders/${id}`);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Orders</h2>
        <Link to="/orders/new" className="btn-primary" style={{ textDecoration: 'none', padding: '8px 16px', borderRadius: 4, background: '#0969da', color: '#fff', fontSize: 14 }}>+ New Order</Link>
      </div>
      <table className="data-table">
        <thead><tr><th>#</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{o.customer_name || '—'}</td>
              <td><span className="badge" style={{ background: STATUS_COLORS[o.status] }}>{o.status}</span></td>
              <td>{parseFloat(o.total_amount).toFixed(2)}</td>
              <td>{new Date(o.created_at).toLocaleDateString()}</td>
              <td>
                <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)} style={{ fontSize: 12, marginRight: 6 }}>
                  {['pending','confirmed','shipped','delivered','cancelled'].map(s => <option key={s}>{s}</option>)}
                </select>
                <button className="btn-sm btn-danger" onClick={() => del(o.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!orders.length && <tr><td colSpan={6} className="empty">No orders yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
