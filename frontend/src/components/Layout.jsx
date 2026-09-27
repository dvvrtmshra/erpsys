import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/orders', label: 'Orders' },
  { to: '/purchases', label: 'Purchases' },
  { to: '/suppliers', label: 'Suppliers' },
  { to: '/tenders', label: 'Tenders' },
  { to: '/accounting', label: 'Accounting' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">ERP System</div>
        <nav>
          {navItems.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              {n.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Users
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.username} ({user?.role})</span>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
