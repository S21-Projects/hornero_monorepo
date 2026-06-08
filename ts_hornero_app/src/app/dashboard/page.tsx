'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useMyOrgQuery } from '@/hooks/useMyOrgQuery';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const { data: myOrg } = useMyOrgQuery();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--adobe)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>Cargando…</span>
      </div>
    );
  }

  const isPending = !myOrg || myOrg.validada === false;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--adobe)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}
    >
      {isPending ? (
        /* ── Pending state ───────────────────────────────────────────────── */
        <Card style={{ width: '100%', maxWidth: 520, padding: 40, textAlign: 'center' }}>
          {/* Illustration */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: '#FEF3C7',
              border: '2px dashed #F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <svg
              width={38}
              height={38}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </div>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: 'var(--earth)',
              marginBottom: 12,
            }}
          >
            Tu organización está en revisión
          </h1>

          <p
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: 'var(--ink-2)',
              lineHeight: 1.6,
              maxWidth: 360,
              margin: '0 auto 28px',
            }}
          >
            Recibimos tu postulación. Un administrador la revisará pronto. Te
            avisaremos cuando esté aprobada.
          </p>

          {/* Disabled donation-request placeholder */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button
              variant="primary"
              block
              disabled
              style={{ opacity: 0.4, cursor: 'not-allowed' }}
            >
              Publicar necesidad (disponible al ser aprobado)
            </Button>

            <Button
              variant="secondary"
              block
              disabled
              style={{ opacity: 0.4, cursor: 'not-allowed' }}
            >
              Gestionar organización (disponible al ser aprobado)
            </Button>
          </div>

          {myOrg === null && (
            <p
              style={{
                marginTop: 20,
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--ink-3)',
              }}
            >
              Si tu organización no aparece, intentá cerrar sesión y volver a
              ingresar, o{' '}
              <a
                href="/register?step=org"
                style={{ color: 'var(--sky)', fontWeight: 800, textDecoration: 'none' }}
              >
                completar el registro
              </a>
              .
            </p>
          )}
        </Card>
      ) : (
        /* ── Validated referente dashboard ───────────────────────────────── */
        <Card style={{ width: '100%', maxWidth: 560, padding: 40 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: 'var(--earth)',
              marginBottom: 8,
            }}
          >
            Bienvenido, {user.nombre}
          </h1>
          <p
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: 'var(--ink-2)',
              marginBottom: 28,
            }}
          >
            Tu organización está activa y aprobada.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Button variant="primary" block>
              Publicar necesidad
            </Button>
            <Button variant="secondary" block>
              Gestionar organización
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
