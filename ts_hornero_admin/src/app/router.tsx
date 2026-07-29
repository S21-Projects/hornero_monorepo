import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
import { RootRedirect } from './RootRedirect';
import { NotFound } from './NotFound';
import AppShell from './AppShell';
import LoginPage from '../routes/login';
import RegisterPage from '../routes/register';
import DashboardPage from '../routes/dashboard';
import NeedsPage from '../routes/needs';
import PrefsPage from '../routes/prefs';
import MisDonacionesPage from '../routes/mis-donaciones';
import ExplorarPage from '../routes/explorar';
import NecesidadDetallePage from '../routes/necesidad-detalle';
import PanelPage from '../routes/panel';
import AdminPage from '../routes/admin';
import UsersPage from '../routes/users';
import ReferentesPage from '../routes/referentes';
import PendingValidationPage from '../routes/pending-validation';
import MisOrganizacionesPage from '../routes/mis-organizaciones';

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

  // ── Pending validation (REFERENTE only; both validated and pending) ────
  {
    element: <ProtectedRoute allow={['REFERENTE']} />,
    children: [
      { path: '/pending-validation', element: <PendingValidationPage /> },
    ],
  },

  // ── /mis-organizaciones — REFERENTE only, no org validation required.
  // Self-service org list + "add organization" (capped at 3). Also the
  // resumable entry point linked from /pending-validation when orgCount===0.
  {
    element: <ProtectedRoute allow={['REFERENTE']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/mis-organizaciones', element: <MisOrganizacionesPage /> },
        ],
      },
    ],
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
          { path: '/referentes', element: <ReferentesPage /> },
        ],
      },
    ],
  },

  // ── REFERENTE dashboard (REFERENTE only; VALIDATED org required) ───────
  // requireValidated: unvalidated REFERENTE → /pending-validation
  {
    element: <ProtectedRoute allow={['REFERENTE']} requireValidated />,
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
          { path: '/mis-donaciones',    element: <MisDonacionesPage /> },
          { path: '/explorar',          element: <ExplorarPage /> },
          { path: '/necesidades/:id',   element: <NecesidadDetallePage /> },
        ],
      },
    ],
  },

  // ── Root redirect ─────────────────────────────────────────────────────
  // Role-aware: was `<Navigate to="/login" replace />` unconditionally, which
  // was the hub of the ADMIN/DONANTE redirect loop (see roleHome.ts, RootRedirect.tsx).
  { path: '/', element: <RootRedirect /> },

  // ── Catch-all 404 ────────────────────────────────────────────────────
  // Must stay last — react-router matches routes in declaration order and
  // '*' would otherwise shadow every route above it.
  { path: '*', element: <NotFound /> },
]);
