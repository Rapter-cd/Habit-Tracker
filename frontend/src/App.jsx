import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';
import ProtectedRoute from './router/ProtectedRoute';
import Sidebar from './components/Sidebar';

// Pages
import Landing     from './pages/Landing';
import Login       from './pages/Login';
import Register    from './pages/Register';
import Dashboard   from './pages/Dashboard';
import HabitDetail from './pages/HabitDetail';
import Analytics   from './pages/Analytics';
import Groups      from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import Settings    from './pages/Settings';

/**
 * App shell — applies sidebar + main content area for authenticated routes.
 */
function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-60">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  // Rehydrate auth from stored JWT on every page load
  useEffect(() => { bootstrap(); }, [bootstrap]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes — all wrapped in AppShell (sidebar layout) */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/habits/:id"       element={<HabitDetail />} />
          <Route path="/analytics"        element={<Analytics />} />
          <Route path="/groups"           element={<Groups />} />
          <Route path="/groups/:id"       element={<GroupDetail />} />
          <Route path="/settings"         element={<Settings />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
