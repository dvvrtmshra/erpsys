import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Package, ShoppingCart, Truck,
  Building2, FileText, AlertTriangle, TrendingUp
} from 'lucide-react';
import api from '../api';

const STATUS_COLORS = {
  pending: '#d09b2c', confirmed: '#2383e2', shipped: '#8b5cf6',
  delivered: '#4dab85', cancelled: '#eb5757',
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
      <div className="loading">
        <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const statCards = [
    { label: 'Catalog Items',    value: stats.catalogCount,       icon: BookOpen,    color: '#6366f1', bg: 'rgba(99,102,241,0.12)',   to: '/catalog' },
    { label: 'Inventory Items',  value: stats.inventoryItems,     icon: Package,     color: '#2383e2', bg: 'rgba(35,131,226,0.12)',    to: '/inventory' },
    { label: 'Pending Orders',   value: stats.pendingOrders,      icon: ShoppingCart,color: '#d09b2c', bg: 'rgba(208,155,44,0.12)',    to: '/orders' },
    { label: 'Pending POs',      value: stats.pendingPurchases,   icon: Truck,       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',    to: '/purchases' },
    { label: 'Suppliers',        value: stats.supplierCount,      icon: Building2,   color: '#4dab85', bg: 'rgba(77,171,133,0.12)',    to: '/suppliers' },
    { label: 'Open Tenders',     value: stats.openTenders,        icon: FileText,    color: '#ec4899', bg: 'rgba(236,72,153,0.12)',    to: '/tenders' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.5px' }}>Dashboard</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Welcome back — here's what's happening today.</p>
      </div>

      {/* API warnings */}
      {warnings.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'var(--danger-bg)', border: '1px solid var(--danger-b)',
          borderRadius: 8, padding: '12px 14px', marginBottom: 16,
        }}>
          <AlertTriangle size={15} color="var(--danger)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 2 }}>Some data could not be loaded</div>
            {warnings.map((w, i) => <div key={i} style={{ fontSize: 11, color: 'var(--danger)', opacity: 0.8 }}>{w}</div>)}
          </div>
        </div>
      )}

      {/* Low stock alert */}
      {stats.lowStock > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--warn-bg)', border: '1px solid var(--warn-b)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 20,
        }}>
          <AlertTriangle size={15} color="var(--warn)" strokeWidth={2} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--warn)', fontWeight: 500 }}>
            <strong>{stats.lowStock}</strong> item{stats.lowStock > 1 ? 's' : ''} {stats.lowStock > 1 ? 'are' : 'is'} running low on stock.
          </span>
          <Link to="/inventory" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--warn)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', opacity: 0.85 }}>
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
                <card.icon size={15} color={card.color} strokeWidth={1.8} />
              </div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Recent orders */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <TrendingUp size={14} color="var(--accent)" strokeWidth={2} />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>Recent Orders</span>
            </div>
            <Link to="/orders" style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, textDecoration: 'none' }}>View all →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No orders yet</div>
          ) : (
            <div>
              {recentOrders.map((o, i) => (
                <div key={o.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderBottom: i < recentOrders.length - 1 ? '1px solid var(--border-2)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{o.customer_name || 'Walk-in'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Order #{o.id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                      Rs. {parseFloat(o.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <span style={{
                      display: 'inline-block', marginTop: 3, padding: '2px 7px', borderRadius: 4,
                      fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.9)',
                      background: STATUS_COLORS[o.status] || 'var(--surface-3)',
                    }}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <AlertTriangle size={14} color="var(--warn)" strokeWidth={2} />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>Low Stock</span>
            </div>
            <Link to="/inventory" style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, textDecoration: 'none' }}>View all →</Link>
          </div>
          {lowStockItems.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>All items well-stocked</div>
          ) : (
            <div>
              {lowStockItems.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderBottom: i < lowStockItems.length - 1 ? '1px solid var(--border-2)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{item.item_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, textTransform: 'capitalize' }}>
                      {item.type?.replace('_', ' ')}
                    </div>
                  </div>
                  <div style={{
                    padding: '3px 9px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                    background: parseFloat(item.quantity) === 0 ? 'var(--danger-bg)' : 'var(--warn-bg)',
                    color: parseFloat(item.quantity) === 0 ? 'var(--danger)' : 'var(--warn)',
                  }}>
                    {parseFloat(item.quantity) === 0 ? 'Out of stock' : `${parseFloat(item.quantity)} left`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
