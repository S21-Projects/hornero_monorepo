import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AsyncSection } from '../components/AsyncSection';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { useOrganizacionPorSlug } from '../lib/hooks/useReclamos';
import { useCrearReporte, useOrganizacionesCercanas } from '../lib/hooks/useReportes';
import { mapReporteError } from '../lib/hooks/mapReporteError';
import { MOTIVO_REPORTE } from '../lib/domain-ui';
import type { MotivoReporte, OrganizacionAdmin } from '../types/domain';

const MOTIVOS = Object.keys(MOTIVO_REPORTE) as MotivoReporte[];
const RADIO_METROS = 500;
const MAX_DETALLE = 1000;

interface FieldErrors {
  motivo?: string;
  duplicada?: string;
}

function ReporteForm({ org }: { org: OrganizacionAdmin }) {
  const navigate = useNavigate();
  const [motivo, setMotivo] = useState<MotivoReporte | ''>('');
  const [duplicadaId, setDuplicadaId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [enviado, setEnviado] = useState(false);

  const crear = useCrearReporte();
  const esDuplicado = motivo === 'DUPLICADO';
  const cercanas = useOrganizacionesCercanas(org.id, esDuplicado);
  const sugerencias = cercanas.data ?? [];

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!motivo) errs.motivo = 'Elegí qué problema querés reportar';
    if (esDuplicado && duplicadaId == null) errs.duplicada = 'Elegí con qué organización de Hornero es el mismo';
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
        motivo: motivo as MotivoReporte,
        organizacionDuplicadaId: esDuplicado ? (duplicadaId ?? undefined) : undefined,
        detalle: detalle.trim() || undefined,
      });
      setEnviado(true);
    } catch (err) {
      void err; // surfaced below via crear.error
    }
  }

  if (enviado) {
    return (
      <Card style={{ padding: 24 }}>
        <Text variant="h3" as="h2">Recibimos tu reporte</Text>
        <Text variant="body" color="ink-2" style={{ marginTop: 8, display: 'block' }}>
          Un administrador lo va a revisar. El comedor no cambia hasta que se confirme. ¡Gracias por
          ayudarnos a mantener el mapa al día!
        </Text>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Button type="button" variant="primary" style={{ marginTop: 16 }}>Listo</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 24 }}>
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <legend style={{ marginBottom: 8 }}>
            <Text as="span" variant="label" color="ink-2">¿Qué problema encontraste?</Text>
          </legend>
          {MOTIVOS.map((m) => (
            <label key={m} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="radio"
                name="reporte-motivo"
                value={m}
                checked={motivo === m}
                onChange={() => { setMotivo(m); setDuplicadaId(null); }}
                style={{ marginTop: 4 }}
              />
              <span>
                <Text as="span" variant="body" style={{ display: 'block' }}>{MOTIVO_REPORTE[m].label}</Text>
                <Text as="span" variant="micro" color="ink-3">{MOTIVO_REPORTE[m].hint}</Text>
              </span>
            </label>
          ))}
          {fieldErrors.motivo && <Text variant="body-sm" color="urgent">{fieldErrors.motivo}</Text>}
        </fieldset>

        {esDuplicado && (
          <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <legend style={{ marginBottom: 6 }}>
              <Text as="span" variant="label" color="ink-2">¿Con qué organización de Hornero es el mismo?</Text>
            </legend>
            <Text variant="micro" color="ink-3">
              Sugerimos las organizaciones de Hornero a menos de {RADIO_METROS} m.
            </Text>
            {cercanas.isLoading && <Text variant="micro" color="ink-3">Buscando organizaciones cercanas...</Text>}
            {cercanas.isError && (
              <Text variant="body-sm" color="urgent">No pudimos buscar organizaciones cercanas. Intentá de nuevo.</Text>
            )}
            {!cercanas.isLoading && !cercanas.isError && sugerencias.length === 0 && (
              <Text variant="body-sm" color="ink-2">
                No hay organizaciones de Hornero a menos de {RADIO_METROS} m de este comedor.
              </Text>
            )}
            {sugerencias.map((o) => (
              <label key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="reporte-duplicada"
                  value={o.id}
                  checked={duplicadaId === o.id}
                  onChange={() => setDuplicadaId(o.id)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <Text as="span" variant="body" style={{ display: 'block' }}>{o.nombre}</Text>
                  <Text as="span" variant="micro" color="ink-3">
                    {o.direccion ? `${o.direccion} · ` : ''}a {o.distanciaMetros} m
                  </Text>
                </span>
              </label>
            ))}
            {fieldErrors.duplicada && <Text variant="body-sm" color="urgent">{fieldErrors.duplicada}</Text>}
          </fieldset>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="reporte-detalle">
            <Text as="span" variant="label" color="ink-2">Detalle (opcional)</Text>
          </label>
          <textarea
            id="reporte-detalle"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            rows={4}
            maxLength={MAX_DETALLE}
            placeholder="Contanos qué viste"
            style={{
              padding: '12px 14px', borderRadius: 'var(--r-input)', border: '1.5px solid var(--line)',
              fontSize: 14.5, width: '100%', fontFamily: 'inherit', resize: 'vertical',
            }}
          />
        </div>

        <Text variant="body-sm" color="ink-3">
          Un administrador revisa el reporte. El comedor no cambia hasta que se confirme.
        </Text>

        {crear.isError && <Text variant="body-sm" color="urgent">{mapReporteError(crear.error)}</Text>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" variant="ghost" onClick={() => { void navigate(-1); }}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={crear.isPending}>Enviar reporte</Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * Report form for an unclaimed (ReNaCoM) organizacion, reached from the public site's
 * "Reportar un problema" link (`/reportar/:slug`). Any authenticated role; an anonymous visitor is
 * sent to /login and returned here afterwards (safeRedirectPath).
 */
export default function ReportarPage() {
  const { slug } = useParams<{ slug: string }>();
  const org = useOrganizacionPorSlug(slug);
  const data = org.data;
  const reportable = data?.estado === 'SIN_RECLAMAR';

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <Text variant="h2" as="h1">Reportar un problema</Text>

      <AsyncSection
        isLoading={org.isLoading}
        isError={org.isError}
        isEmpty={false}
        onRetry={() => { void org.refetch(); }}
      >
        {data && (
          <>
            <Card style={{ padding: 20, margin: '16px 0' }}>
              <Text variant="title">{data.nombre}</Text>
              {data.direccion && (
                <Text variant="body-sm" color="ink-3" style={{ marginTop: 4, display: 'block' }}>
                  {data.direccion}
                </Text>
              )}
            </Card>

            {reportable ? (
              <ReporteForm org={data} />
            ) : (
              <Card style={{ padding: 24 }}>
                <Text variant="body" color="ink-2">Este comedor no se puede reportar.</Text>
                <Link to="/" style={{ textDecoration: 'none' }}>
                  <Button type="button" variant="secondary" style={{ marginTop: 16 }}>Volver</Button>
                </Link>
              </Card>
            )}
          </>
        )}
      </AsyncSection>
    </div>
  );
}
