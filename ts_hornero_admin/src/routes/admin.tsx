import { AsyncSection } from '../components/AsyncSection';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { deriveAdminSummary } from '../lib/deriveAdminSummary';

export default function AdminPage() {
  const pendientes = useOrganizacionesPendientes();
  const usuarios = useUsuarios();

  const isLoading = pendientes.isLoading || usuarios.isLoading;
  const isError = pendientes.isError || usuarios.isError;

  const summary =
    pendientes.data != null && usuarios.data != null
      ? deriveAdminSummary(pendientes.data, usuarios.data)
      : null;

  return (
    <AsyncSection
      isLoading={isLoading}
      isError={isError}
      isEmpty={false} // summary always renders counts; never an empty state
    >
      <div>
        <div>
          <h2>Organizaciones pendientes</h2>
          <p>{summary?.pendingOrgCount ?? '—'}</p>
        </div>
        <div>
          <h2>Total de usuarios</h2>
          <p>{summary?.totalUserCount ?? '—'}</p>
        </div>
        <div>
          <h2>Usuarios activos</h2>
          <p>{summary?.activeUserCount ?? '—'}</p>
        </div>
      </div>
    </AsyncSection>
  );
}
