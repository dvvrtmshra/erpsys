import { useEffect, useState } from 'react';
import api from '../api';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

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
            <h3>Update Stock — {editing.item_name}</h3>
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
        <thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Unit</th><th>Location</th><th>Updated</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className={rowClass(item.quantity)}>
              <td>{item.sku}</td>
              <td>{item.item_name}</td>
              <td>{parseFloat(item.quantity).toFixed(2)}</td>
              <td>{item.unit}</td>
              <td>{item.location || '—'}</td>
              <td>{new Date(item.updated_at).toLocaleDateString()}</td>
              <td><button className="btn-sm" onClick={() => setEditing(item)}>Edit</button></td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={7} className="empty">No inventory records. Add items in Catalog first.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
