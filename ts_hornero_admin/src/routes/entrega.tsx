import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AsyncSection } from '../components/AsyncSection';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { CodigoQr } from '../components/entrega/CodigoQr';
import { Countdown } from '../components/entrega/Countdown';
import { EscanerQr } from '../components/entrega/EscanerQr';
import { EstadoConfirmacion } from '../components/entrega/EstadoConfirmacion';
import { useDonacion } from '../lib/hooks/useDonacion';
import { useEstadoEntrega, useGenerarCodigo, useVerificarCodigo } from '../lib/hooks/useEntrega';
import { useAuthStore } from '../store/auth.store';

const ENTREGADA = 'ENTREGADA';

/**
 * Mobile delivery-confirmation screen (spec `donacion-entrega-codigo`'s "Mobile Delivery
 * Confirmation Screen" requirement). Composes the 3c-i building blocks: the party's own code as a
 * QR with a live countdown, an always-available "Generar código nuevo" action, a scan/typed action
 * for the counterpart's code, and both parties' status — updating without a page reload as
 * `useEstadoEntrega` polls, and stopping once `ENTREGADA`.
 */
export default function EntregaPage() {
  const { id } = useParams<{ id: string }>();
  const donacionId = id ? Number(id) : undefined;
  const tipo = useAuthStore((s) => s.user?.tipo);
  const parteActual: 'DONANTE' | 'REFERENTE' = tipo === 'REFERENTE' ? 'REFERENTE' : 'DONANTE';
  const backTo = parteActual === 'REFERENTE' ? '/dashboard' : '/mis-donaciones';

  const donacion = useDonacion(donacionId);
  const estado = useEstadoEntrega(donacionId);
  const generar = useGenerarCodigo(donacionId);
  const verificar = useVerificarCodigo(donacionId);

  // A code exists only in the client's own transient state — the MS never exposes "my current
  // code" separately from "generate a new one" (each generation burns the previous, AD-6). Open
  // the screen with a fresh code for the party, exactly as "Generar código nuevo" would.
  useEffect(() => {
    if (donacionId != null) {
      generar.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donacionId]);

  const entregada = estado.data?.estado === ENTREGADA;
  const counterpartName =
    parteActual === 'DONANTE' ? donacion.data?.organizacionNombre : donacion.data?.donanteName;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={backTo} style={{ textDecoration: 'none', color: 'var(--ink-2)' }}>
          ← Volver
        </Link>
      </div>

      <Text variant="h2" style={{ marginBottom: 4 }}>Confirmar entrega</Text>
      <Text variant="body-sm" color="ink-3" style={{ marginBottom: 20, display: 'block' }}>
        Donación #{donacionId}
        {counterpartName ? ` · ${counterpartName}` : ''}
      </Text>

      <AsyncSection
        isLoading={donacion.isLoading}
        isError={donacion.isError}
        isEmpty={!donacion.isLoading && !donacion.isError && !donacion.data}
        emptyLabel="No se encontró la donación."
      >
        {entregada ? (
          <Card style={{ padding: 24, textAlign: 'center' }}>
            <Text variant="h3">Entregada</Text>
            <Text variant="body-sm" color="ink-3" style={{ marginTop: 8, display: 'block' }}>
              Ambas partes confirmaron la entrega.
            </Text>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              {generar.data && (
                <>
                  <CodigoQr donacionId={donacionId ?? 0} codigo={generar.data.codigo} />
                  <Countdown expiraEn={generar.data.expiraEn} />
                </>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={generar.isPending}
                onClick={() => generar.mutate()}
              >
                Generar un código nuevo
              </Button>
            </Card>

            <EstadoConfirmacion
              parteActual={parteActual}
              confirmadaDonanteEn={estado.data?.confirmadaDonanteEn ?? null}
              confirmadaReferenteEn={estado.data?.confirmadaReferenteEn ?? null}
            />

            <EscanerQr
              donacionId={donacionId ?? 0}
              onCodigo={(codigo) => verificar.mutate(codigo)}
              disabled={verificar.isPending}
              contraparte={parteActual === 'REFERENTE' ? 'DONANTE' : 'ORGANIZACION'}
            />

            {verificar.isError && (
              <Text variant="micro" color="urgent">
                No se pudo verificar el código. Intentá de nuevo.
              </Text>
            )}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
