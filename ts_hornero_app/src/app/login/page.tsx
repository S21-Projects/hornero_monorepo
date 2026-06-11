'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/');
    } catch {
      setError('Credenciales inválidas');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--adobe)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <Logo size={42} />
      </div>

      <Card style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: 'var(--earth)',
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          Ingresá a tu cuenta
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@ejemplo.com"
            required
            autoComplete="email"
          />

          <Input
            id="password"
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          {error && (
            <div
              style={{
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13.5,
                fontWeight: 700,
                color: '#DC2626',
              }}
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            block
            disabled={submitting}
            style={{ marginTop: 8 }}
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
