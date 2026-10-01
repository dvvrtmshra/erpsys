import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const emptyForm = { sku: '', name: '', description: '', unit_price: '', unit: 'unit' };

export default function Catalog() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const load = () => api.get('/catalog').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

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
      data.append('sku', form.sku);
      data.append('name', form.name);
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
    try {
      await api.delete(`/catalog/${id}`);
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

      {form && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{form.id ? 'Edit Item' : 'New Item'}</h3>
            <form onSubmit={save}>
              <label>SKU *<input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} required /></label>
              <label>Name *<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
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
          </div>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>Image</th><th>SKU</th><th>Name</th><th>Unit Price</th><th>Unit</th>{canEdit && <th>Actions</th>}</tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>
                {item.image_url
                  ? <img src={`http://localhost:3002${item.image_url}`} alt={item.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                  : <span style={{ color: '#ccc', fontSize: 12 }}>No image</span>}
              </td>
              <td>{item.sku}</td>
              <td>{item.name}</td>
              <td>{parseFloat(item.unit_price).toFixed(2)}</td>
              <td>{item.unit}</td>
              {canEdit && (
                <td>
                  <button className="btn-sm" onClick={() => openForm(item)}>Edit</button>
                  <button className="btn-sm btn-danger" onClick={() => del(item.id)}>Delete</button>
                </td>
              )}
            </tr>
          ))}
          {!items.length && <tr><td colSpan={6} className="empty">No items yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
