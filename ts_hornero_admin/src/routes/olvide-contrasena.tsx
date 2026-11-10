import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthPageLayout, ErrorNotice } from '../components/AuthPageLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { api } from '../lib/axios';

export default function OlvideContrasenaPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/password/olvido', { email });
      // Same screen whether or not the account exists: the server never tells.
      setEnviado(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 429
          ? 'Demasiados intentos. Esperá un minuto antes de volver a intentar.'
          : 'No pudimos procesar el pedido. Probá de nuevo en unos minutos.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout title="Recuperá tu contraseña">
      {enviado ? (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Text variant="body">Si el email está registrado, te enviamos un enlace para elegir una nueva contraseña.</Text>
          <Text variant="label" color="ink-3">
            El enlace vence en 30 minutos. Revisá también la carpeta de spam.
          </Text>
        </div>
      ) : (
        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <Text variant="body">
            Ingresá el email de tu cuenta y te enviamos un enlace para elegir una nueva contraseña.
          </Text>
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
          {error && <ErrorNotice>{error}</ErrorNotice>}
          <Button type="submit" variant="primary" block loading={submitting}>
            Enviar enlace
          </Button>
        </form>
      )}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Link to="/login">Volver a ingresar</Link>
      </div>
    </AuthPageLayout>
  );
}
