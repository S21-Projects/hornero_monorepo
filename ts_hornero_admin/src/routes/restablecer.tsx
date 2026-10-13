import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthPageLayout, ErrorNotice } from '../components/AuthPageLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { api } from '../lib/axios';
import { PASSWORD_HINT, passwordErrorFromResponse, validatePasswordLength } from '../lib/passwordPolicy';

function responseInfo(err: unknown): { status?: number; message?: unknown } {
  const response = (err as { response?: { status?: number; data?: { message?: unknown } } })?.response;
  return { status: response?.status, message: response?.data?.message };
}

export default function RestablecerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Read once: the URL is cleaned below, so later renders no longer see the query.
  const [token] = useState(() => searchParams.get('token') ?? '');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [tokenInvalido, setTokenInvalido] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // The token is a bearer credential: drop it from the address bar / history entry, and ask the
  // browser not to send a Referer from this page (Referrer-Policy is already
  // strict-origin-when-cross-origin from the nginx headers; this is defense in depth).
  useEffect(() => {
    navigate('/restablecer', { replace: true });
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const lengthError = validatePasswordLength(password);
    if (lengthError) {
      setError(lengthError);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/password/restablecer', { token, password });
      navigate('/login?motivo=password-restablecida', { replace: true });
    } catch (err) {
      const { status, message } = responseInfo(err);
      if (status === 429) {
        setError('Demasiados intentos. Esperá un minuto antes de volver a intentar.');
      } else if (message === 'TOKEN_INVALIDO') {
        setTokenInvalido(true);
      } else {
        setError(
          passwordErrorFromResponse(err) ?? 'No pudimos cambiar la contraseña. Probá de nuevo en unos minutos.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!token || tokenInvalido) {
    return (
      <AuthPageLayout title="Enlace no disponible">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Text variant="body">
            {tokenInvalido
              ? 'Este enlace venció o ya fue usado. Pedí uno nuevo para elegir tu contraseña.'
              : 'El enlace no es válido. Pedí uno nuevo para elegir tu contraseña.'}
          </Text>
          <Link to="/olvide-contrasena">Pedir un enlace nuevo</Link>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title="Elegí una nueva contraseña">
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <Input
          id="password"
          label="Nueva contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          showToggle
        />
        <Text variant="label" color="ink-3">{PASSWORD_HINT}</Text>
        <Input
          id="confirm"
          label="Confirmar contraseña"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          showToggle
        />
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <Button type="submit" variant="primary" block loading={submitting}>
          Cambiar contraseña
        </Button>
      </form>
    </AuthPageLayout>
  );
}
