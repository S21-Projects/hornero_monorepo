import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { useAuthStore } from '../store/auth.store';
import { roleHome } from '../lib/roleHome';

export default function LoginPage() {
  const navigate = useNavigate();
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
      // Read fresh store state after login completes (role comes from /auth/me, not cookies).
      // roleHome() is the single source of truth for a role's landing route — an unvalidated
      // REFERENTE sent to /dashboard is then correctly bounced to /pending-validation by the
      // route guard (ProtectedRoute requireValidated), not decided here.
      const tipo = useAuthStore.getState().user?.tipo;
      if (tipo) navigate(roleHome(tipo), { replace: true });
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
        <Text
          variant="h2"
          as="h1"
          color="earth"
          style={{ marginBottom: 24, textAlign: 'center' }}
        >
          Ingresá a tu cuenta
        </Text>

        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
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
            showToggle
          />

          {error && (
            <div
              style={{
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: 10,
                padding: '10px 14px',
              }}
            >
              <Text variant="label" style={{ color: '#DC2626' }}>{error}</Text>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            block
            loading={submitting}
            style={{ marginTop: 8 }}
          >
            Ingresar
          </Button>

          <Link to="/register" style={{ textDecoration: 'none' }}>
            <Button type="button" variant="secondary" block>
              Registrarse
            </Button>
          </Link>
        </form>
      </Card>
    </div>
  );
}
