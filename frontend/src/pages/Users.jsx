import { useEffect, useState } from 'react';
import api from '../api';
import Modal from '../components/Modal';

const empty = { username: '', email: '', password: '', role: 'viewer' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q);
  });

  const save = async e => {
    e.preventDefault();
    setError('');
    try {
      if (form.id) {
        await api.put(`/users/${form.id}`, form);
      } else {
        await api.post('/users', form);
      }
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  const del = async id => {
    if (!confirm('Delete this user?')) return;
    setError('');
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Users</h2>
        <button className="btn-primary" onClick={() => { setForm(empty); setError(''); }}>+ Add User</button>
      </div>

      <div className="search-row">
        <input className="search-input" placeholder="Search by username, email, role…" value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button className="btn-sm" onClick={() => setSearch('')}>Clear</button>}
        <span style={{ fontSize: 13, color: '#888' }}>{filtered.length} of {users.length}</span>
      </div>

      {error && !form && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      {form && (
        <Modal title={form.id ? 'Edit User' : 'New User'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <label>Username *<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /></label>
            <label>Email *<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
            <label>Password {form.id ? '(leave blank to keep)' : '*'}
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!form.id} />
            </label>
            <label>Role
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn-primary">Save</button>
              <button type="button" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      <table className="data-table">
        <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          {filtered.map(u => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td><span className="badge" style={{ background: u.role === 'admin' ? '#c0392b' : u.role === 'manager' ? '#2980b9' : '#7f8c8d' }}>{u.role}</span></td>
              <td>{new Date(u.created_at).toLocaleDateString()}</td>
              <td>
                <button className="btn-sm" onClick={() => { setForm({ ...u, password: '' }); setError(''); }}>Edit</button>
                <button className="btn-sm btn-danger" onClick={() => del(u.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={5} className="empty">{users.length ? 'No users match your search.' : 'No users'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
