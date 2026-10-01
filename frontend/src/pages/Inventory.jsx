import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const load = () => api.get('/inventory').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async e => {
    e.preventDefault();
    await api.put(`/inventory/${editing.item_id}`, { quantity: editing.quantity, location: editing.location });
    setEditing(null);
    load();
  };

  const rowClass = qty => parseFloat(qty) < 10 ? 'row-warn' : '';

  return (
    <div>
      <h2>Inventory</h2>
      <p style={{ color: '#888', fontSize: 13 }}>Items with quantity below 10 are highlighted.</p>

      {editing && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{editing.id ? 'Update Stock' : 'Add to Inventory'} — {editing.item_name}</h3>
            <form onSubmit={save}>
              <label>Quantity<input type="number" step="0.01" value={editing.quantity} onChange={e => setEditing({ ...editing, quantity: e.target.value })} /></label>
              <label>Location<input value={editing.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} /></label>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Save</button>
                <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Unit</th><th>Location</th><th>Updated</th>{canEdit && <th>Actions</th>}</tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.item_id} className={rowClass(item.quantity)}>
              <td>{item.sku}</td>
              <td>{item.item_name}</td>
              <td>{item.id ? parseFloat(item.quantity).toFixed(2) : <span style={{ color: '#aaa' }}>—</span>}</td>
              <td>{item.unit}</td>
              <td>{item.location || '—'}</td>
              <td>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}</td>
              {canEdit && (
                <td>
                  <button className="btn-sm" onClick={() => setEditing({ ...item, quantity: item.quantity || 0 })}>
                    {item.id ? 'Edit' : 'Add to Inventory'}
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!items.length && <tr><td colSpan={7} className="empty">No catalog items found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
