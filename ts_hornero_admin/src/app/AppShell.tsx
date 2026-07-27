import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { useAuthStore } from '../store/auth.store';
import type { UserRole } from '../store/auth.store';
import { AppErrorFallback } from './AppErrorFallback';

interface NavItem {
  to: string;
  label: string;
}

const NAV_LINKS: Record<UserRole, NavItem[]> = {
  ADMINISTRADOR: [
    { to: '/panel', label: 'Panel' },
    { to: '/admin', label: 'Admin' },
    { to: '/users', label: 'Usuarios' },
  ],
  REFERENTE: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/needs', label: 'Necesidades' },
    { to: '/prefs', label: 'Preferencias' },
  ],
  DONANTE: [
    { to: '/explorar',       label: 'Explorar' },
    { to: '/mis-donaciones', label: 'Mis Donaciones' },
  ],
};

export default function AppShell() {
  const tipo = useAuthStore((s) => s.user?.tipo ?? null);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();

  const links: NavItem[] = tipo !== null ? NAV_LINKS[tipo] : [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav
        style={{
          width: 220,
          background: 'var(--earth)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              color: isActive ? 'var(--adobe)' : 'var(--parchment, #f5f0e8)',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: 8,
              fontFamily: 'var(--font-app)',
              fontWeight: 600,
              background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
            })}
          >
            {label}
          </NavLink>
        ))}

        <button
          onClick={() => { void logout(); }}
          style={{
            marginTop: 'auto',
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8,
            color: 'var(--parchment, #f5f0e8)',
            fontFamily: 'var(--font-app)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Cerrar sesión
        </button>
      </nav>

      <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        <ErrorBoundary FallbackComponent={AppErrorFallback} resetKeys={[location.pathname]}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
