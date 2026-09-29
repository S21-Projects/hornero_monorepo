import { useParams } from 'react-router-dom';
import { AsyncSection } from '../components/AsyncSection';
import { Card } from '../components/ui/Card';
import { Text } from '../components/ui/Typography';
import { NivelBadge } from '../components/acreditacion/NivelBadge';
import { NivelPanel } from '../components/acreditacion/NivelPanel';
import { AuditQueue } from '../components/acreditacion/AuditQueue';
import { useEvidenciasPendientes, useLegajo } from '../lib/hooks/useAcreditacion';
import { useAuthStore } from '../store/auth.store';
import { formatFecha } from '../lib/format';
import type { RequisitoAcreditacion } from '../types/domain';

/** Print stylesheet (task 4.12): hides admin-only controls, keeps the dossier itself printable. */
const PRINT_STYLES = `
  @media print {
    .legajo-no-print { display: none !important; }
    .legajo-printable { max-width: none; }
  }
`;

const ESTADO_LABEL: Record<string, string> = {
  APROBADA: 'Aprobada',
  OBSERVADA: 'Observada',
  PENDIENTE: 'Pendiente',
  FALTANTE: 'Faltante',
};

export default function LegajoPage() {
  const { id } = useParams<{ id: string }>();
  const organizacionId = id ? Number(id) : undefined;
  const tipo = useAuthStore((s) => s.user?.tipo);

  const legajo = useLegajo(organizacionId);

  // Task 4b.6 (D-02): LegajoResponse's RequisitoEnLegajo carries no evidenciaId field (that's
  // the whole point of the separate audit-queue endpoint), so the id map AuditQueue needs is
  // built from the dedicated PENDIENTE-filtered read instead — only PENDIENTE rows ever render
  // approve/observe buttons, so no other estado needs to be represented here. The endpoint is
  // ADMINISTRADOR-only server-side (D-02, narrower than D-01), so it is only fetched for admins
  // — a referente viewing its own legajo never issues this request.
  const evidenciasPendientes = useEvidenciasPendientes(
    tipo === 'ADMINISTRADOR' ? organizacionId : undefined,
  );
  const evidenciaIds: Partial<Record<RequisitoAcreditacion, number>> = {};
  // AD-12 (task 2.22): objectKey per requisito, sourced from the same PENDIENTE-filtered read —
  // AuditQueue renders EvidenciaArchivo for FOTO/DOCUMENTO rows it knows an objectKey for.
  const evidenciaObjectKeys: Partial<Record<RequisitoAcreditacion, string | null>> = {};
  for (const evidencia of evidenciasPendientes.data ?? []) {
    evidenciaIds[evidencia.requisito] = evidencia.id;
    evidenciaObjectKeys[evidencia.requisito] = evidencia.objectKey;
  }

  return (
    <div className="legajo-printable" style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
      <style>{PRINT_STYLES}</style>

      <AsyncSection
        isLoading={legajo.isLoading}
        isError={legajo.isError}
        isEmpty={!legajo.data}
        emptyLabel="No se encontró el legajo."
      >
        {legajo.data && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <Text variant="h2">{legajo.data.nombre}</Text>
              <NivelBadge nivel={legajo.data.nivel} />
            </div>
            <Text variant="body-sm" color="ink-3">{legajo.data.direccion}</Text>
            <Text variant="body-sm" color="ink-3">
              Nivel vigente desde {formatFecha(legajo.data.nivelDesde)}
            </Text>

            <Card style={{ padding: 16, marginTop: 20 }}>
              <Text variant="title" style={{ marginBottom: 8 }}>Requisitos</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {legajo.data.requisitos.map((r) => (
                  <div
                    key={r.requisito}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)' }}
                  >
                    <Text variant="body-sm">{r.requisito}</Text>
                    <Text variant="body-sm" color="ink-3">
                      {ESTADO_LABEL[r.estado] ?? r.estado}
                      {r.expirada ? ' · Vencida' : ''}
                    </Text>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 16, marginTop: 16 }}>
              <Text variant="title" style={{ marginBottom: 8 }}>Historial de eventos</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {legajo.data.eventos.map((e, idx) => (
                  <div key={`${e.tipo}-${e.ocurridoEn}-${idx}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <Text variant="body-sm">{e.tipo} — {e.actorTipo}</Text>
                    <Text variant="micro" color="ink-3">{formatFecha(e.ocurridoEn)}{e.motivo ? ` · ${e.motivo}` : ''}</Text>
                  </div>
                ))}
              </div>
            </Card>

            <Text variant="micro" color="ink-3" style={{ marginTop: 16, display: 'block' }}>
              {legajo.data.disclosure}
            </Text>

            {tipo === 'ADMINISTRADOR' && (
              <div className="legajo-no-print" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
                <Card style={{ padding: 16 }}>
                  <NivelPanel organizacionId={legajo.data.organizacionId} nivelActual={legajo.data.nivel} />
                </Card>
                <Card style={{ padding: 16 }}>
                  <AuditQueue
                    organizacionId={legajo.data.organizacionId}
                    requisitos={legajo.data.requisitos}
                    evidenciaIds={evidenciaIds}
                    evidenciaObjectKeys={evidenciaObjectKeys}
                  />
                </Card>
              </div>
            )}
          </>
        )}
      </AsyncSection>
    </div>
  );
}
