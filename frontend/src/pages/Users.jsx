import { useEffect, useState } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const empty = { username: '', email: '', password: '', role: 'viewer' };

const ROLE_META = {
  admin:   { label: 'Admin',   color: '#7c3aed', bg: 'rgba(124,58,237,0.12)', desc: 'Full access — manage users, all data, settings' },
  manager: { label: 'Manager', color: '#0369a1', bg: 'rgba(3,105,161,0.12)',  desc: 'Create and edit orders, purchases, inventory, catalog' },
  viewer:  { label: 'Viewer',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)', desc: 'Read-only access to all data' },
};

function RoleBadge({ role }) {
  const m = ROLE_META[role] || ROLE_META.viewer;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.03em',
      color: m.color,
      background: m.bg,
      textTransform: 'capitalize',
    }}>{m.label}</span>
  );
}

export default function Users() {
  const { user: me } = useAuth();
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
    if (!confirm('Delete this user? This cannot be undone.')) return;
    setError('');
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const isSelf = form?.id === me?.id;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Users</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Manage who can access this system and their permissions.</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(empty); setError(''); }}>+ Add User</button>
      </div>

      {/* Role legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(ROLE_META).map(([key, m]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 12 }}>
            <RoleBadge role={key} />
            <span style={{ color: 'var(--text-3)' }}>{m.desc}</span>
          </div>
        ))}
      </div>

      <div className="search-row">
        <input className="search-input" placeholder="Search by username, email, role…" value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button className="btn-sm" onClick={() => setSearch('')}>Clear</button>}
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{filtered.length} of {users.length}</span>
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
              {isSelf ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                  <RoleBadge role={form.role} />
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>You cannot change your own role.</span>
                </div>
              ) : (
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="viewer">Viewer — read-only access</option>
                  <option value="manager">Manager — can create and edit records</option>
                  <option value="admin">Admin — full access including user management</option>
                </select>
              )}
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
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(u => (
            <tr key={u.id}>
              <td>
                {u.username}
                {u.id === me?.id && <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 6 }}>(you)</span>}
              </td>
              <td>{u.email}</td>
              <td><RoleBadge role={u.role} /></td>
              <td>{new Date(u.created_at).toLocaleDateString()}</td>
              <td>
                <button className="btn-sm" onClick={() => { setForm({ ...u, password: '' }); setError(''); }}>Edit</button>
                {u.id !== me?.id && (
                  <button className="btn-sm btn-danger" onClick={() => del(u.id)}>Delete</button>
                )}
              </td>
            </tr>
          ))}
          {!filtered.length && (
            <tr><td colSpan={5} className="empty">{users.length ? 'No users match your search.' : 'No users found.'}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
