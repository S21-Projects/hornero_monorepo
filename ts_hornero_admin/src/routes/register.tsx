import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { OrgLocationPickerLazy } from '../components/map/OrgLocationPickerLazy';
import { OrgImagesEditor } from '../components/org/OrgImagesEditor';
import { BienvenidaAcreditacion } from '../components/acreditacion/BienvenidaAcreditacion';
import { useGeolocation } from '../lib/hooks/useGeolocation';
import { useCrearOrganizacion } from '../lib/hooks/useCrearOrganizacion';
import { mapCrearOrganizacionError } from '../lib/hooks/mapCrearOrganizacionError';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/axios';
import { TipoOrganizacion } from '../types/domain';
import type { TipoOrganizacion as TipoOrganizacionType } from '../types/domain';
import { TIPO_ORGANIZACION } from '../lib/domain-ui';
import { CORDOBA_CENTER, type LatLng } from '../lib/geo';
import { PASSWORD_HINT, passwordErrorFromResponse, validatePasswordLength } from '../lib/passwordPolicy';

// Step 'org-error' — the referente's account was created and they are logged
// in, but organización creation failed. They must NOT be asked to re-register
// (referente-onboarding spec: "Partial-Failure Retry"). Their org-form inputs
// stay in this component's state so retrying only re-issues POST /organizaciones.
//
// Step 'acreditacion' — the 3rd register step (referente only, per
// `referente-onboarding` spec's Bienvenida delta): reached from 'done' via
// "Continuar", explains the N0..N3 ladder and ends in "Empezar con N1" /
// "Más tarde". Never reached by DONANTE, which never sets `step` past
// 'account' (it submits and redirects to /login directly).
type Step = 'role' | 'account' | 'org' | 'done' | 'org-error' | 'acreditacion';
type SelectedRole = 'DONANTE' | 'REFERENTE';

/** Visible stage labels for the step indicator — REFERENTE walks all 3,
 * DONANTE only has an account stage before submitting straight to /login. */
const REFERENTE_STAGES = ['Tu cuenta', 'Organización', 'Acreditación'] as const;
const DONANTE_STAGES = ['Tu cuenta', 'Confirmación'] as const;

function currentStageIndex(step: Step): number {
  switch (step) {
    case 'account':
      return 0;
    case 'org':
      return 1;
    case 'done':
    case 'acreditacion':
    case 'org-error':
      return 2;
    default:
      return 0;
  }
}

function StepIndicator({ stages, current }: { stages: readonly string[]; current: number }) {
  return (
    <ol
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 12,
        listStyle: 'none',
        padding: 0,
        marginBottom: 24,
      }}
    >
      {stages.map((label, i) => (
        <li key={label} aria-current={i === current ? 'step' : undefined}>
          <Text
            as="span"
            variant="label"
            color={i === current ? 'earth' : 'ink-3'}
          >
            {label}
          </Text>
        </li>
      ))}
    </ol>
  );
}

interface FieldErrors {
  nombre?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  orgNombre?: string;
  tipo?: string;
  direccion?: string;
  ubicacion?: string;
}

const TIPO_OPTIONS = Object.values(TipoOrganizacion).map((v) => ({
  value: v,
  label: TIPO_ORGANIZACION[v]?.label ?? v,
}));

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
  const crearOrganizacion = useCrearOrganizacion();

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<SelectedRole | null>(null);
  const [pendingRole, setPendingRole] = useState<SelectedRole | null>(null);
  const [createdOrgId, setCreatedOrgId] = useState<number | null>(null);

  // Account fields
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Org fields
  const [orgNombre, setOrgNombre] = useState('');
  const [tipo, setTipo] = useState<TipoOrganizacionType | ''>('');
  const [direccion, setDireccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [coords, setCoords] = useState<LatLng | null>(null);

  const { position, hasUserPosition, fixCount, request } = useGeolocation();

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateAccount(): FieldErrors {
    const errs: FieldErrors = {};
    if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!email.trim()) errs.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Formato de email inválido';
    const passwordError = validatePasswordLength(password);
    if (passwordError) errs.password = passwordError;
    if (password !== confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden';
    return errs;
  }

  function validateOrg(): FieldErrors {
    const errs: FieldErrors = {};
    if (!orgNombre.trim()) errs.orgNombre = 'El nombre de la organización es obligatorio';
    if (!tipo) errs.tipo = 'El tipo es obligatorio';
    if (!direccion.trim()) errs.direccion = 'La dirección es obligatoria';
    if (!coords) errs.ubicacion = 'Marcá la ubicación en el mapa';
    return errs;
  }

  function handleRegistrationError(err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status;
    const passwordError = passwordErrorFromResponse(err);
    if (passwordError) {
      // The MS owns the blocklist / personal-data checks; the account step is where it is fixed.
      setStep('account');
      setFieldErrors({ password: passwordError });
    } else if (status === 409) {
      setFieldErrors({ email: 'Este email ya está registrado' });
    } else {
      setGlobalError('Ocurrió un error. Intentá de nuevo.');
    }
  }

  async function submitOrganizacion() {
    const org = await crearOrganizacion.mutateAsync({
      nombre: orgNombre.trim(),
      tipo: tipo as TipoOrganizacionType,
      direccion: direccion.trim(),
      descripcion: descripcion.trim() || undefined,
      latitud: coords!.lat,
      longitud: coords!.lng,
    });
    setCreatedOrgId(org.id);
  }

  async function handleDonanteFinalSubmit() {
    setIsSubmitting(true);
    try {
      await api.post('/auth/register', { nombre: nombre.trim(), email: email.trim(), password, tipo: role });
      navigate('/login');
    } catch (err: unknown) {
      handleRegistrationError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReferenteFinalSubmit() {
    setIsSubmitting(true);
    try {
      // Step 1: create account + set the session cookies (atomic unit — if this
      // fails, nothing was created). Deliberately NOT calling the auth store's
      // login() here: that also flips global `status` to 'authenticated', and
      // this page is wrapped in PublicOnlyRoute — an early status flip would
      // redirect us away from /register mid-flow, before the org step ever
      // renders. Only api.post sets the httpOnly cookies; the store is
      // updated once the whole flow (including org creation) is done.
      await api.post('/auth/register', { nombre: nombre.trim(), email: email.trim(), password, tipo: role });
      await api.post('/auth/login', { email: email.trim(), password });

      // Step 2: create the organización. The session is already authenticated
      // (cookies are set), so a failure here only requires retrying the org,
      // never re-registering.
      try {
        await submitOrganizacion();
        setStep('done');
      } catch {
        setStep('org-error');
      }
    } catch (err: unknown) {
      handleRegistrationError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOrgRetry() {
    setGlobalError('');
    try {
      await submitOrganizacion();
      setStep('done');
    } catch {
      setGlobalError(mapCrearOrganizacionError(crearOrganizacion.error));
    }
  }

  /** Resolves global auth status (GET /auth/me) only once the referente flow
   * is fully done, then leaves the app to route them (dashboard or, more
   * likely, /pending-validation until an admin validates the new org). */
  async function finishAndGo() {
    await useAuthStore.getState().loadUser();
    navigate('/');
  }

  /** "Empezar con N1" — same auth-status resolution as `finishAndGo`, but
   * lands on /acreditacion instead of role home. Resolving status first
   * matters here too: /acreditacion is gated by `requireVerified`, and an
   * unresolved 'loading' status would otherwise flash a loader mid-redirect. */
  async function handleEmpezarAcreditacion() {
    await useAuthStore.getState().loadUser();
    navigate('/acreditacion');
  }

  function handleRoleSelect(selectedRole: SelectedRole) {
    setRole(selectedRole);
    setPendingRole(null);
    setStep('account');
  }

  function handleAccountSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateAccount();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setGlobalError('');

    if (role === 'DONANTE') {
      void handleDonanteFinalSubmit();
    } else {
      setStep('org');
    }
  }

  async function handleOrgSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateOrg();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setGlobalError('');
    await handleReferenteFinalSubmit();
  }

  const accountStepLabel =
    role === 'DONANTE' ? 'Paso 1 de 1 — Datos personales' : 'Paso 1 de 2 — Datos personales';

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

      {step !== 'role' && (
        <StepIndicator
          stages={role === 'DONANTE' ? DONANTE_STAGES : REFERENTE_STAGES}
          current={currentStageIndex(step)}
        />
      )}

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
            onSubmit={handleAccountSubmit}
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
              placeholder="Mínimo 15 caracteres"
              autoComplete="new-password"
              showToggle
            />
            <Text variant="label">{PASSWORD_HINT}</Text>
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
              {role === 'DONANTE' ? 'Crear cuenta' : 'Continuar'}
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

      {/* ── Step 2: org (REFERENTE only) ────────────────────────────────────── */}
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

          <form
            onSubmit={(e) => { void handleOrgSubmit(e); }}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Text as="div" variant="title" color="earth" style={sectionTitleStyle}>
              Datos de la organización
            </Text>

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
              <Select
                id="tipo"
                value={tipo}
                placeholder={!tipo}
                onChange={(e) => setTipo(e.target.value as TipoOrganizacionType | '')}
              >
                <option value="" disabled>Seleccioná un tipo</option>
                {TIPO_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <label>
                  <Text as="span" variant="label" color="ink-2">Ubicación de la organización</Text>
                </label>
                <button
                  type="button"
                  onClick={() => request((latlng) => setCoords(latlng))}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--sky)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Usar mi ubicación
                </button>
              </div>
              <Text as="p" variant="label" color="ink-3" style={{ marginBottom: 2 }}>
                Tocá el mapa para marcar dónde está tu organización.
              </Text>

              <div
                style={{
                  height: 280,
                  borderRadius: 'var(--r-input)',
                  overflow: 'hidden',
                  border: '1.5px solid var(--line)',
                }}
              >
                <OrgLocationPickerLazy
                  center={coords ?? (hasUserPosition ? position : CORDOBA_CENTER)}
                  markerPosition={coords}
                  userPosition={hasUserPosition ? position : null}
                  recenterSignal={fixCount}
                  onPick={(latlng) => setCoords(latlng)}
                  height={280}
                />
              </div>

              <Text as="div" variant="label" color="ink-2" style={{ marginTop: 2 }}>
                {coords
                  ? `Lat: ${coords.lat.toFixed(5)} · Lng: ${coords.lng.toFixed(5)}`
                  : 'Sin ubicación marcada'}
              </Text>
              {fieldErrors.ubicacion && <ErrorBanner msg={fieldErrors.ubicacion} />}
            </div>

            {globalError && <ErrorBanner msg={globalError} />}

            <Button type="submit" variant="primary" block loading={isSubmitting} style={{ marginTop: 8 }}>
              Postular organización
            </Button>

            <Button
              type="button"
              variant="secondary"
              block
              onClick={() => setStep('account')}
              style={{ marginTop: 4 }}
            >
              Volver
            </Button>
          </form>
        </Card>
      )}

      {/* ── Step: done (REFERENTE success) ──────────────────────────────── */}
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

          {createdOrgId != null && (
            <div style={{ textAlign: 'left', marginBottom: 24 }}>
              <Text variant="label" color="ink-2" style={{ marginBottom: 10, display: 'block' }}>
                Sumá una foto y un banner (opcional — podés hacerlo después desde "Mis organizaciones")
              </Text>
              <OrgImagesEditor organizacionId={createdOrgId} />
            </div>
          )}

          <Button variant="primary" block onClick={() => setStep('acreditacion')}>
            Continuar
          </Button>
        </Card>
      )}

      {/* ── Step: acreditacion (REFERENTE only, 3rd step — Bienvenida) ──────── */}
      {step === 'acreditacion' && createdOrgId != null && (
        <BienvenidaAcreditacion
          organizacionId={createdOrgId}
          organizacionNombre={orgNombre.trim()}
          onEmpezar={() => { void handleEmpezarAcreditacion(); }}
          onMasTarde={() => { void finishAndGo(); }}
        />
      )}

      {/* ── Step: org-error (account created, org creation failed) ─────────── */}
      {step === 'org-error' && (
        <Card style={{ width: '100%', maxWidth: 480, padding: 40, textAlign: 'center' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#FEF3C7',
              border: '2px solid #F59E0B',
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
              stroke="#D97706"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <Text variant="h2" as="h1" color="earth" style={{ marginBottom: 12 }}>
            Cuenta creada, pero...
          </Text>

          <Text
            variant="body-sm"
            color="ink-2"
            style={{ maxWidth: 360, margin: '0 auto 28px' }}
          >
            Tu cuenta fue creada correctamente, pero no pudimos registrar la organización en este
            momento. Podés intentarlo de nuevo o ir a tu panel y completarlo después.
          </Text>

          {globalError && (
            <div style={{ marginBottom: 16 }}>
              <ErrorBanner msg={globalError} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Button
              variant="primary"
              block
              loading={crearOrganizacion.isPending}
              onClick={() => { void handleOrgRetry(); }}
            >
              Reintentar
            </Button>
            <Button variant="secondary" block onClick={() => { void finishAndGo(); }}>
              Ir a mi panel
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
