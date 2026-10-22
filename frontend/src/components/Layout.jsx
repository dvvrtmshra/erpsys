import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutGrid, BookMarked, Archive, UsersRound, ShoppingBag,
  Package, Building, ScrollText, Wallet, ShieldCheck, LogOut,
  Settings2, KeyRound, SunMedium, MoonStar
} from 'lucide-react';
import Modal from './Modal';
import './Layout.css';

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',  icon: LayoutGrid },
  { to: '/catalog',    label: 'Catalog',     icon: BookMarked },
  { to: '/inventory',  label: 'Inventory',   icon: Archive },
  { to: '/customers',  label: 'Customers',   icon: UsersRound },
  { to: '/orders',     label: 'Orders',      icon: ShoppingBag },
  { to: '/purchases',  label: 'Purchases',   icon: Package },
  { to: '/suppliers',  label: 'Suppliers',   icon: Building },
  { to: '/tenders',    label: 'Tenders',     icon: ScrollText },
  { to: '/accounting', label: 'Accounting',  icon: Wallet },
];

function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.next !== form.confirm) { setError('New passwords do not match.'); return; }
    if (form.next.length < 6) { setError('New password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await changePassword(form.current, form.next);
      setSuccess('Password changed successfully.');
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Change Password" onClose={onClose}>
      <form onSubmit={submit}>
        <label>Current Password *
          <input type="password" value={form.current} onChange={e => setForm({ ...form, current: e.target.value })} required autoFocus />
        </label>
        <label>New Password *
          <input type="password" value={form.next} onChange={e => setForm({ ...form, next: e.target.value })} required />
        </label>
        <label>Confirm New Password *
          <input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required />
        </label>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <div className="modal-actions">
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Change Password'}</button>
          <button type="button" className="btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const initials = user?.username?.slice(0, 2).toUpperCase() || 'U';
  const [showPwModal, setShowPwModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();
  const [theme, setTheme] = useState(() => localStorage.getItem('erp-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('erp-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    if (!menuOpen) return;
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">e</div>
          <span className="sidebar-brand-name">ERP System</span>
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <SunMedium size={14} strokeWidth={2} /> : <MoonStar size={14} strokeWidth={2} />}
          </button>
        </div>

        <nav>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Icon className="nav-icon" size={16} strokeWidth={1.6} />
              {label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <ShieldCheck className="nav-icon" size={16} strokeWidth={1.6} />
              Users
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer" ref={menuRef}>
          <div className="sidebar-user-card" onClick={() => setMenuOpen(o => !o)}>
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{user?.username}</div>
              <div className="sidebar-role">{user?.role}</div>
            </div>
            <Settings2 size={13} className="sidebar-settings-icon" />
          </div>
          {menuOpen && (
            <div className="user-menu">
              <button className="user-menu-item" onClick={() => { setMenuOpen(false); setShowPwModal(true); }}>
                <KeyRound size={13} strokeWidth={2} /> Change Password
              </button>
              <div className="user-menu-divider" />
              <button className="user-menu-item user-menu-danger" onClick={logout}>
                <LogOut size={13} strokeWidth={2} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
    </div>
  );
}
