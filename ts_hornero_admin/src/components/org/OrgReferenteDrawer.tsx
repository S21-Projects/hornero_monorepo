import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../Badge';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { Drawer } from '../ui/Drawer';
import { Text } from '../ui/Typography';
import { InfoPublicaForm } from './InfoPublicaForm';
import { useAsignarReferente } from '../../lib/hooks/useAsignarReferente';
import { useAdminInfoPublica } from '../../lib/hooks/useAdminInfoPublica';
import { mapAsignarReferenteError } from '../../lib/hooks/mapAsignarReferenteError';
import { mapInfoPublicaError } from '../../lib/hooks/mapInfoPublicaError';
import { ESTADO_ORGANIZACION, TIPO_ORGANIZACION } from '../../lib/domain-ui';
import type { OrganizacionAdmin, Usuario } from '../../types/domain';

export const UNASSIGNED_VALUE = 'unassigned';

export type OrgDrawerTab = 'asignacion' | 'info' | 'legajo';

interface OrgReferenteDrawerProps {
  org: OrganizacionAdmin;
  referentesActivos: Usuario[];
  initialTab: OrgDrawerTab;
  onClose: () => void;
  /** The server returned a fresh copy of the org after a mutation. */
  onOrgChange: (org: OrganizacionAdmin) => void;
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text variant="label" color="ink-3" as="div">{label}</Text>
      <Text variant="body" as="div">{children}</Text>
    </div>
  );
}

const yesNo = (v: boolean | null | undefined) => (v ? 'Recibe donaciones' : 'No indica recibir donaciones');

function DiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  const changed = before !== after;
  return (
    <>
      <Text variant="body-sm" color="ink-3" as="span">{label}</Text>
      <Text variant="body-sm" color="ink-3" as="span" style={{ textDecoration: changed ? 'line-through' : undefined }}>
        {before}
      </Text>
      <Text variant="body-sm" as="span" style={{ fontWeight: changed ? 700 : undefined, color: changed ? 'var(--ok)' : undefined }}>
        {after}
      </Text>
    </>
  );
}

/** Per-organization detail: referente assignment, info pública review and a read-only legajo summary. */
export function OrgReferenteDrawer({ org, referentesActivos, initialTab, onClose, onOrgChange }: OrgReferenteDrawerProps) {
  const asignar = useAsignarReferente();
  const { aprobar, rechazar } = useAdminInfoPublica();
  const [tab, setTab] = useState<OrgDrawerTab>(initialTab);
  const [draft, setDraft] = useState(String(org.referenteId ?? UNASSIGNED_VALUE));
  const [saved, setSaved] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const hasPending = org.infoPublicaPendienteEn != null;
  const estado = ESTADO_ORGANIZACION[org.estado] ?? { tone: 'neutral' as const, label: org.estado };
  const tipo = TIPO_ORGANIZACION[org.tipo]?.label ?? org.tipo;
  const currentValue = String(org.referenteId ?? UNASSIGNED_VALUE);
  const ocupado = asignar.isPending || aprobar.isPending || rechazar.isPending;

  async function handleGuardar() {
    setSaved(false);
    try {
      const updated = await asignar.mutateAsync({
        organizacionId: org.id,
        referenteId: draft === UNASSIGNED_VALUE ? null : Number(draft),
      });
      onOrgChange(updated);
      setSaved(true);
    } catch (err) {
      void err; // surfaced in the body
    }
  }

  async function handleAprobar() {
    try {
      onOrgChange(await aprobar.mutateAsync(org.id));
    } catch (err) {
      void err; // surfaced in the body
    }
  }

  async function handleRechazar() {
    if (!motivo.trim()) return;
    try {
      onOrgChange(await rechazar.mutateAsync(org.id));
      setRechazando(false);
      setMotivo('');
    } catch (err) {
      void err; // surfaced in the body
    }
  }

  let footer: React.ReactNode = null;
  if (tab === 'asignacion') {
    footer = (
      <>
        <Button type="button" variant="secondary" disabled={ocupado} onClick={onClose}>Cancelar</Button>
        <Button type="button" variant="primary" loading={asignar.isPending}
          disabled={ocupado || draft === currentValue} onClick={() => { void handleGuardar(); }}>
          Guardar asignación
        </Button>
      </>
    );
  } else if (tab === 'info' && hasPending && rechazando) {
    footer = (
      <>
        <Button type="button" variant="secondary" disabled={ocupado} onClick={() => { setRechazando(false); setMotivo(''); }}>
          Volver
        </Button>
        <Button type="button" variant="danger" loading={rechazar.isPending}
          disabled={ocupado || !motivo.trim()} onClick={() => { void handleRechazar(); }}>
          Confirmar rechazo
        </Button>
      </>
    );
  } else if (tab === 'info' && hasPending) {
    footer = (
      <>
        <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setRechazando(true)}>Rechazar</Button>
        <Button type="button" variant="ok" loading={aprobar.isPending} disabled={ocupado}
          onClick={() => { void handleAprobar(); }}>
          Aprobar cambios
        </Button>
      </>
    );
  } else if (tab === 'legajo') {
    footer = (
      <Link to={`/organizaciones/${org.id}/legajo`}>
        <Button type="button" variant="primary">Abrir legajo y auditar</Button>
      </Link>
    );
  }

  const infoError = aprobar.error ?? rechazar.error;

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Organización"
      title={org.nombre}
      status={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge tone={estado.tone} label={estado.label} />
          <Text variant="body-sm" color="ink-3">{tipo}{org.direccion ? ` · ${org.direccion}` : ''}</Text>
        </div>
      )}
      tabs={[
        { id: 'asignacion', label: 'Asignación' },
        { id: 'info', label: 'Info pública', badge: hasPending ? 'tiene cambios pendientes' : undefined },
        { id: 'legajo', label: 'Legajo' },
      ]}
      activeTab={tab}
      onTabChange={(id) => { setTab(id as OrgDrawerTab); setRechazando(false); }}
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tab === 'asignacion' && (
          <>
            <div>
              <Text variant="label" color="ink-2" as="div" id={`referente-label-${org.id}`} style={{ marginBottom: 6 }}>
                Referente asignado
              </Text>
              <Dropdown
                value={draft}
                disabled={asignar.isPending}
                onChange={(v) => { setDraft(v); setSaved(false); }}
                style={{ width: '100%' }}
                options={[
                  { value: UNASSIGNED_VALUE, label: 'Sin referente' },
                  ...referentesActivos.map((r) => ({ value: String(r.id), label: `${r.nombre} (${r.email})` })),
                ]}
              />
              <Text variant="micro" color="ink-3" style={{ display: 'block', marginTop: 6 }}>
                Solo referentes activos. El referente podrá publicar necesidades y gestionar donaciones de esta organización.
              </Text>
            </div>
            <Dato label="Tipo">{tipo}</Dato>
            <Dato label="Dirección">{org.direccion || '—'}</Dato>
            <Dato label="Estado">{estado.label}</Dato>
            {asignar.isError && <Text variant="body-sm" color="urgent">{mapAsignarReferenteError(asignar.error)}</Text>}
            {saved && !asignar.isError && <Text variant="body-sm" color="ok" role="status">Asignación guardada.</Text>}
          </>
        )}

        {tab === 'info' && hasPending && (
          <>
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--card-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Text variant="label" color="ink-3" as="div">
                Cambios propuestos{org.referenteNombre ? ` por ${org.referenteNombre}` : ''}
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) minmax(0,1fr)', gap: '6px 12px' }}>
                <span />
                <Text variant="label" color="ink-3" as="span">Antes</Text>
                <Text variant="label" color="ink-3" as="span">Ahora</Text>
                <DiffRow label="Donaciones" before={yesNo(org.aceptaDonaciones)} after={yesNo(org.aceptaDonacionesPendiente)} />
                <DiffRow label="Sitio web" before={org.sitioWebUrl || '—'} after={org.sitioWebUrlPendiente || '—'} />
                <DiffRow label="Donación directa" before={org.donacionDirectaUrl || '—'} after={org.donacionDirectaUrlPendiente || '—'} />
              </div>
            </div>
            {rechazando && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor={`motivo-info-${org.id}`}>
                  <Text as="span" variant="label" color="ink-2">Motivo del rechazo (se le envía al referente)</Text>
                </label>
                <textarea
                  id={`motivo-info-${org.id}`}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Ej.: el enlace de donación no coincide con lo informado en el legajo"
                  style={{
                    padding: '12px 14px', borderRadius: 'var(--r-input)', border: '1.5px solid var(--line)',
                    fontSize: 14.5, width: '100%', fontFamily: 'inherit', resize: 'vertical',
                  }}
                />
              </div>
            )}
            {infoError && <Text variant="body-sm" color="urgent">{mapInfoPublicaError(infoError)}</Text>}
          </>
        )}

        {tab === 'info' && !hasPending && <InfoPublicaForm org={org} mode="admin" />}

        {tab === 'legajo' && (
          <>
            <Dato label="Referente">{org.referenteNombre ?? 'Sin asignar'}</Dato>
            {org.referenteEmail && <Dato label="Email del referente">{org.referenteEmail}</Dato>}
            <Dato label="Dirección">{org.direccion || '—'}</Dato>
            <Dato label="Validada por">{org.validadoPorNombre ?? '—'}</Dato>
            <Dato label="Información pública">{yesNo(org.aceptaDonaciones)}</Dato>
            <Text variant="body-sm" color="ink-3">
              El nivel de acreditación y los requisitos se revisan en el legajo completo.
            </Text>
          </>
        )}
      </div>
    </Drawer>
  );
}
