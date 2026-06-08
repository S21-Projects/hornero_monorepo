'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';
import { createOrganizacion, type CreateOrganizacionPayload } from '@/lib/api/organizaciones';
import { api } from '@/lib/axios';

// ─── Field-level error state ─────────────────────────────────────────────────
interface FieldErrors {
  nombre?: string;
  email?: string;
  password?: string;
  orgNombre?: string;
  tipo?: string;
  direccion?: string;
  latitud?: string;
  longitud?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseNumber(value: string): number | undefined {
  const n = parseFloat(value);
  return isNaN(n) ? undefined : n;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOrgStep = searchParams.get('step') === 'org';

  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // Redirect authenticated users away from register
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.tipo === 'ADMINISTRADOR') {
      router.replace('/');
    } else if (user.tipo === 'REFERENTE' && !isOrgStep) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, user, isOrgStep, router]);

  // Account fields
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Org fields
  const [orgNombre, setOrgNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [orgError, setOrgError] = useState('');
  const [isOrgRetrying, setIsOrgRetrying] = useState(false);

  function validateAccount(): FieldErrors {
    const errs: FieldErrors = {};
    if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!email.trim()) errs.email = 'El email es obligatorio';
    if (!password || password.length < 6) errs.password = 'La contraseña debe tener al menos 6 caracteres';
    return errs;
  }

  function validateOrg(): FieldErrors {
    const errs: FieldErrors = {};
    if (!orgNombre.trim()) errs.orgNombre = 'El nombre de la organización es obligatorio';
    if (!tipo.trim()) errs.tipo = 'El tipo es obligatorio';
    if (!direccion.trim()) errs.direccion = 'La dirección es obligatoria';
    if (!latitud.trim() || parseNumber(latitud) === undefined) errs.latitud = 'Latitud inválida';
    if (!longitud.trim() || parseNumber(longitud) === undefined) errs.longitud = 'Longitud inválida';
    return errs;
  }

  function buildOrgPayload(): CreateOrganizacionPayload {
    return {
      nombre: orgNombre.trim(),
      tipo: tipo.trim(),
      direccion: direccion.trim(),
      descripcion: descripcion.trim() || undefined,
      latitud: parseNumber(latitud)!,
      longitud: parseNumber(longitud)!,
    };
  }

  // Retry org creation only (used after partial failure)
  async function handleOrgRetry() {
    const errs = validateOrg();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setOrgError('');
    setIsOrgRetrying(true);
    try {
      await createOrganizacion(buildOrgPayload());
      // Reload user after org creation (useMyOrgQuery will pick up new org status)
      await useAuthStore.getState().loadUser();
      router.push('/dashboard');
    } catch {
      setOrgError('No se pudo crear la organización. Verificá los datos e intentá de nuevo.');
    } finally {
      setIsOrgRetrying(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError('');
    setOrgError('');

    const accountErrs = validateAccount();
    const orgErrs = validateOrg();
    const allErrs = { ...accountErrs, ...orgErrs };

    if (Object.keys(allErrs).length > 0) {
      setFieldErrors(allErrs);
      return;
    }
    setFieldErrors({});

    try {
      await register(
        { nombre: nombre.trim(), email: email.trim(), password },
        buildOrgPayload()
      );
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number }; message?: string };
      const status = axiosErr?.response?.status;

      if (status === 409) {
        // Account step failed — duplicate email
        setFieldErrors({ email: 'Este email ya está registrado' });
        return;
      }

      // Check if the account was created (user is now authenticated) but org failed
      const state = useAuthStore.getState();
      if (state.isAuthenticated) {
        setOrgError('Tu cuenta fue creada, pero no pudimos registrar la organización. Completá los datos y reintentá.');
        return;
      }

      setGlobalError('Ocurrió un error al registrarte. Intentá de nuevo.');
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 900,
    color: 'var(--earth)',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1.5px solid var(--line)',
  };

  const errorBanner = (msg: string) => (
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
      {msg}
    </div>
  );

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

      {/* Org-only retry mode (partial failure recovery: ?step=org) */}
      {isOrgStep ? (
        <Card style={{ width: '100%', maxWidth: 480, padding: 32 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: 'var(--earth)',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            Completá tu organización
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--ink-2)',
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            Tu cuenta ya está activa. Solo falta registrar tu organización.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              id="org-nombre"
              label="Nombre de la organización"
              value={orgNombre}
              onChange={(e) => setOrgNombre(e.target.value)}
              placeholder="Comedor Los Hornitos"
            />
            {fieldErrors.orgNombre && errorBanner(fieldErrors.orgNombre)}

            <Input
              id="tipo"
              label="Tipo de organización"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Comedor, Merendero, etc."
            />
            {fieldErrors.tipo && errorBanner(fieldErrors.tipo)}

            <Input
              id="direccion"
              label="Dirección"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Av. Colón 1234, Córdoba"
            />
            {fieldErrors.direccion && errorBanner(fieldErrors.direccion)}

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
                {fieldErrors.latitud && errorBanner(fieldErrors.latitud)}
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
                {fieldErrors.longitud && errorBanner(fieldErrors.longitud)}
              </div>
            </div>

            {orgError && errorBanner(orgError)}

            <Button
              type="button"
              variant="primary"
              block
              disabled={isOrgRetrying}
              style={{ marginTop: 8 }}
              onClick={handleOrgRetry}
            >
              {isOrgRetrying ? 'Registrando…' : 'Registrar organización'}
            </Button>
          </div>
        </Card>
      ) : (
        /* Full registration form */
        <Card style={{ width: '100%', maxWidth: 520, padding: 32 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: 'var(--earth)',
              marginBottom: 28,
              textAlign: 'center',
            }}
          >
            Creá tu cuenta
          </h1>

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Section: Tu cuenta */}
            <div style={sectionTitleStyle}>Tu cuenta</div>

            <Input
              id="nombre"
              label="Nombre completo"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ana García"
              autoComplete="name"
            />
            {fieldErrors.nombre && errorBanner(fieldErrors.nombre)}

            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@ejemplo.com"
              autoComplete="email"
            />
            {fieldErrors.email && errorBanner(fieldErrors.email)}

            <Input
              id="password"
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
            {fieldErrors.password && errorBanner(fieldErrors.password)}

            {/* Section: Tu organización */}
            <div style={{ ...sectionTitleStyle, marginTop: 8 }}>Tu organización</div>

            <Input
              id="org-nombre"
              label="Nombre de la organización"
              value={orgNombre}
              onChange={(e) => setOrgNombre(e.target.value)}
              placeholder="Comedor Los Hornitos"
            />
            {fieldErrors.orgNombre && errorBanner(fieldErrors.orgNombre)}

            <Input
              id="tipo"
              label="Tipo de organización"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Comedor, Merendero, Copa de Leche, etc."
            />
            {fieldErrors.tipo && errorBanner(fieldErrors.tipo)}

            <Input
              id="direccion"
              label="Dirección"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Av. Colón 1234, Córdoba"
            />
            {fieldErrors.direccion && errorBanner(fieldErrors.direccion)}

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
                {fieldErrors.latitud && errorBanner(fieldErrors.latitud)}
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
                {fieldErrors.longitud && errorBanner(fieldErrors.longitud)}
              </div>
            </div>

            {/* Org-step failure banner (account created, org failed) */}
            {orgError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {errorBanner(orgError)}
                <Button
                  type="button"
                  variant="secondary"
                  block
                  onClick={handleOrgRetry}
                  disabled={isOrgRetrying}
                >
                  {isOrgRetrying ? 'Reintentando…' : 'Reintentar solo la organización'}
                </Button>
              </div>
            )}

            {globalError && errorBanner(globalError)}

            <Button
              type="submit"
              variant="primary"
              block
              disabled={isLoading}
              style={{ marginTop: 8 }}
            >
              {isLoading ? 'Registrando…' : 'Crear cuenta y organización'}
            </Button>

            <div
              style={{
                textAlign: 'center',
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--ink-2)',
                marginTop: 4,
              }}
            >
              ¿Ya tenés cuenta?{' '}
              <a href="/login" style={{ color: 'var(--sky)', fontWeight: 800, textDecoration: 'none' }}>
                Ingresá acá
              </a>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
