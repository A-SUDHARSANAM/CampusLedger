import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { Role } from '../../types/auth';

type ProtectedRouteProps = {
  allowedRoles?: Role[];
  children?: React.ReactNode;
};

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { isAuthenticated, role, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return null;
  }

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
}
