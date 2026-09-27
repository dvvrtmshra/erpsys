import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function OrderForm() {
  const [customers, setCustomers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ item_id: '', quantity: 1, unit_price: 0 }]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data));
    api.get('/catalog').then(r => setCatalog(r.data));
  }, []);

  const setItem = (idx, field, val) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    if (field === 'item_id') {
      const cat = catalog.find(c => c.id === parseInt(val));
      if (cat) next[idx].unit_price = cat.unit_price;
    }
    setItems(next);
  };

  const total = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

  const submit = async e => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/orders', { customer_id: customerId || null, notes, items });
      navigate('/orders');
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating order');
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h2>New Order</h2>
      <form onSubmit={submit}>
        <label>Customer
          <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">— select —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} /></label>

        <h3>Items</h3>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={item.item_id} onChange={e => setItem(idx, 'item_id', e.target.value)} style={{ flex: 2 }}>
              <option value="">— item —</option>
              {catalog.map(c => <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>)}
            </select>
            <input type="number" step="0.01" min="0.01" value={item.quantity} onChange={e => setItem(idx, 'quantity', parseFloat(e.target.value))} style={{ width: 80 }} placeholder="Qty" />
            <input type="number" step="0.01" value={item.unit_price} onChange={e => setItem(idx, 'unit_price', parseFloat(e.target.value))} style={{ width: 90 }} placeholder="Price" />
            <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn-sm" onClick={() => setItems([...items, { item_id: '', quantity: 1, unit_price: 0 }])}>+ Add line</button>

        <div style={{ marginTop: 12, fontWeight: 600 }}>Total: {total.toFixed(2)}</div>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="btn-primary">Create Order</button>
          <button type="button" onClick={() => navigate('/orders')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
