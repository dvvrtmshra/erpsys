import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Package, ShoppingCart, Truck,
  Building2, FileText, AlertTriangle, TrendingUp
} from 'lucide-react';
import api from '../api';

const STATUS_COLORS = {
  pending: '#f59e0b', confirmed: '#3b82f6', shipped: '#8b5cf6',
  delivered: '#10b981', cancelled: '#ef4444',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    Promise.allSettled([
      api.get('/catalog'),
      api.get('/inventory'),
      api.get('/orders'),
      api.get('/purchases'),
      api.get('/suppliers'),
      api.get('/tenders'),
    ]).then(([catalog, inventory, orders, purchases, suppliers, tenders]) => {
      const ok = r => r.status === 'fulfilled';
      const val = (r, fallback = []) => ok(r) ? r.value.data : fallback;
      const errs = [catalog, inventory, orders, purchases, suppliers, tenders]
        .filter(r => !ok(r))
        .map(r => r.reason?.response?.data?.error || r.reason?.message);
      if (errs.length) setWarnings(errs);

      const invData = val(inventory);
      const ordData = val(orders);
      const purData = val(purchases);
      const low = invData.filter(i => parseFloat(i.quantity) < parseFloat(i.min_stock_level ?? 10));
      setLowStockItems(low.slice(0, 5));
      setRecentOrders(ordData.slice(0, 5));
      setStats({
        catalogCount: val(catalog).length,
        lowStock: low.length,
        pendingOrders: ordData.filter(o => o.status === 'pending').length,
        totalOrders: ordData.length,
        pendingPurchases: purData.filter(p => p.status === 'pending').length,
        supplierCount: val(suppliers).length,
        openTenders: val(tenders).filter(t => t.status === 'open').length,
        inventoryItems: invData.length,
      });
    });
  }, []);

  if (!stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', gap: 10, fontSize: 14 }}>
        <div style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading dashboard…
      </div>
    );
  }

  const statCards = [
    { label: 'Catalog Items', value: stats.catalogCount, icon: BookOpen, color: '#6366f1', bg: '#eef2ff', to: '/catalog' },
    { label: 'Inventory Items', value: stats.inventoryItems, icon: Package, color: '#0ea5e9', bg: '#f0f9ff', to: '/inventory' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: ShoppingCart, color: '#f59e0b', bg: '#fffbeb', to: '/orders' },
    { label: 'Pending POs', value: stats.pendingPurchases, icon: Truck, color: '#8b5cf6', bg: '#f5f3ff', to: '/purchases' },
    { label: 'Suppliers', value: stats.supplierCount, icon: Building2, color: '#10b981', bg: '#f0fdf4', to: '/suppliers' },
    { label: 'Open Tenders', value: stats.openTenders, icon: FileText, color: '#ec4899', bg: '#fdf2f8', to: '/tenders' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Dashboard</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Welcome back — here's what's happening today.</p>
      </div>

      {/* API error warnings (non-fatal) */}
      {warnings.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff1f2',
          border: '1px solid #fecdd3', borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <AlertTriangle size={16} color="#be123c" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#be123c', marginBottom: 2 }}>Some data could not be loaded</div>
            {warnings.map((w, i) => <div key={i} style={{ fontSize: 11, color: '#9f1239' }}>{w}</div>)}
          </div>
        </div>
      )}

      {/* Low stock alert */}
      {stats.lowStock > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, background: '#fffbeb',
          border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 24,
        }}>
          <AlertTriangle size={18} color="#d97706" strokeWidth={2} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#92400e', fontWeight: 500 }}>
            <strong>{stats.lowStock} item{stats.lowStock > 1 ? 's' : ''}</strong> {stats.lowStock > 1 ? 'are' : 'is'} running low on stock.
          </span>
          <Link to="/inventory" style={{ marginLeft: 'auto', fontSize: 12, color: '#d97706', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            View inventory →
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        {statCards.map(card => (
          <Link key={card.to} to={card.to} style={{ textDecoration: 'none' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: card.bg }}>
                <card.icon size={18} color={card.color} strokeWidth={2} />
              </div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Recent orders */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={15} color="#6366f1" strokeWidth={2} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Recent Orders</span>
            </div>
            <Link to="/orders" style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No orders yet</div>
          ) : (
            <div>
              {recentOrders.map((o, i) => (
                <div key={o.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 20px', borderBottom: i < recentOrders.length - 1 ? '1px solid #f8fafc' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>
                      {o.customer_name || 'Walk-in'}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Order #{o.id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                      Rs. {parseFloat(o.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <span style={{
                      display: 'inline-block', marginTop: 3, padding: '2px 8px', borderRadius: 99,
                      fontSize: 10, fontWeight: 600, color: '#fff',
                      background: STATUS_COLORS[o.status] || '#64748b',
                    }}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock items */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} color="#f59e0b" strokeWidth={2} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Low Stock</span>
            </div>
            <Link to="/inventory" style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
          </div>
          {lowStockItems.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>All items well-stocked</div>
          ) : (
            <div>
              {lowStockItems.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 20px', borderBottom: i < lowStockItems.length - 1 ? '1px solid #f8fafc' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{item.item_name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' }}>
                      {item.type?.replace('_', ' ')}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: parseInt(item.quantity) === 0 ? '#fff1f2' : '#fffbeb',
                    color: parseInt(item.quantity) === 0 ? '#be123c' : '#92400e',
                    padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                  }}>
                    {parseInt(item.quantity) === 0 ? '⚠ Out of stock' : `${parseInt(item.quantity)} left`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
