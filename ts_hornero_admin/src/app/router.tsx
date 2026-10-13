import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
import { RootRedirect } from './RootRedirect';
import { NotFound } from './NotFound';
import AppShell from './AppShell';
import LoginPage from '../routes/login';
import RegisterPage from '../routes/register';
import OlvideContrasenaPage from '../routes/olvide-contrasena';
import RestablecerPage from '../routes/restablecer';
import DashboardPage from '../routes/dashboard';
import NeedsPage from '../routes/needs';
import PrefsPage from '../routes/prefs';
import MisDonacionesPage from '../routes/mis-donaciones';
import DonacionDetallePage from '../routes/donacion-detalle';
import NuevaDonacionPage from '../routes/nueva-donacion';
import ExplorarPage from '../routes/explorar';
import NecesidadDetallePage from '../routes/necesidad-detalle';
import PanelPage from '../routes/panel';
import AdminPage from '../routes/admin';
import UsersPage from '../routes/users';
import ReferentesPage from '../routes/referentes';
import ActividadPage from '../routes/actividad';
import ControlDonacionesPage from '../routes/control-donaciones';
import PendingValidationPage from '../routes/pending-validation';
import MisOrganizacionesPage from '../routes/mis-organizaciones';
import VerifyEmailPage from '../routes/verify-email';
import AcreditacionPage from '../routes/acreditacion';
import LegajoPage from '../routes/legajo';
import EntregaPage from '../routes/entrega';
import AuditoriaPage from '../routes/auditoria';
import RondasPage from '../routes/rondas';
import CatalogoPage from '../routes/catalogo';
import ReclamarPage from '../routes/reclamar';
import ReclamosPage from '../routes/reclamos';
import ReportarPage from '../routes/reportar';

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
  {
    path: '/olvide-contrasena',
    element: (
      <PublicOnlyRoute>
        <OlvideContrasenaPage />
      </PublicOnlyRoute>
    ),
  },
  // Not guarded: the emailed link must work even if this browser still holds a session
  // (PublicOnlyRoute would redirect home and lose the token). The reset revokes all sessions.
  { path: '/restablecer', element: <RestablecerPage /> },

  // ── /verify-email — any authenticated role, no gates of its own ────────
  // First of the two independent, sequential gates. requireValidated routes
  // below carry requireVerified so an unverified+unvalidated referente lands
  // here first, not on /pending-validation.
  {
    element: <ProtectedRoute allow={['ADMINISTRADOR', 'REFERENTE', 'DONANTE']} />,
    children: [
      { path: '/verify-email', element: <VerifyEmailPage /> },
    ],
  },

  // ── Pending validation (REFERENTE only; both validated and pending) ────
  {
    element: <ProtectedRoute allow={['REFERENTE']} requireVerified />,
    children: [
      { path: '/pending-validation', element: <PendingValidationPage /> },
    ],
  },

  // ── /mis-organizaciones — REFERENTE only, no org validation required.
  // Self-service org list + "add organization" (capped at 3). Also the
  // resumable entry point linked from /pending-validation when orgCount===0.
  {
    element: <ProtectedRoute allow={['REFERENTE']} requireVerified />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/mis-organizaciones', element: <MisOrganizacionesPage /> },
          // Evidence self-submission (organizacion-evidencia spec). No
          // requireValidated: a referente needs this route precisely while
          // their org is still below N1 — gating it on validation would make
          // self-service accreditation impossible to reach.
          { path: '/acreditacion', element: <AcreditacionPage /> },
          // Claim form for an unclaimed (ReNaCoM) comedor, linked from the public site. An
          // anonymous visitor is bounced to /login and returned here afterwards (safeRedirectPath).
          { path: '/reclamar/:slug', element: <ReclamarPage /> },
        ],
      },
    ],
  },

  // ── ADMIN-only routes ─────────────────────────────────────────────────
  {
    element: <ProtectedRoute allow={['ADMINISTRADOR']} requireVerified />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/panel', element: <PanelPage /> },
          { path: '/admin', element: <AdminPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/referentes', element: <ReferentesPage /> },
          { path: '/control-donaciones', element: <ControlDonacionesPage /> },
          { path: '/auditoria', element: <AuditoriaPage /> },
          { path: '/rondas', element: <RondasPage /> },
          { path: '/reclamos', element: <ReclamosPage /> },
          { path: '/actividad', element: <ActividadPage /> },
          { path: '/catalogo', element: <CatalogoPage /> },
        ],
      },
    ],
  },

  // ── /reportar/:slug — any verified role ────────────────────────────────
  // Report form for an unclaimed (ReNaCoM) comedor, linked from the public site. Anyone with an
  // account may report; an anonymous visitor is bounced to /login and returned here (safeRedirectPath).
  {
    element: <ProtectedRoute allow={['ADMINISTRADOR', 'REFERENTE', 'DONANTE']} requireVerified />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/reportar/:slug', element: <ReportarPage /> },
        ],
      },
    ],
  },

  // ── Legajo (printable dossier) — ADMINISTRADOR or the owning REFERENTE ──
  // Amendment D-01 (decisiones-posteriores.md) overrides design.md's
  // admin-only restriction: the legajo exists so an organizacion can present
  // its own evidence to a third party, so the owning referente must reach it
  // too. Ownership for a non-admin caller is enforced server-side (MS +
  // BFF); this gate only keeps out roles that can never own an org.
  {
    element: <ProtectedRoute allow={['ADMINISTRADOR', 'REFERENTE']} requireVerified />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/organizaciones/:id/legajo', element: <LegajoPage /> },
        ],
      },
    ],
  },

  // ── Delivery confirmation screen (DONANTE + REFERENTE) ─────────────────
  // Spec `donacion-entrega-codigo`'s "Mobile Delivery Confirmation Screen" — reachable by both
  // parties of a donación in an active delivery state. Not gated by requireValidated: a REFERENTE
  // reaches this screen for donations already accepted regardless of the org's later validation
  // state, mirroring /organizaciones/:id/legajo's own requireVerified-only gate.
  {
    element: <ProtectedRoute allow={['DONANTE', 'REFERENTE']} requireVerified />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/donaciones/:id/entrega', element: <EntregaPage /> },
        ],
      },
    ],
  },

  // ── REFERENTE dashboard (REFERENTE only; VALIDATED org required) ───────
  // requireValidated: unvalidated REFERENTE → /pending-validation
  {
    element: <ProtectedRoute allow={['REFERENTE']} requireVerified requireValidated />,
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
    element: <ProtectedRoute allow={['ADMINISTRADOR', 'REFERENTE']} requireVerified requireValidated />,
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
  // NOTE: intentionally NOT gated by requireVerified — the Donante-facing
  // "must verify" UX (spec's open item, Group G5) is out of scope for this
  // batch and awaits explicit user sign-off; gating a shared route here
  // would force that experience on Donante prematurely.
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
  // NOTE: intentionally NOT gated by requireVerified — see G5 note above.
  // MS-side enforcement (403 EMAIL_NO_VERIFICADO on POST /donaciones) is
  // already live regardless of this SPA route gate.
  {
    element: <ProtectedRoute allow={['DONANTE']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/mis-donaciones',    element: <MisDonacionesPage /> },
          { path: '/mis-donaciones/:id', element: <DonacionDetallePage /> },
          { path: '/donar',             element: <NuevaDonacionPage /> },
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
