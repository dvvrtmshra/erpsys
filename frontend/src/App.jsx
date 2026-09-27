import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import OrderForm from './pages/OrderForm';
import Purchases from './pages/Purchases';
import Suppliers from './pages/Suppliers';
import Tenders from './pages/Tenders';
import TenderForm from './pages/TenderForm';
import Accounting from './pages/Accounting';
import Users from './pages/Users';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/new" element={<OrderForm />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="tenders" element={<Tenders />} />
            <Route path="tenders/new" element={<TenderForm />} />
            <Route path="tenders/:id/edit" element={<TenderForm />} />
            <Route path="accounting" element={<Accounting />} />
            <Route path="users" element={<Users />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
