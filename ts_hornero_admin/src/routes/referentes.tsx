import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown2, ArrowUp2 } from 'iconsax-reactjs';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dropdown } from '../components/ui/Dropdown';
import { Text } from '../components/ui/Typography';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { useTodasOrganizaciones } from '../lib/hooks/useTodasOrganizaciones';
import { useAsignarReferente } from '../lib/hooks/useAsignarReferente';
import { useAdminInfoPublica } from '../lib/hooks/useAdminInfoPublica';
import { mapAsignarReferenteError } from '../lib/hooks/mapAsignarReferenteError';
import { mapInfoPublicaError } from '../lib/hooks/mapInfoPublicaError';
import { ESTADO_ORGANIZACION } from '../lib/domain-ui';
import { InfoPublicaForm } from '../components/org/InfoPublicaForm';
import type { OrganizacionAdmin, Usuario } from '../types/domain';

const UNASSIGNED_VALUE = 'unassigned';

interface OrgRowProps {
  org: OrganizacionAdmin;
  referentesActivos: Usuario[];
}

function OrgRow({ org, referentesActivos }: OrgRowProps) {
  const asignar = useAsignarReferente();
  const { aprobar, rechazar } = useAdminInfoPublica();
  const [showInfoPublica, setShowInfoPublica] = useState(false);
  const estadoConfig = ESTADO_ORGANIZACION[org.estado] ?? { tone: 'neutral' as const, label: org.estado };
  const isMutatingThis = asignar.isPending && asignar.variables?.organizacionId === org.id;
  const isErrorForThis = asignar.isError && asignar.variables?.organizacionId === org.id;
  const hasPending = org.infoPublicaPendienteEn != null;

  function handleChange(value: string) {
    const referenteId = value === UNASSIGNED_VALUE ? null : Number(value);
    asignar.mutate({ organizacionId: org.id, referenteId });
  }

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text variant="body">{org.nombre}</Text>
          <Badge tone={estadoConfig.tone} label={estadoConfig.label} />
          {hasPending && <Badge tone="sky" label="Info pública pendiente" />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Dropdown
            value={String(org.referenteId ?? UNASSIGNED_VALUE)}
            disabled={isMutatingThis}
            onChange={handleChange}
            options={[
              { value: UNASSIGNED_VALUE, label: 'Sin referente' },
              ...referentesActivos.map((r) => ({ value: String(r.id), label: `${r.nombre} (${r.email})` })),
            ]}
          />

          {hasPending && (
            <>
              <Button
                type="button"
                variant="ok"
                size="sm"
                loading={aprobar.isPending && aprobar.variables === org.id}
                onClick={() => aprobar.mutate(org.id)}
              >
                Aprobar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={rechazar.isPending && rechazar.variables === org.id}
                onClick={() => rechazar.mutate(org.id)}
              >
                Rechazar
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowInfoPublica((v) => !v)}
            style={{ gap: 6 }}
          >
            {showInfoPublica ? 'Cerrar' : 'Editar info pública'}
            {showInfoPublica ? <ArrowUp2 size={14} /> : <ArrowDown2 size={14} />}
          </Button>
        </div>
      </div>

      {isErrorForThis && (
        <Text variant="micro" color="urgent" style={{ display: 'block', textAlign: 'right', marginTop: 4 }}>
          {mapAsignarReferenteError(asignar.error)}
        </Text>
      )}
      {(aprobar.isError || rechazar.isError) && (
        <Text variant="micro" color="urgent" style={{ display: 'block', textAlign: 'right', marginTop: 4 }}>
          {mapInfoPublicaError(aprobar.error ?? rechazar.error)}
        </Text>
      )}

      <AnimatePresence initial={false}>
        {showInfoPublica && (
          <motion.div
            key="info-publica"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
              <InfoPublicaForm org={org} mode="admin" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ReferentesPage() {
  const usuariosQuery = useUsuarios();
  const orgsQuery = useTodasOrganizaciones();

  const isLoading = usuariosQuery.isLoading || orgsQuery.isLoading;
  const isError = usuariosQuery.isError || orgsQuery.isError;

  const referentes = (usuariosQuery.data ?? []).filter((u) => u.tipo === 'REFERENTE');
  const referentesActivos = referentes.filter((r) => r.activo);
  const orgs = orgsQuery.data ?? [];

  const orgsPorReferente = new Map<number, OrganizacionAdmin[]>();
  const sinReferente: OrganizacionAdmin[] = [];
  for (const org of orgs) {
    if (org.referenteId == null) {
      sinReferente.push(org);
      continue;
    }
    const bucket = orgsPorReferente.get(org.referenteId) ?? [];
    bucket.push(org);
    orgsPorReferente.set(org.referenteId, bucket);
  }

  return (
    <div>
      <Text variant="h1">Referentes y organizaciones</Text>
      <Text variant="body-sm" color="ink-3" style={{ marginTop: 4, marginBottom: 20 }}>
        Reasigná una organización a otro referente activo, o dejala sin referente.
      </Text>

      <AsyncSection isLoading={isLoading} isError={isError} isEmpty={referentes.length === 0 && orgs.length === 0}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {referentes.map((referente) => {
            const misOrgs = orgsPorReferente.get(referente.id) ?? [];
            return (
              <Card key={referente.id} style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <Text variant="title">{referente.nombre}</Text>
                  <Text variant="body-sm" color="ink-3">{referente.email}</Text>
                  {!referente.activo && <Badge tone="neutral" label="Inactivo" />}
                </div>

                {misOrgs.length === 0 ? (
                  <Text variant="body-sm" color="ink-3">No maneja ninguna organización.</Text>
                ) : (
                  misOrgs.map((org) => (
                    <OrgRow key={org.id} org={org} referentesActivos={referentesActivos} />
                  ))
                )}
              </Card>
            );
          })}

          <Card style={{ padding: 20, border: '1.5px dashed var(--line)' }}>
            <Text variant="title" color="urgent" style={{ marginBottom: 8 }}>
              Sin referente ({sinReferente.length})
            </Text>
            {sinReferente.length === 0 ? (
              <Text variant="body-sm" color="ink-3">No hay organizaciones sin referente.</Text>
            ) : (
              sinReferente.map((org) => (
                <OrgRow key={org.id} org={org} referentesActivos={referentesActivos} />
              ))
            )}
          </Card>
        </div>
      </AsyncSection>
    </div>
  );
}
