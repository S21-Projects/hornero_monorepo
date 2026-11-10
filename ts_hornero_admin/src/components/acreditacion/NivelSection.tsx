import { useState } from 'react';
import { Lock, TickCircle } from 'iconsax-reactjs';
import { Badge } from '../Badge';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import { RequisitoCard } from './RequisitoCard';
import { nivelRank, nivelTitulo } from '../../lib/acreditacion';
import type { NivelRequisitos } from '../../lib/acreditacion';
import type { NivelAcreditacion, RequisitoEnLegajo } from '../../types/domain';

interface NivelSectionProps {
  organizacionId: number;
  nivel: NivelRequisitos;
  /** The organization's current accreditation nivel. */
  nivelActual: NivelAcreditacion;
  requisitos: RequisitoEnLegajo[];
}

const isAprobada = (r: RequisitoEnLegajo) => r.estado === 'APROBADA' && !r.expirada;

const LISTA_STYLE = { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 } as const;

/**
 * One nivel's requisitos, in one of three modes relative to the current nivel: reached
 * (compact "Completado", collapsible), next ("Próximo nivel": expanded, with progress and the
 * submit entry points) or locked (compact, read-only list behind "Ver requisitos").
 */
export function NivelSection({ organizacionId, nivel, nivelActual, requisitos }: NivelSectionProps) {
  const rank = nivelRank(nivel);
  const actual = nivelRank(nivelActual);
  const mode = rank <= actual ? 'alcanzado' : rank === actual + 1 ? 'proximo' : 'bloqueado';

  const total = requisitos.length;
  const aprobados = requisitos.filter(isAprobada).length;
  // A reached nivel collapses only while everything in it is still approved; an expired or
  // observed requisito keeps it open so the referente sees what needs attention.
  const [expanded, setExpanded] = useState(mode === 'proximo' || (mode === 'alcanzado' && aprobados < total));
  const listo = mode === 'proximo' && total > 0 && aprobados === total;
  const titulo = nivelTitulo(nivel);
  const conteo = `${aprobados} de ${total} requisitos aprobados`;

  const toggle = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
    >
      {expanded ? 'Ocultar' : 'Ver requisitos'}
    </Button>
  );

  if (mode === 'bloqueado') {
    return (
      <Card as="section" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Lock size={22} variant="Bold" color="var(--ink-3)" aria-hidden="true" />
            <div>
              <Text as="h2" variant="title">{titulo}</Text>
              <Text variant="body-sm" color="ink-3">
                {total} {total === 1 ? 'requisito' : 'requisitos'} · se habilita cuando alcances N{rank - 1}
              </Text>
            </div>
          </div>
          {toggle}
        </div>
        {expanded && (
          <div style={LISTA_STYLE}>
            {requisitos.map((r) => (
              <RequisitoCard key={r.requisito} organizacionId={organizacionId} requisito={r} locked />
            ))}
          </div>
        )}
      </Card>
    );
  }

  if (mode === 'alcanzado') {
    return (
      <Card as="section" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text as="h2" variant="title">{titulo}</Text>
            <Badge tone="ok" label="Completado" />
            <Text variant="caption" color="ink-3">{conteo}</Text>
          </div>
          {toggle}
        </div>
        {expanded && (
          <div style={LISTA_STYLE}>
            {requisitos.map((r) => (
              <RequisitoCard key={r.requisito} organizacionId={organizacionId} requisito={r} />
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card as="section" style={{ padding: 16, border: '2px solid var(--horn)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Badge
            tone="neutral"
            label="PRÓXIMO NIVEL"
            style={{ background: 'var(--horn)', color: '#fff', letterSpacing: '0.04em' }}
          />
          <Text as="h2" variant="h2">{titulo}</Text>
        </div>
        {!listo && <Text variant="body-sm" color="ink-2">{conteo}</Text>}
      </div>

      {listo && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 'var(--r-input)',
            border: '2px solid var(--ok)',
            background: 'var(--ok-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TickCircle size={22} variant="Bold" color="var(--ok)" aria-hidden="true" />
            <Text variant="title" color="ok">Completaste los requisitos de {nivel}</Text>
          </div>
          <Text variant="body-sm" style={{ marginTop: 4 }}>
            Los {total} requisitos están aprobados. Un administrador va a revisar tu legajo y subir tu nivel.
          </Text>
          <div
            role="progressbar"
            aria-label={`Progreso de ${nivel}`}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={aprobados}
            style={{ marginTop: 10, height: 6, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}
          >
            <div style={{ width: '100%', height: '100%', background: 'var(--ok)' }} />
          </div>
          <Text variant="caption" color="ink-2" style={{ marginTop: 6 }}>{conteo}</Text>
        </div>
      )}

      <div style={LISTA_STYLE}>
        {requisitos.map((r) => (
          <RequisitoCard key={r.requisito} organizacionId={organizacionId} requisito={r} />
        ))}
      </div>
    </Card>
  );
}
