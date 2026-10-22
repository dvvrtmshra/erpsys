import { useEffect, useState } from 'react';
import { X, BookOpen } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const CATEGORIES = [
  'Garden Equipment', 'Indoor Play Equipment', 'Outdoor Fitness Equipment',
  'Park Furniture', 'Sports Equipment', 'School Equipment',
  'Water Play Equipment', 'Sensory Play Equipment',
];

const emptyForm = { catalog_number: '', name: '', category: '', description: '', unit_price: '', unit: 'unit' };

function ItemPreview({ item, onClose, onEdit, onDelete, canEdit }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 540,
        maxWidth: '100%',
        maxHeight: '88vh',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        animation: 'previewIn 0.18s ease',
      }}>
        {/* Image area */}
        {item.image_url ? (
          <div style={{ width: '100%', height: 220, flexShrink: 0, overflow: 'hidden', background: 'var(--surface-2)' }}>
            <img
              src={`http://localhost:3002${item.image_url}`}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ) : (
          <div style={{
            width: '100%', height: 120, flexShrink: 0, background: 'var(--surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={36} color="var(--text-3)" strokeWidth={1} />
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '20px 24px 24px', flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                {item.catalog_number}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                {item.name}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 6, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center' }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {item.category && (
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 5,
              background: 'var(--accent-bg)', color: 'var(--accent)',
              fontSize: 12, fontWeight: 500, marginBottom: 14,
            }}>
              {item.category}
            </span>
          )}

          {item.description && (
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 18 }}>
              {item.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 28, paddingTop: 16, borderTop: '1px solid var(--border-2)', marginBottom: canEdit ? 16 : 0 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Unit Price</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.4px' }}>
                Rs.&nbsp;{parseFloat(item.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Unit</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginTop: 3 }}>{item.unit}</div>
            </div>
          </div>

          {canEdit && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={onEdit}>Edit Item</button>
              <button className="btn-sm btn-danger" onClick={onDelete}>Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Catalog() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const load = () => api.get('/catalog').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      item.name?.toLowerCase().includes(q) ||
      item.catalog_number?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q);
    const matchCat = !categoryFilter || item.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const openForm = item => {
    setForm(item ? { ...item } : { ...emptyForm });
    setImageFile(null);
    setImagePreview(item?.image_url ? `http://localhost:3002${item.image_url}` : null);
    setError('');
  };

  const handleImageChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const save = async e => {
    e.preventDefault();
    setError('');
    try {
      const data = new FormData();
      data.append('catalog_number', form.catalog_number);
      data.append('name', form.name);
      data.append('category', form.category || '');
      data.append('description', form.description || '');
      data.append('unit_price', form.unit_price || 0);
      data.append('unit', form.unit || 'unit');
      if (imageFile) data.append('image', imageFile);
      if (form.id) {
        await api.put(`/catalog/${form.id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/catalog', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving item');
    }
  };

  const del = async id => {
    if (!confirm('Delete this item?')) return;
    setError('');
    try {
      await api.delete(`/catalog/${id}`);
      setPreviewItem(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Catalog</h2>
        {canEdit && <button className="btn-primary" onClick={() => openForm(null)}>+ Add Item</button>}
      </div>

      <div className="search-row">
        <input className="search-input" placeholder="Search by name, catalog no., category…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || categoryFilter) && (
          <button className="btn-sm" onClick={() => { setSearch(''); setCategoryFilter(''); }}>Clear</button>
        )}
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{filtered.length} of {items.length} items</span>
      </div>

      {error && !form && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      {form && (
        <Modal title={form.id ? 'Edit Item' : 'New Item'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <label>Catalog Number *<input value={form.catalog_number} onChange={e => setForm({ ...form, catalog_number: e.target.value })} required /></label>
            <label>Name *<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Category
              <input
                list="catalog-categories"
                value={form.category || ''}
                onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="Select or type a category"
              />
              <datalist id="catalog-categories">
                {CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </label>
            <label>Description<textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <label>Unit Price<input type="number" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} /></label>
            <label>Unit<input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></label>
            <label>Image
              <input type="file" accept="image/*" onChange={handleImageChange} />
              {imagePreview && <img src={imagePreview} alt="preview" style={{ marginTop: 8, maxHeight: 100, borderRadius: 4, display: 'block' }} />}
            </label>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn-primary">Save</button>
              <button type="button" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {previewItem && (
        <ItemPreview
          item={previewItem}
          canEdit={canEdit}
          onClose={() => setPreviewItem(null)}
          onEdit={() => { setPreviewItem(null); openForm(previewItem); }}
          onDelete={() => del(previewItem.id)}
        />
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Image</th><th>Catalog No.</th><th>Name</th><th>Category</th><th>Unit Price</th><th>Unit</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map(item => (
            <tr
              key={item.id}
              style={{ cursor: 'pointer' }}
              onClick={() => setPreviewItem(item)}
            >
              <td>
                {item.image_url
                  ? <img src={`http://localhost:3002${item.image_url}`} alt={item.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                  : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={14} color="var(--text-3)" strokeWidth={1.5} />
                    </div>}
              </td>
              <td style={{ color: 'var(--text-2)', fontFamily: 'monospace', fontSize: 12 }}>{item.catalog_number}</td>
              <td style={{ fontWeight: 500 }}>{item.name}</td>
              <td>{item.category || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
              <td>{parseFloat(item.unit_price).toFixed(2)}</td>
              <td>{item.unit}</td>
              {canEdit && (
                <td onClick={e => e.stopPropagation()}>
                  <button className="btn-sm" onClick={() => openForm(item)}>Edit</button>
                  <button className="btn-sm btn-danger" onClick={() => del(item.id)}>Delete</button>
                </td>
              )}
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={7} className="empty">{items.length ? 'No items match your search.' : 'No items yet'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
