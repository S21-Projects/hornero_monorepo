'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Notification } from 'iconsax-reactjs';
import { Logo } from './logo';
import { Avatar } from './avatar';
import { Button } from './button';
import { Text } from './typography';
import { useAuthStore } from '@/store/auth.store';
import { ROLE_LABELS } from '@/lib/roles';

type NavItem = { label: string; href: string };

const BASE_NAV_ITEMS: NavItem[] = [
  { label: 'Mapa',          href: '/' },
  { label: 'Organizaciones', href: '/organizaciones' },
  { label: 'Donaciones',    href: '/donaciones' },
];

interface TopBarProps {
  active?: string;
}

export function TopBar({ active = 'Mapa' }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  // Close drawer on outside mousedown
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Body scroll lock while drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const navItems: NavItem[] = [
    ...BASE_NAV_ITEMS,
    ...(isAuthenticated && user?.tipo === 'REFERENTE'
      ? [{ label: 'Necesidades', href: '/needs' }]
      : []),
    ...(isAuthenticated && user?.tipo === 'DONANTE'
      ? [{ label: 'Mis donaciones', href: '/mis-donaciones' }]
      : []),
    ...(isAuthenticated
      ? [{ label: 'Preferencias', href: '/prefs' }]
      : []),
    ...(isAuthenticated && user?.tipo === 'ADMINISTRADOR'
      ? [{ label: 'Admin', href: '/admin' }]
      : []),
  ];

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <>
      <header
        className="flex items-center gap-7 px-7 flex-shrink-0 relative z-[5]"
        style={{
          height: 70,
          background: 'var(--card)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        {/* Hamburger — mobile only, LEFT */}
        <button
          className="md:hidden flex-shrink-0"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
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
          {open ? '✕' : '☰'}
        </button>

        {/* Logo — centered on mobile, left on desktop */}
        <div className="mx-auto md:mx-0">
          <Logo />
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-1 ml-3">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                position: 'relative',
                padding: '10px 14px',
                borderRadius: 10,
                textDecoration: 'none',
                background: item.label === active ? '#F6E0CF' : 'transparent',
              }}
            >
              <Text
                variant="body-sm"
                as="span"
                color={item.label === active ? 'horn' : 'ink-2'}
              >
                {item.label}
              </Text>
            </Link>
          ))}
        </nav>

        {/* Spacer — desktop only */}
        <div className="hidden md:block flex-1" />

        {/* TODO: uncomment when we add notifications */}
        {/* <Button variant="secondary" size="sm" style={{ gap: 7 }}>
          <Notification size={17} color="var(--ink-2)" />
        </Button> */}

        {isAuthenticated && user ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 6,
            }}
          >
            <div
              onClick={() => router.push(user.tipo === 'ADMINISTRADOR' ? '/admin' : '/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }}
            >
              <Avatar name={user.nombre} size={38} tintIndex={0} />
              <div className="hidden md:block" style={{ lineHeight: 1.25 }}>
                <Text as="div" variant="label" color="earth">
                  {user.nombre}
                </Text>
                <Text as="div" variant="micro" color="ink-3">
                  {ROLE_LABELS[user.tipo] ?? user.tipo}
                </Text>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="hidden md:inline-flex"
              style={{ marginLeft: 4 }}
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

      {/* Mobile drawer */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setOpen(false)}
            style={{ background: 'rgba(0,0,0,0.45)' }}
          />
          {/* Panel */}
          <aside
            ref={drawerRef}
            className="fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col md:hidden"
            style={{
              background: 'var(--card)',
              boxShadow: '4px 0 24px rgba(0,0,0,0.13)',
              padding: '24px 16px',
            }}
          >
            <div style={{ marginBottom: 24 }}>
              <Logo />
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    background: item.label === active ? '#F6E0CF' : 'transparent',
                  }}
                >
                  <Text
                    variant="title"
                    as="span"
                    color={item.label === active ? 'horn' : 'ink-2'}
                  >
                    {item.label}
                  </Text>
                </Link>
              ))}
            </nav>
            {isAuthenticated && (
              <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  style={{ width: '100%' }}
                >
                  Salir
                </Button>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
