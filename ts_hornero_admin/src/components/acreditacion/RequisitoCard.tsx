import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Badge } from '../Badge';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import { EvidenciaForm } from './EvidenciaForm';
import { EvidenciaArchivo } from './EvidenciaArchivo';
import {
  formatDiaMes,
  formatFechaCompleta,
  requisitoHint,
  requisitoLabel,
} from '../../lib/acreditacion';
import type { BadgeTone } from '../../lib/domain-ui';
import type { RequisitoEnLegajo, TipoEvidencia } from '../../types/domain';

interface EstadoDisplay {
  tone: BadgeTone;
  label: string;
  style?: CSSProperties;
}

const WARN_STYLE: CSSProperties = { background: 'var(--warn-bg)', color: 'var(--warn-tx)' };

const ESTADO_DISPLAY: Record<string, EstadoDisplay> = {
  FALTANTE: { tone: 'neutral', label: 'Sin enviar' },
  PENDIENTE: { tone: 'neutral', label: 'Pendiente de auditoría', style: WARN_STYLE },
  APROBADA: { tone: 'ok', label: 'Aprobada' },
  OBSERVADA: { tone: 'danger', label: 'Observada' },
};

const VENCIDA: EstadoDisplay = { tone: 'danger', label: 'Vencida' };

/** RN-04: expired by date, or already moved to VENCIDA by the daily job. */
const esVencida = (r: RequisitoEnLegajo) => r.expirada || r.estado === 'VENCIDA';

/** An expired requisito no longer counts, whatever its stored estado says. */
function estadoDisplay(requisito: RequisitoEnLegajo): EstadoDisplay {
  if (esVencida(requisito)) return VENCIDA;
  return ESTADO_DISPLAY[requisito.estado] ?? { tone: 'neutral', label: requisito.estado };
}

/** "Foto enviada" / "Documento enviado" ... plus the matching pronoun for "revisándola/lo". */
function enviada(tipo: TipoEvidencia | null | undefined): { sujeto: string; pronombre: string } {
  switch (tipo) {
    case 'FOTO':
      return { sujeto: 'Foto enviada', pronombre: 'la' };
    case 'DOCUMENTO':
      return { sujeto: 'Documento enviado', pronombre: 'lo' };
    case 'DECLARACION':
      return { sujeto: 'Declaración enviada', pronombre: 'la' };
    default:
      return { sujeto: 'Evidencia enviada', pronombre: 'la' };
  }
}

/** The single muted line under the title, per estado. Omits any date the legajo does not carry. */
function lineaEstado(r: RequisitoEnLegajo, hint: string): string | null {
  if (esVencida(r)) {
    const hasta = formatFechaCompleta(r.validoHasta);
    const venció = hasta ? `Venció el ${hasta}.` : 'Venció.';
    const gracia = formatFechaCompleta(r.graciaHasta);
    if (r.graciaVencida) {
      return `${venció} Ya terminó el plazo de gracia: renová la evidencia y un administrador puede revisar tu nivel.`;
    }
    if (gracia) {
      return `${venció} Tu nivel no cambia por ahora: tenés hasta el ${gracia} para renovar la evidencia.`;
    }
    return `${venció} Tenés que renovar la evidencia.`;
  }
  switch (r.estado) {
    case 'APROBADA': {
      const el = formatDiaMes(r.auditadoEn);
      const hasta = formatFechaCompleta(r.validoHasta);
      return ['Aprobada' + (el ? ` el ${el}` : ''), hasta ? `vigente hasta ${hasta}` : null]
        .filter(Boolean)
        .join(' · ');
    }
    case 'PENDIENTE': {
      const { sujeto, pronombre } = enviada(r.tipoEvidencia);
      const el = formatDiaMes(r.cargadoEn);
      return `${sujeto}${el ? ` el ${el}` : ''} · un administrador ${pronombre} está revisando`;
    }
    case 'FALTANTE':
      return hint ? `Qué cargar: ${hint}` : null;
    default:
      return null;
  }
}

interface RequisitoCardProps {
  organizacionId: number;
  requisito: RequisitoEnLegajo;
  /** Locked requisitos (a level above the next one) are read-only: no submit entry point. */
  locked?: boolean;
}

export function RequisitoCard({ organizacionId, requisito, locked = false }: RequisitoCardProps) {
  const [showForm, setShowForm] = useState(false);
  // Remembers the estado the evidence was submitted from, so the optimistic "pending" look only
  // lasts until the legajo refetch (or an admin decision) moves the requisito on.
  const [sentFrom, setSentFrom] = useState<string | null>(null);

  const firma = `${requisito.estado}:${requisito.expirada}`;
  const optimisticPending = sentFrom === firma;
  const justSent = sentFrom !== null && (optimisticPending || requisito.estado === 'PENDIENTE');

  // Only FALTANTE, OBSERVADA and expired requisitos are (re)submittable. PENDIENTE waits on an
  // admin and APROBADA is done, so neither offers a form (and an open one is not rendered).
  const canSubmit =
    !locked &&
    !optimisticPending &&
    (requisito.estado === 'FALTANTE' || requisito.estado === 'OBSERVADA' || esVencida(requisito));
  const formVisible = canSubmit && showForm;
  const display = optimisticPending ? ESTADO_DISPLAY.PENDIENTE : estadoDisplay(requisito);
  const hint = requisitoHint(requisito.requisito);
  const observada = requisito.estado === 'OBSERVADA' && !requisito.expirada && !optimisticPending;
  const faltante = requisito.estado === 'FALTANTE' && !requisito.expirada && !optimisticPending;

  const linea = optimisticPending
    ? 'Un administrador la va a revisar.'
    : formVisible && faltante
      ? null // the open form already shows the hint
      : lineaEstado(requisito, hint);

  const actionLabel = esVencida(requisito)
    ? 'Renovar evidencia'
    : requisito.estado === 'OBSERVADA'
      ? 'Reenviar evidencia'
      : 'Enviar evidencia';

  const tieneArchivo =
    (requisito.tipoEvidencia === 'FOTO' || requisito.tipoEvidencia === 'DOCUMENTO') &&
    !!requisito.objectKey &&
    requisito.estado !== 'FALTANTE';

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 'var(--r-input)',
        background: 'var(--card)',
        border: formVisible
          ? '2px solid var(--horn)'
          : faltante
            ? '1.5px dashed var(--line)'
            : '1.5px solid var(--line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0, flex: '1 1 240px' }}>
          {tieneArchivo && !optimisticPending && (
            <EvidenciaArchivo
              organizacionId={organizacionId}
              objectKey={requisito.objectKey}
              tipoEvidencia={requisito.tipoEvidencia as TipoEvidencia}
              size="thumbnail"
            />
          )}
          <div style={{ minWidth: 0 }}>
            <Text variant="title">{requisitoLabel(requisito.requisito)}</Text>
            {linea && (
              <Text variant="body-sm" color="ink-2" style={{ marginTop: 2 }}>{linea}</Text>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge tone={display.tone} label={display.label} style={display.style} />
          {canSubmit && !formVisible && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              style={{ minHeight: 44 }}
              onClick={() => {
                setSentFrom(null);
                setShowForm(true);
              }}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </div>

      {observada && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--card-2)',
            borderLeft: '3px solid var(--urgent)',
          }}
        >
          <Text variant="label" color="urgent">Qué pidió el administrador</Text>
          <Text variant="body-sm" style={{ marginTop: 2 }}>
            {requisito.observacion?.trim() ||
              'Un administrador observó esta evidencia. Revisala y volvé a enviarla.'}
          </Text>
        </div>
      )}

      {requisito.declaracion && requisito.estado !== 'FALTANTE' && !optimisticPending && (
        <Text variant="body-sm" color="ink-2" style={{ marginTop: 8 }}>{requisito.declaracion}</Text>
      )}

      {justSent && (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--ok-bg)',
            border: '1px solid var(--ok)',
          }}
        >
          <Text variant="body-sm" color="ok">
            Evidencia enviada. Un administrador la va a revisar.
          </Text>
        </div>
      )}

      {formVisible && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <EvidenciaForm
            organizacionId={organizacionId}
            requisito={requisito.requisito}
            onCancel={() => setShowForm(false)}
            onSubmitted={() => {
              setShowForm(false);
              setSentFrom(firma);
            }}
          />
        </div>
      )}
    </div>
  );
}
