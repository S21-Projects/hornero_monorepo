import { useState } from 'react';
import { Badge } from '../Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Text } from '../ui/Typography';
import { useAuditarEvidencia } from '../../lib/hooks/useAcreditacion';
import { EvidenciaArchivo } from './EvidenciaArchivo';
import type { RequisitoAcreditacion, RequisitoEnLegajo } from '../../types/domain';

const ESTADO_TONE: Record<string, 'danger' | 'ok' | 'sky' | 'neutral'> = {
  APROBADA: 'ok',
  OBSERVADA: 'danger',
  PENDIENTE: 'sky',
  FALTANTE: 'neutral',
  VENCIDA: 'danger',
};

interface AuditQueueProps {
  organizacionId: number;
  requisitos: RequisitoEnLegajo[];
  /** Evidence row id per requisito — needed by aprobar/observar, absent for FALTANTE rows. */
  evidenciaIds: Partial<Record<RequisitoAcreditacion, number>>;
  /**
   * `objectKey` per requisito (AD-12) — only known for the rows the caller separately fetched
   * (today: PENDIENTE, via `useEvidenciasPendientes`). Absent means "render nothing", not
   * "unavailable" — a requisito with no known objectKey never reaches `EvidenciaArchivo`.
   */
  evidenciaObjectKeys?: Partial<Record<RequisitoAcreditacion, string | null>>;
}

/**
 * Admin evidence-audit list: approve/observe per requisito, with an
 * `expirada` warning. Deliberately renders NO level-change control — raising
 * or lowering a level lives only in `NivelPanel` (see spec's "separate admin
 * actions" note, task 4.7).
 */
export function AuditQueue({
  organizacionId,
  requisitos,
  evidenciaIds,
  evidenciaObjectKeys = {},
}: AuditQueueProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Text variant="title">Cola de auditoría de evidencia</Text>
      {requisitos.map((r) => (
        <AuditRow
          key={r.requisito}
          organizacionId={organizacionId}
          requisito={r}
          evidenciaId={evidenciaIds[r.requisito]}
          objectKey={evidenciaObjectKeys[r.requisito]}
        />
      ))}
    </div>
  );
}

function AuditRow({
  organizacionId,
  requisito,
  evidenciaId,
  objectKey,
}: {
  organizacionId: number;
  requisito: RequisitoEnLegajo;
  evidenciaId?: number;
  objectKey?: string | null;
}) {
  const [showObservar, setShowObservar] = useState(false);
  const [observacion, setObservacion] = useState('');
  const auditar = useAuditarEvidencia();
  const tone = ESTADO_TONE[requisito.estado] ?? 'neutral';

  async function aprobar() {
    if (!evidenciaId) return;
    try {
      await auditar.mutateAsync({ organizacionId, evidenciaId, accion: 'aprobar' });
    } catch (err) {
      void err; // surfaced below via auditar.error
    }
  }

  async function observar() {
    if (!evidenciaId) return;
    try {
      await auditar.mutateAsync({ organizacionId, evidenciaId, accion: 'observar', observacion });
      setShowObservar(false);
      setObservacion('');
    } catch (err) {
      void err; // surfaced below via auditar.error
    }
  }

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text variant="body">{requisito.requisito}</Text>
          <Badge tone={tone} label={requisito.estado === 'VENCIDA' ? 'Vencida' : requisito.estado} />
          {requisito.expirada && requisito.estado !== 'VENCIDA' && <Badge tone="danger" label="Vencida" />}
          {requisito.graciaVencida && <Badge tone="danger" label="Gracia vencida" />}
        </div>

        {requisito.estado === 'PENDIENTE' && evidenciaId != null && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="button"
              variant="ok"
              size="sm"
              loading={auditar.isPending && auditar.variables?.accion === 'aprobar'}
              onClick={() => { void aprobar(); }}
            >
              Aprobar
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setShowObservar((v) => !v)}
            >
              Observar
            </Button>
          </div>
        )}
      </div>

      {requisito.declaracion && (
        <Text variant="body-sm" color="ink-2" style={{ marginTop: 8 }}>{requisito.declaracion}</Text>
      )}

      {(requisito.tipoEvidencia === 'FOTO' || requisito.tipoEvidencia === 'DOCUMENTO') &&
        objectKey !== undefined && (
          <div style={{ marginTop: 8 }}>
            <EvidenciaArchivo
              organizacionId={organizacionId}
              objectKey={objectKey}
              tipoEvidencia={requisito.tipoEvidencia}
            />
          </div>
        )}

      {showObservar && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          <label htmlFor={`observacion-${requisito.requisito}`}>
            <Text as="span" variant="label" color="ink-2">Motivo de la observación</Text>
          </label>
          <textarea
            id={`observacion-${requisito.requisito}`}
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={2}
            style={{ padding: '10px 12px', borderRadius: 'var(--r-input)', border: '1.5px solid var(--line)', fontFamily: 'inherit' }}
          />
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={auditar.isPending && auditar.variables?.accion === 'observar'}
            onClick={() => { void observar(); }}
          >
            Confirmar observación
          </Button>
        </div>
      )}

      {auditar.isError && (
        <Text variant="body-sm" color="urgent" style={{ marginTop: 8 }}>
          No se pudo registrar la auditoría.
        </Text>
      )}
    </Card>
  );
}
