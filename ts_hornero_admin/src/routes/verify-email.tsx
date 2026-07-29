import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatePanel } from '../components/ui/StatePanel';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/auth.store';
import { roleHome } from '../lib/roleHome';

const RESEND_COOLDOWN_SECONDS = 60;

function otpErrorMessage(reason: string | undefined): string {
  switch (reason) {
    case 'CODIGO_EXPIRADO':
      return 'El código venció. Pedí uno nuevo.';
    case 'DEMASIADOS_INTENTOS':
      return 'Superaste el máximo de intentos. Pedí un código nuevo.';
    case 'ESPERA_ANTES_DE_REENVIAR':
      return 'Esperá un momento antes de pedir otro código.';
    case 'CODIGO_INVALIDO':
      return 'Código incorrecto. Probá de nuevo.';
    default:
      return 'No pudimos verificar el código. Probá de nuevo.';
  }
}

/**
 * First of the two independent, sequential gates (spec: "Two Distinct,
 * Sequential Gate States"). Reached before /pending-validation whenever
 * emailVerificado is false — never merged into a single combined message.
 */
export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const loadUser = useAuthStore((s) => s.loadUser);

  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    cooldownInterval.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownInterval.current) clearInterval(cooldownInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/verify-otp', { email: user.email, codigo });
      // Cookies were re-issued by the BFF from the MS's fresh tokens; reload
      // the user so the store's emailVerificado reflects the new claim.
      await loadUser();
      const tipo = useAuthStore.getState().user?.tipo;
      navigate(tipo ? roleHome(tipo) : '/', { replace: true });
    } catch (err) {
      const reason = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(otpErrorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!user?.email || cooldown > 0) return;
    setError('');
    setResending(true);
    try {
      await api.post('/auth/resend-otp', { email: user.email });
      startCooldown();
    } catch (err) {
      const reason = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(otpErrorMessage(reason));
      // Still start the cooldown on a throttled response so the user isn't
      // hammering an endpoint that's already rejecting them.
      startCooldown();
    } finally {
      setResending(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--adobe)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        <StatePanel
          title="Debés validar tu cuenta"
          subtitle={`Te enviamos un código de 6 dígitos a ${user?.email ?? 'tu email'}. Ingresalo para activar tu cuenta.`}
        />

        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <Input
            id="codigo"
            label="Código de verificación"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            required
            autoComplete="one-time-code"
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
            disabled={codigo.length !== 6}
          >
            Verificar
          </Button>

          <Button
            type="button"
            variant="secondary"
            block
            loading={resending}
            disabled={cooldown > 0}
            onClick={() => { void handleResend(); }}
          >
            {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
          </Button>
        </form>
      </div>
    </div>
  );
}
