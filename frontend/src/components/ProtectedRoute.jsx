import React from 'react';
import { Outlet } from 'react-router-dom';

export default function ProtectedRoute({ allowedRoles }) {
  // DEV BYPASS: Allow access to all protected routes without backend authentication
  return <Outlet />;
}