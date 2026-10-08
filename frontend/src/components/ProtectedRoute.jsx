import { Navigate } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';

// Replaces requireAuth() from your old auth.js
export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/signin" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return children;
}
