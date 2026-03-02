import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Settings } from './pages/Settings';
import { Unauthorized } from './pages/Unauthorized';
import { AdminAssetsPage } from './pages/admin/AdminAssetsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLabsPage } from './pages/admin/AdminLabsPage';
import { AdminMaintenancePage } from './pages/admin/AdminMaintenancePage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { LabAssetsPage } from './pages/lab/LabAssetsPage';
import { LabDashboardPage } from './pages/lab/LabDashboardPage';
import { LabMaintenancePage } from './pages/lab/LabMaintenancePage';
import { ServiceDashboardPage } from './pages/service/ServiceDashboardPage';
import { ServiceTasksPage } from './pages/service/ServiceTasksPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="assets" element={<AdminAssetsPage />} />
            <Route path="labs" element={<AdminLabsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="maintenance" element={<AdminMaintenancePage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route
            path="/lab"
            element={
              <ProtectedRoute allowedRoles={['lab']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<LabDashboardPage />} />
            <Route path="assets" element={<LabAssetsPage />} />
            <Route path="maintenance" element={<LabMaintenancePage />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route
            path="/service"
            element={
              <ProtectedRoute allowedRoles={['service']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<ServiceDashboardPage />} />
            <Route path="tasks" element={<ServiceTasksPage />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
