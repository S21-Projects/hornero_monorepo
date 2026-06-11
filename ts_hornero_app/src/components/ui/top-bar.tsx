'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Notification } from 'iconsax-reactjs';
import { Logo } from './logo';
import { Avatar } from './avatar';
import { Button } from './button';
import { useAuthStore } from '@/store/auth.store';
import { ROLE_LABELS } from '@/lib/roles';

type NavItem = { label: string; href: string };

const BASE_NAV_ITEMS: NavItem[] = [
  { label: 'Mapa',       href: '/' },
  { label: 'Donaciones', href: '/donaciones' },
];

interface TopBarProps {
  active?: string;
}

export function TopBar({ active = 'Mapa' }: TopBarProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const navItems: NavItem[] = [
    ...BASE_NAV_ITEMS,
    ...(isAuthenticated && user?.tipo === 'REFERENTE'
      ? [{ label: 'Necesidades', href: '/needs' }]
      : []),
    ...(isAuthenticated
      ? [{ label: 'Preferencias', href: '/prefs' }]
      : []),
  ];

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <header
      style={{
        height: 70,
        background: 'var(--card)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: '0 28px',
        flexShrink: 0,
        position: 'relative',
        zIndex: 5,
      }}
    >
      <Logo />
      <nav style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            style={{
              position: 'relative',
              padding: '10px 14px',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 14.5,
              textDecoration: 'none',
              color: item.label === active ? 'var(--horn)' : 'var(--ink-2)',
              background: item.label === active ? '#F6E0CF' : 'transparent',
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <Button variant="secondary" size="sm" style={{ gap: 7 }}>
        <Notification size={17} color="var(--ink-2)" />
      </Button>

      {isAuthenticated && user ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingLeft: 6,
          }}
        >
          <Avatar name={user.nombre} size={38} tintIndex={0} />
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--earth)' }}>
              {user.nombre}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>
              {ROLE_LABELS[user.tipo] ?? user.tipo}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            style={{ marginLeft: 4, fontSize: 12 }}
          >
            Salir
          </Button>
        </div>
      ) : (
        <Button variant="primary" size="sm" onClick={() => router.push('/login')}>
          Iniciar sesión
        </Button>
      )}
    </header>
  );
}
