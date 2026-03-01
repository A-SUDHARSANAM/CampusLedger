import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="assets" element={<div className="p-8">Assets Management Placeholder</div>} />
            <Route path="assets/new" element={<div className="p-8">Add Asset Placeholder</div>} />
            <Route path="procurement" element={<div className="p-8">Procurement Placeholder</div>} />
            <Route path="maintenance" element={<div className="p-8">Maintenance Placeholder</div>} />
            <Route path="locations" element={<div className="p-8">Locations Placeholder</div>} />
            <Route path="reports" element={<div className="p-8">Reports Placeholder</div>} />
            <Route path="users" element={<div className="p-8">Users & Roles Placeholder</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
