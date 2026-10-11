import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import Home from './pages/Home';
import Signin from './pages/Signin';
import Signup from './pages/Signup';
import UserLayout from './components/UserLayout';

// Imports for User Pages
import UserDashboard from './pages/user/UserDashboard';
import ItemRequest from './pages/user/ItemRequest';
import RequestHistory from './pages/user/RequestHistory';
import Notifications from './pages/user/Notifications';
import Profile from './pages/Profile';
import HelpSupport from './pages/user/HelpSupport';

// Imports for Moderator Pages
import Dashboard from './pages/moderator/Dashboard';
import RequisitionManagement from './pages/moderator/RequisitionManagement';
import SupplyDepot from './pages/moderator/SupplyDepot';
import IssuanceReturns from './pages/moderator/IssuanceReturns';
import ModeratorNotifications from './pages/moderator/Notifications';
import TransactionHistory from './pages/moderator/TransactionHistory';
import StockReports from './pages/moderator/StockReports';
import UserManagement from './pages/moderator/UserManagement';
import ActivityAuditLogs from './pages/moderator/ActivityAuditLogs';

// Imports for Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminRequisitionManagement from './pages/admin/RequisitionManagement';
import AdminSupplyDepot from './pages/admin/SupplyDepot';
import AdminIssuanceReturns from './pages/admin/IssuanceReturns';
import AdminNotifications from './pages/admin/Notifications';
import AdminTransactionHistory from './pages/admin/TransactionHistory';
import AdminStockReports from './pages/admin/StockReports';
import AdminUserManagement from './pages/admin/UserManagement';
import AdminActivityAuditLogs from './pages/admin/ActivityAuditLogs';
import AdminProfile from './pages/Profile';

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
      <Route path="/signin" element={<PublicRoute><Signin /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

      {/* User Shell Routes */}
      <Route
        path="/user"
        element={
          <ProtectedRoute roles={['Student', 'Regular Staff']}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<UserDashboard />} />
        <Route path="requests" element={<ItemRequest />} />
        <Route path="history" element={<RequestHistory />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="help" element={<HelpSupport />} />
      </Route>

      {/* Moderator Shell Routes */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute roles={['Moderator']}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="requisitions" element={<RequisitionManagement />} />
        <Route path="supply-depot" element={<SupplyDepot />} />
        <Route path="issuance-returns" element={<IssuanceReturns />} />
        <Route path="notifications" element={<ModeratorNotifications />} />
        <Route path="history" element={<TransactionHistory />} />
        <Route path="reports" element={<StockReports />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="logs" element={<ActivityAuditLogs />} />
      </Route>

      {/* Admin Shell Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['Administrator', 'Admin']}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="requisitions" element={<AdminRequisitionManagement />} />
        <Route path="supply-depot" element={<AdminSupplyDepot />} />
        <Route path="issuance-returns" element={<AdminIssuanceReturns />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="history" element={<AdminTransactionHistory />} />
        <Route path="reports" element={<AdminStockReports />} />
        <Route path="users" element={<AdminUserManagement />} />
        <Route path="logs" element={<AdminActivityAuditLogs />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}