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
import { AdminProcurementPage } from './pages/admin/AdminProcurementPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { LabAssetsPage } from './pages/lab/LabAssetsPage';
import { LabDashboardPage } from './pages/lab/LabDashboardPage';
import { LabMaintenancePage } from './pages/lab/LabMaintenancePage';
import { LabProcurementPage } from './pages/lab/LabProcurementPage';
import { ServiceDashboardPage } from './pages/service/ServiceDashboardPage';
import { ServiceTasksPage } from './pages/service/ServiceTasksPage';
import { PurchaseDashboardPage } from './pages/purchase/PurchaseDashboardPage';
import { PurchaseSmartProcurementPage } from './pages/purchase/PurchaseSmartProcurementPage';
import { AdminInventoryIntelligencePage } from './pages/admin/AdminInventoryIntelligencePage';
import { AdminDigitalTwinPage } from './pages/admin/AdminDigitalTwinPage';
import { AdminDeviceMonitoringPage } from './pages/admin/AdminDeviceMonitoringPage';
import { BlockchainAuditPage } from './pages/admin/BlockchainAuditPage';
import AssetTrackingPage from './pages/admin/AssetTrackingPage';
import PublicAssetPage from './pages/PublicAssetPage';
import { LabDigitalTwinPage } from './pages/lab/LabDigitalTwinPage';
import { LabDeviceMonitoringPage } from './pages/lab/LabDeviceMonitoringPage';
import { LanguageProvider } from './context/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/public/asset/:id" element={<PublicAssetPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout /></ProtectedRoute>}>
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="assets" element={<AdminAssetsPage />} />
              <Route path="procurement" element={<AdminProcurementPage />} />
              <Route path="labs" element={<AdminLabsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="maintenance" element={<AdminMaintenancePage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="inventory-intelligence" element={<AdminInventoryIntelligencePage />} />
              <Route path="digital-twin" element={<AdminDigitalTwinPage />} />
              <Route path="device-monitoring" element={<AdminDeviceMonitoringPage />} />
              <Route path="blockchain" element={<BlockchainAuditPage />} />
              <Route path="asset-tracking" element={<AssetTrackingPage />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="/lab" element={<ProtectedRoute allowedRoles={['lab']}><DashboardLayout /></ProtectedRoute>}>
              <Route path="dashboard" element={<LabDashboardPage />} />
              <Route path="assets" element={<LabAssetsPage />} />
              <Route path="procurement" element={<LabProcurementPage />} />
              <Route path="maintenance" element={<LabMaintenancePage />} />
              <Route path="digital-twin" element={<LabDigitalTwinPage />} />
              <Route path="device-monitoring" element={<LabDeviceMonitoringPage />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="/service" element={<ProtectedRoute allowedRoles={['service']}><DashboardLayout /></ProtectedRoute>}>
              <Route path="dashboard" element={<ServiceDashboardPage />} />
              <Route path="tasks" element={<ServiceTasksPage />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="/purchase" element={<ProtectedRoute allowedRoles={['purchase_dept']}><DashboardLayout /></ProtectedRoute>}>
              <Route path="dashboard" element={<PurchaseDashboardPage />} />
              <Route path="smart-procurement" element={<PurchaseSmartProcurementPage />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
