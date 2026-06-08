'use client';

import {
  Grid1, Buildings2, Box, People,
  Layer, Setting2,
} from 'iconsax-reactjs';
import { Logo } from './logo';
import { Avatar } from './avatar';
import { Pill } from './pill';
import { useAuthStore } from '@/store/auth.store';
import { ROLE_LABELS } from '@/lib/roles';

type NavItem = { label: string; icon: React.ReactNode };

const NAV_ITEMS: NavItem[] = [
  { label: 'Panel',          icon: <Grid1 size={19} /> },
  { label: 'Organizaciones', icon: <Buildings2 size={19} /> },
  { label: 'Necesidades',    icon: <Box size={19} /> },
  { label: 'Usuarios',       icon: <People size={19} /> },
  { label: 'Analíticas',     icon: <Layer size={19} /> },
  { label: 'Ajustes',        icon: <Setting2 size={19} /> },
];

interface AdminShellProps {
  active?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  role?: string;
  name?: string;
  tint?: number;
  children: React.ReactNode;
}

export function AdminShell({
  active = 'Organizaciones',
  title,
  subtitle,
  actions,
  role,
  name,
  tint = 2,
  children,
}: AdminShellProps) {
  const user = useAuthStore((s) => s.user);

  const displayName = name ?? user?.nombre ?? 'Usuario';
  const displayRole = role ?? (user?.tipo ? ROLE_LABELS[user.tipo] ?? user.tipo : 'Administrador');

  const rolePillVariant =
    displayRole === 'Super Admin' ? 'role-super'
    : displayRole === 'Validador' ? 'role-val'
    : displayRole === 'Admin. Organización' ? 'role-org'
    : 'role-donor';

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: 'var(--adobe)',
      }}
    >
      {/* sidebar */}
      <aside
        style={{
          width: 248,
          flexShrink: 0,
          background: 'var(--card)',
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 16px',
        }}
      >
        <div style={{ padding: '0 8px 22px' }}>
          <Logo />
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.label === active;
            return (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '11px 12px',
                  borderRadius: 11,
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 14.5,
                  color: isActive ? '#fff' : 'var(--ink-2)',
                  background: isActive ? 'var(--horn)' : 'transparent',
                }}
              >
                <span style={{ color: isActive ? '#fff' : 'var(--ink-3)' }}>
                  {item.icon}
                </span>
                {item.label}
              </div>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

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
          <Avatar name={displayName} size={40} tintIndex={tint} />
          <div style={{ lineHeight: 1.3, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 13.5,
                color: 'var(--earth)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </div>
            <Pill variant={rolePillVariant} style={{ fontSize: 11, padding: '4px 9px', marginTop: 3 }}>
              {displayRole}
            </Pill>
          </div>
        </div>
      </aside>

      {/* main */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <header
          style={{
            padding: '24px 32px 20px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 20,
            borderBottom: '1px solid var(--line)',
            background: 'var(--card)',
          }}
        >
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900 }}>{title}</h1>
            {subtitle && (
              <p
                style={{
                  color: 'var(--ink-2)',
                  fontSize: 14.5,
                  marginTop: 5,
                  fontWeight: 600,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
