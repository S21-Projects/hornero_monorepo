import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
import AppShell from './AppShell';
import LoginPage from '../routes/login';
import RegisterPage from '../routes/register';
import DashboardPage from '../routes/dashboard';
import NeedsPage from '../routes/needs';
import PrefsPage from '../routes/prefs';
import MisDonacionesPage from '../routes/mis-donaciones';
import PanelPage from '../routes/panel';
import AdminPage from '../routes/admin';
import UsersPage from '../routes/users';
import PendingValidationPage from '../routes/pending-validation';

export const router = createBrowserRouter([
  // ── Public-only routes (redirect away when authenticated) ──────────────
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnlyRoute>
        <RegisterPage />
      </PublicOnlyRoute>
    ),
  },

  // ── Pending validation (accessible while awaiting org approval) ────────
  {
    path: '/pending-validation',
    element: <PendingValidationPage />,
  },

  // ── ADMIN-only routes ─────────────────────────────────────────────────
  {
    element: <ProtectedRoute allow={['ADMINISTRADOR']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/panel', element: <PanelPage /> },
          { path: '/admin', element: <AdminPage /> },
          { path: '/users', element: <UsersPage /> },
        ],
      },
    ],
  },

  // ── REFERENTE dashboard (REFERENTE only; both validated and pending) ──
  {
    element: <ProtectedRoute allow={['REFERENTE']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
        ],
      },
    ],
  },

  // ── /needs — ADMIN + validated REFERENTE ─────────────────────────────
  // requireValidated: unvalidated REFERENTE → /pending-validation
  {
    element: <ProtectedRoute allow={['ADMINISTRADOR', 'REFERENTE']} requireValidated />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/needs', element: <NeedsPage /> },
        ],
      },
    ],
  },

  // ── /prefs — any authenticated user (mirrors proxy.ts PROXY-06) ──────
  {
    element: <ProtectedRoute allow={['ADMINISTRADOR', 'REFERENTE', 'DONANTE']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/prefs', element: <PrefsPage /> },
        ],
      },
    ],
  },

  // ── DONANTE-only routes ───────────────────────────────────────────────
  {
    element: <ProtectedRoute allow={['DONANTE']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/mis-donaciones', element: <MisDonacionesPage /> },
        ],
      },
    ],
  },

  // ── Root redirect ─────────────────────────────────────────────────────
  { path: '/', element: <Navigate to="/login" replace /> },
]);
