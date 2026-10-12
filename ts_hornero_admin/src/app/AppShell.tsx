import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Grid1, Buildings2, Box, People, Profile2User, Gift, SearchNormal1, Setting2, ClipboardTick, Refresh2, Activity } from 'iconsax-reactjs';
import { useAuthStore } from '../store/auth.store';
import type { UserRole } from '../store/auth.store';
import { AppErrorFallback } from './AppErrorFallback';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/Badge';
import { Text } from '../components/ui/Typography';
import { NoticeHost } from '../components/ui/NoticeHost';
import { roleHome } from '../lib/roleHome';
import { ROLE_LABELS } from '../lib/metricas';
import type { BadgeTone } from '../lib/domain-ui';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const ICON_SIZE = 19;

const NAV_LINKS: Record<UserRole, NavItem[]> = {
  ADMINISTRADOR: [
    { to: '/panel', label: 'Panel', icon: <Grid1 size={ICON_SIZE} /> },
    { to: '/admin', label: 'Admin', icon: <Buildings2 size={ICON_SIZE} /> },
    { to: '/users', label: 'Usuarios', icon: <People size={ICON_SIZE} /> },
    { to: '/referentes', label: 'Referentes', icon: <Profile2User size={ICON_SIZE} /> },
    { to: '/control-donaciones', label: 'Donaciones', icon: <Gift size={ICON_SIZE} /> },
    { to: '/auditoria', label: 'Auditoría', icon: <ClipboardTick size={ICON_SIZE} /> },
    { to: '/rondas', label: 'Rondas', icon: <Refresh2 size={ICON_SIZE} /> },
    { to: '/catalogo', label: 'Catálogo', icon: <Box size={ICON_SIZE} /> },
    { to: '/actividad', label: 'Actividad', icon: <Activity size={ICON_SIZE} /> },
  ],
  REFERENTE: [
    { to: '/dashboard', label: 'Dashboard', icon: <Grid1 size={ICON_SIZE} /> },
    { to: '/needs', label: 'Necesidades', icon: <Box size={ICON_SIZE} /> },
    { to: '/mis-organizaciones', label: 'Mis organizaciones', icon: <Buildings2 size={ICON_SIZE} /> },
    { to: '/prefs', label: 'Preferencias', icon: <Setting2 size={ICON_SIZE} /> },
  ],
  DONANTE: [
    { to: '/explorar', label: 'Explorar', icon: <SearchNormal1 size={ICON_SIZE} /> },
    { to: '/donar', label: 'Donar', icon: <Gift size={ICON_SIZE} /> },
    { to: '/mis-donaciones', label: 'Mis Donaciones', icon: <Gift size={ICON_SIZE} /> },
  ],
};

const ROLE_TONE: Record<UserRole, BadgeTone> = {
  ADMINISTRADOR: 'sky',
  REFERENTE: 'ok',
  DONANTE: 'neutral',
};

export default function AppShell() {
  const user = useAuthStore((s) => s.user);
  const tipo = user?.tipo ?? null;
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();

  const links: NavItem[] = tipo !== null ? NAV_LINKS[tipo] : [];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside
        style={{
          width: 248,
          height: '100%',
          background: 'var(--card)',
          borderRight: '1px solid var(--line)',
          padding: '22px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          flexShrink: 0,
          overflowY: 'auto',
        }}
      >
        <Link
          to={tipo !== null ? roleHome(tipo) : '/login'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            padding: '0 8px 22px',
          }}
        >
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span style={{ color: 'var(--horn)', fontWeight: 900, fontSize: 'var(--fs-title)', lineHeight: 1.1 }}>
            El Hornero
          </span>
        </Link>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {links.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '11px 12px',
                borderRadius: 11,
                textDecoration: 'none',
                background: isActive ? 'var(--horn)' : 'transparent',
              })}
            >
              {({ isActive }) => (
                <>
                  <span style={{ color: isActive ? '#fff' : 'var(--ink-3)', display: 'inline-flex' }}>{icon}</span>
                  <Text variant="body-sm" as="span" style={{ color: isActive ? '#fff' : 'var(--ink-2)' }}>{label}</Text>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {user && (
          <div
            style={{
              background: 'var(--card-2)',
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              gap: 11,
              alignItems: 'center',
            }}
          >
            <Avatar name={user.nombre} size={40} />
            <div style={{ lineHeight: 1.3, minWidth: 0, flex: 1 }}>
              <Text
                as="div"
                variant="label"
                color="earth"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {user.nombre}
              </Text>
              <Badge tone={ROLE_TONE[user.tipo]} label={ROLE_LABELS[user.tipo]} style={{ marginTop: 3 }} />
            </div>
          </div>
        )}

        <button
          onClick={() => { void logout(); }}
          style={{
            marginTop: 10,
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 8,
            color: 'var(--ink-2)',
            fontFamily: 'var(--font-app)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Cerrar sesión
        </button>
      </aside>

      <main style={{ flex: 1, padding: 24, overflowY: 'auto', minWidth: 0 }}>
        <ErrorBoundary FallbackComponent={AppErrorFallback} resetKeys={[location.pathname]}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <NoticeHost />
    </div>
  );
}
