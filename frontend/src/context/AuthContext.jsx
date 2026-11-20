import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Default home route per user role
export const ROLE_HOME = {
  Student: '/user',
  'Regular Staff': '/user',
  Moderator: '/staff',
  Administrator: '/admin',
};
export const homeFor = (role) => ROLE_HOME[role] || '/';

const readSession = () => {
  try {
    const token = sessionStorage.getItem('token');
    const user = JSON.parse(sessionStorage.getItem('user'));
    return token && user ? user : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  const login = (token, userData) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
  };

  // Update user state and synchronize changes to sessionStorage
  const updateUser = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try {
        sessionStorage.setItem('user', JSON.stringify(next));
      } catch {
        // storage unavailable: keep the in-memory update
      }
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
