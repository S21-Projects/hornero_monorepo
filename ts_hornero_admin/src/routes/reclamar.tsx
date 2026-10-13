import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { useOrganizacionPorSlug, useCrearReclamo } from '../lib/hooks/useReclamos';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useUploadReclamoEvidencia } from '../lib/hooks/useUploadOrgImagen';
import { mapReclamoError } from '../lib/hooks/mapReclamoError';
import { ESTADO_ORGANIZACION, ROL_RECLAMO } from '../lib/domain-ui';
import type { OrganizacionAdmin, RolReclamo } from '../types/domain';

const CAP = 3;
const MAX_EVIDENCIAS = 3;
const TELEFONO = /^[0-9+()\-\s]{6,40}$/;

interface Evidencia {
  key: string;
  nombre: string;
}

interface FieldErrors {
  rol?: string;
  telefono?: string;
  evidencia?: string;
}

const selectStyle = {
  padding: '12px 14px',
  borderRadius: 'var(--r-input)',
  border: '1.5px solid var(--line)',
  fontSize: 14.5,
  width: '100%',
} as const;

function ReclamoForm({ org, atCap }: { org: OrganizacionAdmin; atCap: boolean }) {
  const [rol, setRol] = useState<RolReclamo | ''>('');
  const [telefono, setTelefono] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [enviado, setEnviado] = useState(false);

  const crear = useCrearReclamo();
  const upload = useUploadReclamoEvidencia();

  async function handleFile(file: File) {
    try {
      const { key } = await upload.mutateAsync({ organizacionId: org.id, file });
      setEvidencias((cur) => [...cur, { key, nombre: file.name }]);
      setFieldErrors((cur) => ({ ...cur, evidencia: undefined }));
    } catch (err) {
      void err; // surfaced below via upload.isError
    }
  }

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!rol) errs.rol = 'Indicá tu rol en el comedor';
    if (!TELEFONO.test(telefono.trim())) errs.telefono = 'Ingresá un teléfono de contacto válido';
    if (evidencias.length === 0) errs.evidencia = 'Adjuntá al menos una foto como evidencia';
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    try {
      await crear.mutateAsync({
        organizacionId: org.id,
        rol: rol as RolReclamo,
        telefono: telefono.trim(),
        mensaje: mensaje.trim() || undefined,
        evidenciaKeys: evidencias.map((ev) => ev.key),
      });
      setEnviado(true);
    } catch (err) {
      void err; // surfaced below via crear.error
    }
  }

  if (enviado) {
    return (
      <Card style={{ padding: 24 }}>
        <Text variant="h3" as="h2">Recibimos tu reclamo</Text>
        <Text variant="body" color="ink-2" style={{ marginTop: 8, display: 'block' }}>
          Un administrador va a revisar la evidencia y, si todo está bien, te asignará el comedor.
          Podés seguir el estado en tus organizaciones.
        </Text>
        <Link to="/mis-organizaciones" style={{ textDecoration: 'none' }}>
          <Button type="button" variant="primary" style={{ marginTop: 16 }}>
            Ver mis reclamos
          </Button>
        </Link>
      </Card>
    );
  }

  const uploadLleno = evidencias.length >= MAX_EVIDENCIAS;

  return (
    <Card style={{ padding: 24 }}>
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="reclamo-rol">
            <Text as="span" variant="label" color="ink-2">Tu rol en el comedor</Text>
          </label>
          <select
            id="reclamo-rol"
            value={rol}
            onChange={(e) => setRol(e.target.value as RolReclamo | '')}
            style={selectStyle}
          >
            <option value="" disabled>Seleccioná un rol</option>
            {Object.entries(ROL_RECLAMO).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {fieldErrors.rol && <Text variant="body-sm" color="urgent">{fieldErrors.rol}</Text>}
        </div>

        <Input
          id="reclamo-telefono"
          label="Teléfono de contacto"
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="351 555 1234"
          autoComplete="tel"
        />
        {fieldErrors.telefono && <Text variant="body-sm" color="urgent">{fieldErrors.telefono}</Text>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="reclamo-evidencia">
            <Text as="span" variant="label" color="ink-2">
              Evidencia (hasta {MAX_EVIDENCIAS} fotos)
            </Text>
          </label>
          <Text variant="micro" color="ink-3">
            Una foto del frente del comedor, un cartel, una nota o cualquier documento que muestre
            tu vínculo con él.
          </Text>
          <input
            id="reclamo-evidencia"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploadLleno || upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFile(file);
            }}
            style={{ ...selectStyle, padding: '10px 12px' }}
          />
          {upload.isPending && <Text variant="micro" color="ink-3">Subiendo archivo...</Text>}
          {upload.isError && (
            <Text variant="micro" color="urgent">No se pudo subir el archivo. Intentá de nuevo.</Text>
          )}
          {evidencias.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {evidencias.map((ev) => (
                <li key={ev.key}>
                  <Text as="span" variant="body-sm">{ev.nombre}</Text>{' '}
                  <button
                    type="button"
                    aria-label={`Quitar ${ev.nombre}`}
                    onClick={() => setEvidencias((cur) => cur.filter((x) => x.key !== ev.key))}
                    style={{
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--sky)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fieldErrors.evidencia && <Text variant="body-sm" color="urgent">{fieldErrors.evidencia}</Text>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="reclamo-mensaje">
            <Text as="span" variant="label" color="ink-2">Mensaje (opcional)</Text>
          </label>
          <textarea
            id="reclamo-mensaje"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Contanos cómo se vincula tu organización con este comedor"
            style={{ ...selectStyle, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>

        <Text variant="body-sm" color="ink-3">
          Un administrador revisa cada reclamo antes de asignarte el comedor. Podés tener hasta {CAP}{' '}
          organizaciones a tu cargo.
        </Text>

        {atCap && (
          <Text variant="body-sm" color="urgent">
            Ya tenés {CAP} organizaciones a tu cargo: no podés reclamar otra.
          </Text>
        )}
        {crear.isError && (
          <Text variant="body-sm" color="urgent">{mapReclamoError(crear.error)}</Text>
        )}

        <Button
          type="submit"
          variant="primary"
          loading={crear.isPending}
          disabled={atCap || upload.isPending}
        >
          Enviar reclamo
        </Button>
      </form>
    </Card>
  );
}

/**
 * Claim form for an unclaimed (ReNaCoM) organizacion, reached from the public site's
 * "Reclamar este comedor" link (`/reclamar/:slug`). REFERENTE-only (router guard); an
 * unauthenticated visitor is sent to /login and returned here afterwards.
 */
export default function ReclamarPage() {
  const { slug } = useParams<{ slug: string }>();
  const org = useOrganizacionPorSlug(slug);
  const mias = useMisOrganizaciones();

  const aCargo = (mias.data ?? []).filter((o) => o.estado !== 'RECHAZADA').length;
  const atCap = aCargo >= CAP;
  const data = org.data;
  const reclamable = data?.estado === 'SIN_RECLAMAR';
  const estado = data ? ESTADO_ORGANIZACION[data.estado] : undefined;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <Text variant="h2" as="h1">Reclamar este comedor</Text>

      <AsyncSection
        isLoading={org.isLoading}
        isError={org.isError}
        isEmpty={false}
        onRetry={() => { void org.refetch(); }}
      >
        {data && (
          <>
            <Card style={{ padding: 20, margin: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <Text variant="title">{data.nombre}</Text>
                {estado && <Badge tone={estado.tone} label={estado.label} />}
              </div>
              {data.direccion && (
                <Text variant="body-sm" color="ink-3" style={{ marginTop: 4, display: 'block' }}>
                  {data.direccion}
                </Text>
              )}
            </Card>

            {reclamable ? (
              <ReclamoForm org={data} atCap={atCap} />
            ) : (
              <Card style={{ padding: 24 }}>
                <Text variant="body" color="ink-2">
                  Este comedor no está disponible para ser reclamado.
                </Text>
                <Link to="/mis-organizaciones" style={{ textDecoration: 'none' }}>
                  <Button type="button" variant="secondary" style={{ marginTop: 16 }}>
                    Volver a mis organizaciones
                  </Button>
                </Link>
              </Card>
            )}
          </>
        )}
      </AsyncSection>
    </div>
  );
}
