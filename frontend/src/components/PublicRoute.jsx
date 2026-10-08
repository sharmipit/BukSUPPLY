import { Navigate } from 'react-router-dom';
import { useAuth, ROLE_HOME, homeFor } from '../context/AuthContext';

// Replaces redirectIfLoggedIn() from your old auth.js
export default function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user && ROLE_HOME[user.role]) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return children;
}
