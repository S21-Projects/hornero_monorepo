'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { useAuthStore } from '@/store/auth.store';
import { registerUser } from '@/lib/api/auth';
import { createOrganizacion } from '@/lib/api/organizaciones';
import { api } from '@/lib/axios';
import { type TipoOrganizacion, TIPO_ORGANIZACION_OPTIONS } from '@/lib/tipos-organizacion';

type Step = 'account' | 'org' | 'done';

interface FieldErrors {
  nombre?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  orgNombre?: string;
  tipo?: string;
  direccion?: string;
  latitud?: string;
  longitud?: string;
}

function parseNumber(value: string): number | undefined {
  const n = parseFloat(value);
  return isNaN(n) ? undefined : n;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadUser = useAuthStore((s) => s.loadUser);

  const initialStep: Step = searchParams.get('step') === 'org' ? 'org' : 'account';
  const [step, setStep] = useState<Step>(initialStep);

  // Account fields
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Org fields
  const [orgNombre, setOrgNombre] = useState('');
  const [tipo, setTipo] = useState<TipoOrganizacion | ''>('');
  const [direccion, setDireccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Step 1: account ────────────────────────────────────────────────────────

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
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setGlobalError('');
    setIsSubmitting(true);
    try {
      await registerUser({ nombre: nombre.trim(), email: email.trim(), password });
      await api.post('/auth/login', { email: email.trim(), password });
      await loadUser();
      setStep('org');
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 409) {
        setFieldErrors({ email: 'Este email ya está registrado' });
      } else {
        setGlobalError('Ocurrió un error. Intentá de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Step 2: org ────────────────────────────────────────────────────────────

  function validateOrg(): FieldErrors {
    const errs: FieldErrors = {};
    if (!orgNombre.trim()) errs.orgNombre = 'El nombre de la organización es obligatorio';
    if (!tipo) errs.tipo = 'El tipo es obligatorio';
    if (!direccion.trim()) errs.direccion = 'La dirección es obligatoria';
    if (!latitud.trim() || parseNumber(latitud) === undefined) errs.latitud = 'Latitud inválida';
    if (!longitud.trim() || parseNumber(longitud) === undefined) errs.longitud = 'Longitud inválida';
    return errs;
  }

  async function handleOrgSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateOrg();
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setGlobalError('');
    setIsSubmitting(true);
    try {
      await createOrganizacion({
        nombre: orgNombre.trim(),
        tipo: tipo as TipoOrganizacion,
        direccion: direccion.trim(),
        descripcion: descripcion.trim() || undefined,
        latitud: parseNumber(latitud)!,
        longitud: parseNumber(longitud)!,
      });
      setStep('done');
    } catch {
      setGlobalError('No se pudo registrar la organización. Verificá los datos e intentá de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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

      {/* ── Step 1: account ─────────────────────────────────────────────── */}
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
            Paso 1 de 2 — Datos personales
          </Text>

          <form onSubmit={handleAccountSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Text as="div" variant="title" color="earth" style={sectionTitleStyle}>Tu cuenta</Text>

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

            <Button type="submit" variant="primary" block loading={isSubmitting} style={{ marginTop: 8 }}>
              Continuar
            </Button>

            <Text as="div" variant="label" color="ink-2" style={{ textAlign: 'center', marginTop: 4 }}>
              ¿Ya tenés cuenta?{' '}
              <a href="/login" style={{ textDecoration: 'none' }}>
                <Text as="span" variant="label" style={{ color: 'var(--sky)', fontWeight: 800 }}>Ingresá acá</Text>
              </a>
            </Text>
          </form>
        </Card>
      )}

      {/* ── Step 2: org ─────────────────────────────────────────────────── */}
      {step === 'org' && (
        <Card style={{ width: '100%', maxWidth: 480, padding: 32 }}>
          <Text
            variant="h2"
            as="h1"
            color="earth"
            style={{ marginBottom: 6, textAlign: 'center' }}
          >
            Tu organización
          </Text>
          <Text
            as="p"
            variant="label"
            color="ink-3"
            style={{ textAlign: 'center', marginBottom: 24 }}
          >
            Paso 2 de 2 — Datos de la organización
          </Text>

          <form onSubmit={handleOrgSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Text as="div" variant="title" color="earth" style={sectionTitleStyle}>Datos de la organización</Text>

            <Input
              id="org-nombre"
              label="Nombre de la organización"
              value={orgNombre}
              onChange={(e) => setOrgNombre(e.target.value)}
              placeholder="Comedor Los Hornitos"
            />
            {fieldErrors.orgNombre && <ErrorBanner msg={fieldErrors.orgNombre} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="tipo">
                <Text as="span" variant="label" color="ink-2">Tipo de organización</Text>
              </label>
              <select
                id="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoOrganizacion | '')}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 14.5,
                  color: tipo ? 'var(--ink)' : 'var(--ink-3)',
                  background: '#fff',
                  border: '1.5px solid var(--line)',
                  borderRadius: 'var(--r-input)',
                  padding: '12px 14px',
                  width: '100%',
                  outline: 'none',
                  appearance: 'auto',
                }}
              >
                <option value="" disabled>Seleccioná un tipo</option>
                {TIPO_ORGANIZACION_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {fieldErrors.tipo && <ErrorBanner msg={fieldErrors.tipo} />}

            <Input
              id="direccion"
              label="Dirección"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Av. Colón 1234, Córdoba"
            />
            {fieldErrors.direccion && <ErrorBanner msg={fieldErrors.direccion} />}

            <Input
              id="descripcion"
              label="Descripción (opcional)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Breve descripción de la organización"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Input
                  id="latitud"
                  label="Latitud"
                  type="number"
                  step="any"
                  value={latitud}
                  onChange={(e) => setLatitud(e.target.value)}
                  placeholder="-31.4167"
                />
                {fieldErrors.latitud && <ErrorBanner msg={fieldErrors.latitud} />}
              </div>
              <div>
                <Input
                  id="longitud"
                  label="Longitud"
                  type="number"
                  step="any"
                  value={longitud}
                  onChange={(e) => setLongitud(e.target.value)}
                  placeholder="-64.1833"
                />
                {fieldErrors.longitud && <ErrorBanner msg={fieldErrors.longitud} />}
              </div>
            </div>

            {globalError && <ErrorBanner msg={globalError} />}

            <Button type="submit" variant="primary" block loading={isSubmitting} style={{ marginTop: 8 }}>
              Postular organización
            </Button>
          </form>
        </Card>
      )}

      {/* ── Step 3: confirmation ─────────────────────────────────────────── */}
      {step === 'done' && (
        <Card style={{ width: '100%', maxWidth: 480, padding: 40, textAlign: 'center' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#D1FAE5',
              border: '2px solid #34D399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <svg
              width={34}
              height={34}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <Text variant="h2" as="h1" color="earth" style={{ marginBottom: 12 }}>
            ¡Solicitud enviada!
          </Text>

          <Text
            variant="body-sm"
            color="ink-2"
            style={{ maxWidth: 340, margin: '0 auto 28px' }}
          >
            Registramos tu organización. Un administrador la revisará pronto. Te
            avisaremos cuando esté aprobada.
          </Text>

          <Button variant="primary" block onClick={() => router.push('/dashboard')}>
            Ir a mi panel
          </Button>
        </Card>
      )}
    </div>
  );
}
