import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { api } from '../lib/axios';

type Step = 'role' | 'account';
type SelectedRole = 'DONANTE' | 'REFERENTE';

interface FieldErrors {
  nombre?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const sectionTitleStyle: React.CSSProperties = {
  marginBottom: 16,
  paddingBottom: 8,
  borderBottom: '1.5px solid var(--line)',
};

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      style={{
        background: '#FEE2E2',
        border: '1px solid #FCA5A5',
        borderRadius: 10,
        padding: '10px 14px',
      }}
    >
      <Text variant="label" style={{ color: '#DC2626' }}>{msg}</Text>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<SelectedRole | null>(null);
  const [pendingRole, setPendingRole] = useState<SelectedRole | null>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateAccount(): FieldErrors {
    const errs: FieldErrors = {};
    if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!email.trim()) errs.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Formato de email inválido';
    if (!password || password.length < 6) errs.password = 'La contraseña debe tener al menos 6 caracteres';
    if (password !== confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden';
    return errs;
  }

  async function handleAccountSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateAccount();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setGlobalError('');
    setIsSubmitting(true);
    try {
      await api.post('/auth/register', {
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        tipo: role,
      });
      navigate('/login');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        setFieldErrors({ email: 'Este email ya está registrado' });
      } else {
        setGlobalError('Ocurrió un error. Intentá de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRoleSelect(selectedRole: SelectedRole) {
    setRole(selectedRole);
    setPendingRole(null);
    setStep('account');
  }

  const accountStepLabel =
    role === 'DONANTE' ? 'Paso 1 de 1 — Datos personales' : 'Paso 1 de 1 — Datos personales';

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
      <div style={{ marginBottom: 32 }}>
        <Logo size={42} />
      </div>

      {/* ── Step 0: role selection ─────────────────────────────────────────── */}
      {step === 'role' && (
        <div style={{ width: '100%', maxWidth: 560 }}>
          <Text
            variant="h2"
            as="h1"
            color="earth"
            style={{ marginBottom: 8, textAlign: 'center' }}
          >
            ¿Cómo querés participar?
          </Text>
          <Text
            as="p"
            variant="label"
            color="ink-3"
            style={{ textAlign: 'center', marginBottom: 32 }}
          >
            Elegí tu rol para comenzar el registro
          </Text>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {(['DONANTE', 'REFERENTE'] as SelectedRole[]).map((r) => {
              const isSelected = pendingRole === r;
              return (
                <div
                  key={r}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPendingRole(r)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPendingRole(r)}
                  style={{
                    cursor: 'pointer',
                    transform: isSelected ? 'translateY(-2px)' : 'none',
                    transition: 'transform 0.15s',
                    userSelect: 'none',
                    outline: 'none',
                  }}
                >
                  <Card
                    style={{
                      padding: 28,
                      border: `2px solid ${isSelected ? 'var(--earth)' : 'var(--line)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      alignItems: 'flex-start',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <Text variant="title" color="earth">
                      {r === 'DONANTE' ? 'Quiero donar' : 'Tengo una organización'}
                    </Text>
                    <Text variant="body-sm" color="ink-2">
                      {r === 'DONANTE'
                        ? 'Apoyá organizaciones sociales con donaciones de dinero o artículos.'
                        : 'Registrá tu organización social y gestioná las necesidades de tu comunidad.'}
                    </Text>
                  </Card>
                </div>
              );
            })}
          </div>

          <Button
            variant="primary"
            block
            disabled={!pendingRole}
            onClick={() => pendingRole && handleRoleSelect(pendingRole)}
            style={{ marginTop: 20 }}
          >
            Continuar
          </Button>

          <Text as="div" variant="label" color="ink-2" style={{ textAlign: 'center', marginTop: 20 }}>
            ¿Ya tenés cuenta?{' '}
            <a href="/login" style={{ textDecoration: 'none' }}>
              <Text as="span" variant="label" style={{ color: 'var(--sky)', fontWeight: 800 }}>
                Ingresá acá
              </Text>
            </a>
          </Text>
        </div>
      )}

      {/* ── Step 1: account ───────────────────────────────────────────────── */}
      {step === 'account' && (
        <Card style={{ width: '100%', maxWidth: 480, padding: 32 }}>
          <Text
            variant="h2"
            as="h1"
            color="earth"
            style={{ marginBottom: 6, textAlign: 'center' }}
          >
            Creá tu cuenta
          </Text>
          <Text
            as="p"
            variant="label"
            color="ink-3"
            style={{ textAlign: 'center', marginBottom: 24 }}
          >
            {accountStepLabel}
          </Text>

          <form
            onSubmit={(e) => { void handleAccountSubmit(e); }}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Text as="div" variant="title" color="earth" style={sectionTitleStyle}>
              Tu cuenta
            </Text>

            <Input
              id="nombre"
              label="Nombre completo"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ana García"
              autoComplete="name"
            />
            {fieldErrors.nombre && <ErrorBanner msg={fieldErrors.nombre} />}

            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@ejemplo.com"
              autoComplete="email"
            />
            {fieldErrors.email && <ErrorBanner msg={fieldErrors.email} />}

            <Input
              id="password"
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              showToggle
            />
            {fieldErrors.password && <ErrorBanner msg={fieldErrors.password} />}

            <Input
              id="confirmPassword"
              label="Confirmar contraseña"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetí tu contraseña"
              autoComplete="new-password"
              showToggle
            />
            {fieldErrors.confirmPassword && <ErrorBanner msg={fieldErrors.confirmPassword} />}

            {globalError && <ErrorBanner msg={globalError} />}

            <Button
              type="submit"
              variant="primary"
              block
              loading={isSubmitting}
              style={{ marginTop: 8 }}
            >
              Crear cuenta
            </Button>

            <Button
              type="button"
              variant="secondary"
              block
              onClick={() => setStep('role')}
              style={{ marginTop: 4 }}
            >
              Volver
            </Button>

            <Text as="div" variant="label" color="ink-2" style={{ textAlign: 'center', marginTop: 4 }}>
              ¿Ya tenés cuenta?{' '}
              <a href="/login" style={{ textDecoration: 'none' }}>
                <Text as="span" variant="label" style={{ color: 'var(--sky)', fontWeight: 800 }}>
                  Ingresá acá
                </Text>
              </a>
            </Text>
          </form>
        </Card>
      )}
    </div>
  );
}
