import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import Home from "./pages/Home";
import Signin from "./pages/Signin";
import Signup from "./pages/Signup";
import UserLayout from "./components/UserLayout";

// Shared pages
import Profile from "./pages/Profile";
import Notifications from "./pages/user/Notifications";
import Requests from "./pages/Requests";
import Inventory from "./pages/Inventory";
import ReportsLogs from "./pages/ReportsLogs";
import ActivityLog from "./pages/ActivityLog";

// User pages
import UserDashboard from "./pages/user/UserDashboard";
import ItemRequest from "./pages/user/ItemRequest";
import RequestHistory from "./pages/user/RequestHistory";
import HelpSupport from "./pages/user/HelpSupport";

// Moderator pages
import ModeratorDashboard from "./pages/moderator/Dashboard";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUserManagement from "./pages/admin/UserManagement";
import AdminSystemSettings from "./pages/admin/SystemSettings";

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/"
        element={
          <PublicRoute>
            <Home />
          </PublicRoute>
        }
      />
      <Route
        path="/signin"
        element={
          <PublicRoute>
            <Signin />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />

      {/* User Shell Routes */}
      <Route
        path="/user"
        element={
          <ProtectedRoute roles={["Student", "Regular Staff"]}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<UserDashboard />} />
        <Route path="requests" element={<ItemRequest />} />
        <Route path="history" element={<RequestHistory />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="profile" element={<Profile />} />
        <Route path="help" element={<HelpSupport />} />
      </Route>

      {/* Moderator Shell Routes */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute roles={["Moderator"]}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ModeratorDashboard />} />
        <Route path="requests" element={<Requests />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="reports-logs" element={<ReportsLogs />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Admin Shell Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["Administrator", "Admin"]}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="requests" element={<Requests />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="users" element={<AdminUserManagement />} />
        <Route path="settings" element={<AdminSystemSettings />} />
        <Route path="reports-logs" element={<ReportsLogs />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}