'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Grid1, Buildings2, Box, People,
  Layer, Setting2,
} from 'iconsax-reactjs';
import { Logo } from './logo';
import { Avatar } from './avatar';
import { Pill } from './pill';
import { Text } from './typography';
import { useAuthStore } from '@/store/auth.store';
import { ROLE_LABELS } from '@/lib/roles';

type NavItem = { label: string; icon: React.ReactNode };

const ROUTE_MAP: Record<string, string | null> = {
  Organizaciones: '/admin',
  Usuarios: '/users',
  Panel: '/panel',
  Necesidades: null,
  'Analíticas': null,
  Ajustes: null,
};

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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  // Close sidebar on outside mousedown
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (open && asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const displayName = name ?? user?.nombre ?? 'Usuario';
  const displayRole = role ?? (user?.tipo ? ROLE_LABELS[user.tipo] ?? user.tipo : 'Administrador');

  const rolePillVariant =
    displayRole === 'Super Admin' ? 'role-super'
    : displayRole === 'Validador' ? 'role-val'
    : displayRole === 'Admin. Organización' ? 'role-org'
    : 'role-donor';

  const sidebarContent = (
    <>
      <div style={{ padding: '0 8px 22px' }}>
        <Logo />
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.label === active;
          const route = ROUTE_MAP[item.label] ?? null;
          const itemStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '11px 12px',
            borderRadius: 11,
            cursor: route ? 'pointer' : 'not-allowed',
            background: isActive ? 'var(--horn)' : 'transparent',
            textDecoration: 'none',
            ...(route ? {} : { opacity: 0.4, pointerEvents: 'none' as React.CSSProperties['pointerEvents'] }),
          };
          const iconEl = (
            <span style={{ color: isActive ? '#fff' : 'var(--ink-3)' }}>
              {item.icon}
            </span>
          );
          return route && !isActive ? (
            <Link key={item.label} href={route} style={itemStyle} onClick={() => setOpen(false)}>
              {iconEl}
              <Text variant="body-sm" as="span" style={{ color: isActive ? '#fff' : 'var(--ink-2)' }}>{item.label}</Text>
            </Link>
          ) : (
            <div key={item.label} style={itemStyle}>
              {iconEl}
              <Text variant="body-sm" as="span" style={{ color: isActive ? '#fff' : 'var(--ink-2)' }}>{item.label}</Text>
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
          <Text
            as="div"
            variant="label"
            color="earth"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </Text>
          <Pill variant={rolePillVariant} style={{ fontSize: 11, padding: '4px 9px', marginTop: 3 }}>
            {displayRole}
          </Pill>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="flex w-full"
      style={{ height: '100%', background: 'var(--adobe)' }}
    >
      {/* Backdrop — mobile only, shown when sidebar open */}
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setOpen(false)}
          style={{ background: 'rgba(0,0,0,0.45)' }}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={asideRef}
        className={`${
          open
            ? 'fixed inset-y-0 left-0 z-50 w-[248px] flex flex-col'
            : 'hidden md:flex md:flex-col md:w-[248px] md:flex-shrink-0'
        } px-4 py-[22px]`}
        style={{
          background: 'var(--card)',
          borderRight: '1px solid var(--line)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile sticky header */}
        <div
          className="sticky top-0 z-30 flex md:hidden items-center px-4 py-3"
          style={{
            background: 'var(--card)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 22,
              color: 'var(--ink-2)',
              lineHeight: 1,
              padding: '4px 6px',
              borderRadius: 8,
            }}
          >
            ☰
          </button>
          <Text as="span" variant="title" color="earth" style={{ marginLeft: 12 }}>
            {title}
          </Text>
        </div>

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
            <Text variant="h1">{title}</Text>
            {subtitle && (
              <Text variant="body-sm" color="ink-2" style={{ marginTop: 5 }}>
                {subtitle}
              </Text>
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
