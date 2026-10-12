import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyRaw = { type: 'raw_material', item_name: '', description: '', unit: 'unit', quantity: '', location: '' };
const emptyFinished = { type: 'finished_good', catalog_item_id: '', item_name: '', description: '', unit: 'unit', quantity: '', location: '' };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [availableCatalog, setAvailableCatalog] = useState([]);
  const [tab, setTab] = useState('finished'); // 'finished' | 'raw'
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const load = () => api.get('/inventory').then(r => setItems(r.data));
  const loadCatalog = () => api.get('/inventory/available-catalog').then(r => setAvailableCatalog(r.data));

  useEffect(() => { load(); }, []);

  const finished = items.filter(i => i.type === 'finished_good');
  const raw = items.filter(i => i.type === 'raw_material');
  const activeList = tab === 'finished' ? finished : raw;

  const filtered = activeList.filter(item => {
    const q = search.toLowerCase();
    return !q ||
      item.item_name?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.location?.toLowerCase().includes(q) ||
      item.catalog_number?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q);
  });

  const openForm = async (item) => {
    if (!item) {
      if (tab === 'finished') {
        await loadCatalog();
        setForm({ ...emptyFinished });
      } else {
        setForm({ ...emptyRaw });
      }
    } else {
      setForm({ ...item });
    }
    setError('');
  };

  const onCatalogSelect = e => {
    const id = e.target.value;
    const cat = availableCatalog.find(c => String(c.id) === id);
    setForm(f => ({
      ...f,
      catalog_item_id: id,
      item_name: cat ? cat.name : '',
      unit: cat ? cat.unit : 'unit',
      description: '',
    }));
  };

  const save = async e => {
    e.preventDefault();
    setError('');
    try {
      if (form.id) {
        await api.put(`/inventory/${form.id}`, form);
      } else {
        await api.post('/inventory', form);
      }
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving item');
    }
  };

  const del = async id => {
    if (!confirm('Delete this inventory item?')) return;
    setError('');
    try {
      await api.delete(`/inventory/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const rowClass = qty => parseFloat(qty) < 10 ? 'row-warn' : '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Inventory</h2>
        {canEdit && <button className="btn-primary" onClick={() => openForm(null)}>+ Add Item</button>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #e2e8f0' }}>
        <button
          onClick={() => { setTab('finished'); setSearch(''); }}
          style={{
            padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            color: tab === 'finished' ? '#0969da' : '#666',
            borderBottom: tab === 'finished' ? '2px solid #0969da' : '2px solid transparent',
            marginBottom: -2,
          }}
        >
          Finished Goods ({finished.length})
        </button>
        <button
          onClick={() => { setTab('raw'); setSearch(''); }}
          style={{
            padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            color: tab === 'raw' ? '#0969da' : '#666',
            borderBottom: tab === 'raw' ? '2px solid #0969da' : '2px solid transparent',
            marginBottom: -2,
          }}
        >
          Raw Materials ({raw.length})
        </button>
      </div>

      <div className="search-row">
        <input
          className="search-input"
          placeholder={tab === 'finished' ? 'Search by name, catalog no., category…' : 'Search by name, description, location…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button className="btn-sm" onClick={() => setSearch('')}>Clear</button>}
        <span style={{ fontSize: 13, color: '#888' }}>{filtered.length} of {activeList.length} items</span>
      </div>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Items with quantity below 10 are highlighted.</p>

      {error && !form && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      {/* Add / Edit Modal */}
      {form && (
        <Modal
          title={form.id ? 'Edit Item' : (form.type === 'finished_good' ? 'Add Finished Good' : 'Add Raw Material')}
          onClose={() => setForm(null)}
        >
          <form onSubmit={save}>
            {/* Finished good: catalog selector (only on new) */}
            {form.type === 'finished_good' && !form.id && (
              <label>Product (from Catalog) *
                <select value={form.catalog_item_id} onChange={onCatalogSelect} required>
                  <option value="">— select a catalog item —</option>
                  {availableCatalog.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.catalog_number} — {c.name}{c.category ? ` (${c.category})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>Item Name *
              <input
                value={form.item_name}
                onChange={e => setForm({ ...form, item_name: e.target.value })}
                required
                readOnly={form.type === 'finished_good' && !form.id && !!form.catalog_item_id}
              />
            </label>
            <label>Description
              <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
            </label>
            <label>Unit
              <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            </label>
            <label>Quantity
              <input type="number" step="1" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </label>
            <label>Location
              <input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} />
            </label>

            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn-primary">Save</button>
              <button type="button" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Finished Goods Table */}
      {tab === 'finished' && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Catalog No.</th><th>Product Name</th><th>Category</th>
              <th>Unit</th><th>Qty</th><th>Location</th><th>Updated</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className={rowClass(item.quantity)}>
                <td>{item.catalog_number || '—'}</td>
                <td>{item.item_name}</td>
                <td>{item.category || '—'}</td>
                <td>{item.unit}</td>
                <td>{parseInt(item.quantity)}</td>
                <td>{item.location || '—'}</td>
                <td>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}</td>
                {canEdit && (
                  <td>
                    <button className="btn-sm" onClick={() => openForm(item)}>Edit</button>
                    <button className="btn-sm btn-danger" onClick={() => del(item.id)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} className="empty">
                {activeList.length ? 'No items match your search.' : 'No finished goods in stock. Add products from the catalog.'}
              </td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Raw Materials Table */}
      {tab === 'raw' && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Item Name</th><th>Description</th><th>Unit</th><th>Qty</th><th>Location</th><th>Updated</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className={rowClass(item.quantity)}>
                <td>{item.item_name}</td>
                <td>{item.description || '—'}</td>
                <td>{item.unit}</td>
                <td>{parseInt(item.quantity)}</td>
                <td>{item.location || '—'}</td>
                <td>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}</td>
                {canEdit && (
                  <td>
                    <button className="btn-sm" onClick={() => openForm(item)}>Edit</button>
                    <button className="btn-sm btn-danger" onClick={() => del(item.id)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={7} className="empty">
                {activeList.length ? 'No items match your search.' : 'No raw materials added yet.'}
              </td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
