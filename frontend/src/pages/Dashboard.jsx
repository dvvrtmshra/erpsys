import { useEffect, useState } from 'react';
import api from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/catalog'),
      api.get('/inventory'),
      api.get('/orders'),
      api.get('/purchases'),
      api.get('/suppliers'),
      api.get('/tenders'),
    ]).then(([catalog, inventory, orders, purchases, suppliers, tenders]) => {
      setStats({
        catalogCount: catalog.data.length,
        lowStock: inventory.data.filter(i => parseFloat(i.quantity) < 10).length,
        pendingOrders: orders.data.filter(o => o.status === 'pending').length,
        pendingPurchases: purchases.data.filter(p => p.status === 'pending').length,
        supplierCount: suppliers.data.length,
        openTenders: tenders.data.filter(t => t.status === 'open').length,
      });
    }).catch(() => {});
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      {stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
          <StatCard label="Catalog Items" value={stats.catalogCount} />
          <StatCard label="Low Stock Items" value={stats.lowStock} warn={stats.lowStock > 0} />
          <StatCard label="Pending Orders" value={stats.pendingOrders} />
          <StatCard label="Pending Purchases" value={stats.pendingPurchases} />
          <StatCard label="Suppliers" value={stats.supplierCount} />
          <StatCard label="Open Tenders" value={stats.openTenders} />
        </div>
      ) : (
        <p>Loading…</p>
      )}
    </div>
  );
}

function StatCard({ label, value, warn }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${warn ? '#e74c3c' : '#e2e8f0'}`,
      borderRadius: 8,
      padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: warn ? '#c0392b' : '#1e2a3a' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{label}</div>
    </div>
  );
}
