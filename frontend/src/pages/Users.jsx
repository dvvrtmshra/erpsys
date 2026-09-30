import { useEffect, useState } from 'react';
import api from '../api';

const empty = { username: '', email: '', password: '', role: 'viewer' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

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
        <button className="btn-primary" onClick={() => setForm(empty)}>+ Add User</button>
      </div>

      {form && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{form.id ? 'Edit User' : 'New User'}</h3>
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
          </div>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td><span className="badge" style={{ background: u.role === 'admin' ? '#c0392b' : u.role === 'manager' ? '#2980b9' : '#7f8c8d' }}>{u.role}</span></td>
              <td>{new Date(u.created_at).toLocaleDateString()}</td>
              <td>
                <button className="btn-sm" onClick={() => setForm({ ...u, password: '' })}>Edit</button>
                <button className="btn-sm btn-danger" onClick={() => del(u.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!users.length && <tr><td colSpan={5} className="empty">No users</td></tr>}
        </tbody>
      </table>
    </div>
  );
}