import { useState } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Select } from '../components/ui/Select';
import { PageHeader } from '../components/ui/PageHeader';
import { NivelEscalera } from '../components/acreditacion/NivelEscalera';
import { NivelSection } from '../components/acreditacion/NivelSection';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useLegajo } from '../lib/hooks/useAcreditacion';
import { NIVELES_REQUISITOS } from '../lib/acreditacion';

/**
 * Referente-facing accreditation view: the nivel ladder plus the requisitos grouped by nivel
 * (reached / next / locked), each with its submit/resubmit entry point. Kept structurally
 * separate from `/mis-organizaciones`' info-pública editing — the
 * self-edit pending snapshot and accreditation evidence never share UI
 * (organizacion-self-edit spec delta).
 */
export default function AcreditacionPage() {
  const misOrganizaciones = useMisOrganizaciones();
  const orgs = misOrganizaciones.data ?? [];

  // Referentes owning >1 organización pick which one to manage; derived (not effect-set) so it
  // falls back to the first org if the selected one disappears from the list.
  const [explicitOrgId, setExplicitOrgId] = useState<number | null>(null);
  const org =
    (explicitOrgId != null ? orgs.find((o) => o.id === explicitOrgId) : undefined) ?? orgs[0];
  const legajo = useLegajo(org?.id);

  const isLoading = misOrganizaciones.isLoading || legajo.isLoading;
  const isError = misOrganizaciones.isError || legajo.isError;

  return (
    <div>
      <PageHeader
        title="Mi acreditación"
        description="Cargá la evidencia de tu organización para subir de nivel de acreditación."
        actions={
          orgs.length > 1 && org ? (
            <Select
              id="acreditacion-org"
              label="Organización"
              value={org.id}
              onChange={(e) => setExplicitOrgId(Number(e.target.value))}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </Select>
          ) : undefined
        }
      />

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        isEmpty={!org}
        emptyLabel="Todavía no tenés una organización registrada."
      >
        {legajo.data && org && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <NivelEscalera nivelActual={legajo.data.nivel} requisitos={legajo.data.requisitos} />
            {NIVELES_REQUISITOS.map((nivel) => {
              const requisitos = legajo.data.requisitos.filter((r) => r.nivelExigido === nivel);
              if (requisitos.length === 0) return null;
              return (
                <NivelSection
                  key={`${org.id}-${nivel}`}
                  organizacionId={org.id}
                  nivel={nivel}
                  nivelActual={legajo.data.nivel}
                  requisitos={requisitos}
                />
              );
            })}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
