import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';

export default function TenderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', status: 'open', deadline: '', budget: '', awarded_supplier_id: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data));
    if (id) {
      api.get(`/tenders/${id}`).then(r => {
        const t = r.data;
        setForm({
          title: t.title,
          description: t.description || '',
          status: t.status,
          deadline: t.deadline ? t.deadline.substring(0, 10) : '',
          budget: t.budget || '',
          awarded_supplier_id: t.awarded_supplier_id || '',
        });
      });
    }
  }, [id]);

  const submit = async e => {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...form, awarded_supplier_id: form.awarded_supplier_id || null };
      if (id) {
        await api.put(`/tenders/${id}`, payload);
      } else {
        await api.post('/tenders', payload);
      }
      navigate('/tenders');
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h2>{id ? 'Edit Tender' : 'New Tender'}</h2>
      <form onSubmit={submit}>
        <label>Title *<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
        <label>Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        {id && (
          <label>Status
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {['open','closed','awarded','cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
        )}
        <label>Deadline<input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></label>
        <label>Budget<input type="number" step="0.01" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} /></label>
        {id && (
          <label>Awarded To
            <select value={form.awarded_supplier_id} onChange={e => setForm({ ...form, awarded_supplier_id: e.target.value })}>
              <option value="">— none —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="btn-primary">{id ? 'Save Changes' : 'Create Tender'}</button>
          <button type="button" onClick={() => navigate('/tenders')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
