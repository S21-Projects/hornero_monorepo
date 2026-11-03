import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown2, ArrowUp2 } from 'iconsax-reactjs';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dropdown } from '../components/ui/Dropdown';
import { Input } from '../components/ui/Input';
import { Pager } from '../components/ui/Pager';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { useOrganizacionesAdmin } from '../lib/hooks/useOrganizacionesAdmin';
import { usePageClamp } from '../lib/hooks/usePageClamp';
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

          <Link to={`/organizaciones/${org.id}/legajo`}>
            <Button type="button" variant="ghost" size="sm">
              Ver legajo / auditar acreditación
            </Button>
          </Link>
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

const DEFAULT_PAGE_SIZE = 10;
/** Max height of each list's scroll area: rows scroll, search and pager stay put. */
const LIST_SCROLL_STYLE: React.CSSProperties = {
  maxHeight: 'min(60vh, 560px)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '8px 4px',
  borderTop: '1px solid var(--line)',
  borderBottom: '1px solid var(--line)',
};
/** The MS caps a page at 100; one page of referentes (<= 50) holds at most 3 organizaciones each. */
const ORGS_REFERENTES_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;

/** The MS caps a page at 100: enough referentes to fill the reassignment dropdown. */
const REFERENTES_ACTIVOS_SIZE = 100;

export default function ReferentesPage() {
  const [page, setPage] = useState(0);
  const [refInput, setRefInput] = useState('');
  const [refQ, setRefQ] = useState('');
  const [sinPage, setSinPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sinPageSize, setSinPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const usuariosQuery = useUsuarios({ page, size: pageSize, tipo: 'REFERENTE', q: refQ });
  // Reassignment dropdown: active referentes regardless of the page/search above.
  const activosQuery = useUsuarios({ page: 0, size: REFERENTES_ACTIVOS_SIZE, tipo: 'REFERENTE', activo: true });

  usePageClamp(page, setPage, usuariosQuery.data?.totalPages);
  const usuariosPage = usuariosQuery.data;
  const referentes = usuariosPage?.content ?? [];
  const referentesActivos = activosQuery.data?.content ?? [];

  // Organizaciones of the referentes on this page, in one bounded request.
  const referenteIds = referentes.map((r) => r.id);
  const orgsReferentesQuery = useOrganizacionesAdmin(
    { page: 0, size: ORGS_REFERENTES_SIZE, referenteIds },
    { enabled: referenteIds.length > 0 },
  );
  const orgsPorReferente = new Map<number, OrganizacionAdmin[]>();
  for (const org of orgsReferentesQuery.data?.content ?? []) {
    if (org.referenteId == null) continue;
    const bucket = orgsPorReferente.get(org.referenteId) ?? [];
    bucket.push(org);
    orgsPorReferente.set(org.referenteId, bucket);
  }

  // Debounce the referente search into the server `q` param; back to page 0 when it changes.
  useEffect(() => {
    const handle = setTimeout(() => {
      setRefQ(refInput.trim());
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [refInput]);

  // Same for the organization search of the "Sin referente" card.
  useEffect(() => {
    const handle = setTimeout(() => {
      setQ(qInput.trim());
      setSinPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [qInput]);

  const sinQuery = useOrganizacionesAdmin({ page: sinPage, size: sinPageSize, sinReferente: true, q });
  usePageClamp(sinPage, setSinPage, sinQuery.data?.totalPages);
  const sinReferente = sinQuery.data?.content ?? [];

  const isLoading = usuariosQuery.isLoading || (referenteIds.length > 0 && orgsReferentesQuery.isLoading);
  const isError = usuariosQuery.isError || orgsReferentesQuery.isError;

  return (
    <div>
      <PageHeader
        title="Referentes y organizaciones"
        description="Reasigná una organización a otro referente activo, o dejala sin referente."
      />

      <div style={{ maxWidth: 360, marginBottom: 16 }}>
        <Input
          type="search"
          value={refInput}
          onChange={(e) => setRefInput(e.target.value)}
          placeholder="Buscar referente por nombre o email"
          aria-label="Buscar referente"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AsyncSection
          isLoading={isLoading}
          isError={isError}
          // With an active search keep the section on screen so the empty-result message can show.
          isEmpty={referentes.length === 0 && !refQ}
          emptyLabel="No hay referentes"
        >
          <div style={LIST_SCROLL_STYLE}>
          {referentes.length === 0 && refQ && (
            <Text variant="body-sm" color="ink-2">
              Ningún referente coincide con la búsqueda — probá con otra.
            </Text>
          )}
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
          </div>
        </AsyncSection>

        {usuariosPage && (
          <Pager
            page={usuariosPage}
            onPageChange={setPage}
            disabled={usuariosQuery.isFetching}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
          />
        )}

        <Card style={{ padding: 20, border: '1.5px dashed var(--line)' }}>
          <Text variant="title" color="urgent" style={{ marginBottom: 8 }}>
            Sin referente{sinQuery.data ? ` (${sinQuery.data.totalElements})` : ''}
          </Text>
          <div style={{ maxWidth: 360, marginBottom: 8 }}>
            <Input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Buscar organización por nombre"
              aria-label="Buscar organización sin referente"
            />
          </div>
          <AsyncSection
            isLoading={sinQuery.isLoading}
            isError={sinQuery.isError}
            isEmpty={sinReferente.length === 0}
            emptyLabel={q ? 'Ninguna organización coincide con la búsqueda' : 'No hay organizaciones sin referente'}
          >
            <div style={LIST_SCROLL_STYLE}>
              {sinReferente.map((org) => (
                <OrgRow key={org.id} org={org} referentesActivos={referentesActivos} />
              ))}
            </div>
            {sinQuery.data && (
              <Pager
                page={sinQuery.data}
                onPageChange={setSinPage}
                disabled={sinQuery.isFetching}
                pageSize={sinPageSize}
                onPageSizeChange={(size) => {
                  setSinPageSize(size);
                  setSinPage(0);
                }}
              />
            )}
          </AsyncSection>
        </Card>
      </div>
    </div>
  );
}
