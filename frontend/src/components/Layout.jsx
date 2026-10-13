import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, BookOpen, Package, Users, ShoppingCart,
  Truck, Building2, FileText, Calculator, UserCog, LogOut
} from 'lucide-react';
import './Layout.css';

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/catalog',    label: 'Catalog',     icon: BookOpen },
  { to: '/inventory',  label: 'Inventory',   icon: Package },
  { to: '/customers',  label: 'Customers',   icon: Users },
  { to: '/orders',     label: 'Orders',      icon: ShoppingCart },
  { to: '/purchases',  label: 'Purchases',   icon: Truck },
  { to: '/suppliers',  label: 'Suppliers',   icon: Building2 },
  { to: '/tenders',    label: 'Tenders',     icon: FileText },
  { to: '/accounting', label: 'Accounting',  icon: Calculator },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const initials = user?.username?.slice(0, 2) || 'U';

  return (
    <div className="layout">
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">ERP System</div>
          <div className="sidebar-brand-tagline">Business Management</div>
        </div>

        {/* Navigation */}
        <nav>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <Icon className="nav-icon" size={16} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/users"
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <UserCog className="nav-icon" size={16} strokeWidth={2} />
              Users
            </NavLink>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{user?.username}</div>
              <div className="sidebar-role">{user?.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            <LogOut size={13} strokeWidth={2.5} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
