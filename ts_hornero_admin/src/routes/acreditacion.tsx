import { useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { NivelBadge } from '../components/acreditacion/NivelBadge';
import { EvidenciaForm } from '../components/acreditacion/EvidenciaForm';
import { EvidenciaArchivo } from '../components/acreditacion/EvidenciaArchivo';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useLegajo } from '../lib/hooks/useAcreditacion';
import type { RequisitoEnLegajo } from '../types/domain';

const ESTADO_LABEL: Record<string, string> = {
  APROBADA: 'Aprobada',
  OBSERVADA: 'Observada',
  PENDIENTE: 'Pendiente de auditoría',
  FALTANTE: 'Sin enviar',
};

function RequisitoRow({ organizacionId, requisito }: { organizacionId: number; requisito: RequisitoEnLegajo }) {
  const [showForm, setShowForm] = useState(false);
  // Only FALTANTE and OBSERVADA are resubmittable — PENDIENTE/APROBADA rows
  // wait on an admin, or evidence-replacement semantics per the spec ("insert
  // of a new row plus a mark of the previous row as REEMPLAZADA").
  const canSubmit = requisito.estado === 'FALTANTE' || requisito.estado === 'OBSERVADA';

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Text variant="body">{requisito.requisito}</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text variant="micro" color="ink-3">{ESTADO_LABEL[requisito.estado] ?? requisito.estado}</Text>
          {requisito.expirada && <Text variant="micro" color="urgent">Vencida</Text>}
          {canSubmit && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cerrar' : requisito.estado === 'OBSERVADA' ? 'Reenviar' : 'Enviar evidencia'}
            </Button>
          )}
        </div>
      </div>

      {requisito.declaracion && (
        <Text variant="body-sm" color="ink-2" style={{ marginTop: 8 }}>{requisito.declaracion}</Text>
      )}

      {/* task 2.24 (AD-12 follow-up): render the authenticated evidence-file route for the
          referente's own FOTO/DOCUMENTO evidence, the same as AuditQueue and legajo.tsx. */}
      {(requisito.tipoEvidencia === 'FOTO' || requisito.tipoEvidencia === 'DOCUMENTO') &&
        requisito.objectKey && (
          <div style={{ marginTop: 8 }}>
            <EvidenciaArchivo
              organizacionId={organizacionId}
              objectKey={requisito.objectKey}
              tipoEvidencia={requisito.tipoEvidencia}
            />
          </div>
        )}

      {showForm && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <EvidenciaForm organizacionId={organizacionId} requisito={requisito.requisito} />
        </div>
      )}
    </Card>
  );
}

/**
 * Referente-facing accreditation view: current nivel and one row per
 * requisito with the submit/resubmit entry point. Kept structurally
 * separate from `/mis-organizaciones`' info-pública editing — the
 * self-edit pending snapshot and accreditation evidence never share UI
 * (organizacion-self-edit spec delta).
 */
export default function AcreditacionPage() {
  const misOrganizaciones = useMisOrganizaciones();
  const org = misOrganizaciones.data?.[0];
  const legajo = useLegajo(org?.id);

  const isLoading = misOrganizaciones.isLoading || legajo.isLoading;
  const isError = misOrganizaciones.isError || legajo.isError;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Text variant="h2">Mi acreditación</Text>
        {legajo.data && <NivelBadge nivel={legajo.data.nivel} />}
      </div>

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        isEmpty={!org}
        emptyLabel="Todavía no tenés una organización registrada."
      >
        {legajo.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {legajo.data.requisitos.map((r) => (
              <RequisitoRow key={r.requisito} organizacionId={org!.id} requisito={r} />
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
