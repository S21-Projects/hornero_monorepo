import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCrearDonacion } from '../lib/hooks/useCrearDonacion';
import { useGeolocation } from '../lib/hooks/useGeolocation';
import { useAuthStore } from '../store/auth.store';
import { CORDOBA_CENTER, type LatLng } from '../lib/geo';
import { OrgLocationPickerLazy } from '../components/map/OrgLocationPickerLazy';
import { CriteriosAsignacionPanel } from '../components/donacion/CriteriosAsignacionPanel';
import { LineaArticuloEditor } from '../components/donacion/LineaArticuloEditor';
import { mapDonacionError } from '../lib/hooks/mapDonacionError';
import { ModalidadDonacion } from '../types/domain';
import type { ModalidadDonacion as ModalidadDonacionType, DonacionLineaInput } from '../types/domain';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { PageHeader } from '../components/ui/PageHeader';

interface ModalidadCardProps {
  value: ModalidadDonacionType;
  checked: boolean;
  onChange: (value: ModalidadDonacionType) => void;
  titulo: string;
  descripcion: string;
}

/** Selectable modalidad card — a native radio input gives it correct radio semantics/keyboard
 * support, visually styled as a full card (≥44px target) via its wrapping `<label>`. */
function ModalidadCard({ value, checked, onChange, titulo, descripcion }: ModalidadCardProps) {
  return (
    <label style={{ display: 'block', cursor: 'pointer', minHeight: 44 }}>
      <input
        type="radio"
        name="modalidad"
        value={value}
        checked={checked}
        onChange={() => { onChange(value); }}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
      <Card
        as="div"
        style={{
          padding: '18px 20px',
          boxShadow: checked ? 'inset 0 0 0 2px var(--horn)' : 'var(--sh-1)',
        }}
      >
        <Text variant="title" style={{ marginBottom: 4 }}>{titulo}</Text>
        <Text variant="body-sm" color="ink-2">{descripcion}</Text>
      </Card>
    </label>
  );
}

/**
 * "Nueva donación — modalidad" screen (`/donar`, DONANTE). Spec `donacion-fondo-comun`'s
 * "Nueva Donación Screen" + decision 14: choosing DIRECTA routes to the existing `/explorar`
 * necesidad picker (no picker embedded here); FONDO_COMUN requires categoria + pickup location
 * before it can be offered to the pool.
 */
export default function NuevaDonacionPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const crear = useCrearDonacion();
  const { position, hasUserPosition, fixCount, request } = useGeolocation();

  const [modalidad, setModalidad] = useState<ModalidadDonacionType | null>(null);
  const [lineas, setLineas] = useState<DonacionLineaInput[]>([]);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [observaciones, setObservaciones] = useState('');

  // Decision 4: every donación requires ≥1 línea with a chosen articulo and cantidad > 0.
  const lineasValidas = lineas.length > 0 && lineas.every((l) => l.articuloId > 0 && l.cantidad > 0);
  const canSubmitFondoComun = lineasValidas && coords !== null;

  function handleDirectaContinuar() {
    navigate('/explorar');
  }

  async function handleFondoComunSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmitFondoComun || !coords) return;

    const result = await crear.mutateAsync({
      modalidad: ModalidadDonacion.FONDO_COMUN,
      lineas,
      latitud: coords.lat,
      longitud: coords.lng,
      observaciones: observaciones || undefined,
    });
    navigate(`/mis-donaciones/${result.id}?nueva=1`);
  }

  return (
    <div style={{ maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <nav aria-label="breadcrumb">
        <Text variant="caption" color="ink-3">
          <Link to="/mis-donaciones" style={{ color: 'inherit', textDecoration: 'none' }}>
            Mis donaciones
          </Link>
          {' / Nueva donación'}
        </Text>
      </nav>

      <div>
        <PageHeader
          title="¿Cómo querés donar?"
          description="Elegí si querés donar directo a una necesidad o aportar al fondo común."
        />
      </div>

      {user && !user.emailVerificado && (
        <Card style={{ padding: '14px 18px', background: 'var(--medium-bg, #fff6e6)' }}>
          <Text variant="body-sm" color="medium">
            Todavía no verificaste tu email.{' '}
            <Link to="/verify-email" style={{ color: 'inherit', textDecoration: 'underline' }}>
              Verificalo
            </Link>{' '}
            para poder ofrecer donaciones.
          </Text>
        </Card>
      )}

      <div
        role="radiogroup"
        aria-label="Modalidad de donación"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}
      >
        <ModalidadCard
          value={ModalidadDonacion.DIRECTA}
          checked={modalidad === ModalidadDonacion.DIRECTA}
          onChange={setModalidad}
          titulo="Donación directa"
          descripcion="Elegís una necesidad publicada por una organización y donás directamente para eso."
        />
        <ModalidadCard
          value={ModalidadDonacion.FONDO_COMUN}
          checked={modalidad === ModalidadDonacion.FONDO_COMUN}
          onChange={setModalidad}
          titulo="Fondo común"
          descripcion="No elegís el destino: el motor de asignación la envía a la necesidad donde más impacto tiene."
        />
      </div>

      {modalidad === ModalidadDonacion.DIRECTA && (
        <div style={{ display: 'flex', gap: 12 }}>
          <Button type="button" variant="ghost" onClick={() => { navigate('/mis-donaciones'); }}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" onClick={handleDirectaContinuar}>
            Continuar
          </Button>
        </div>
      )}

      {modalidad === ModalidadDonacion.FONDO_COMUN && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.6fr) minmax(260px, 1fr)',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <form onSubmit={(e) => { void handleFondoComunSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Text variant="label" as="p" style={{ marginBottom: 6 }}>Artículos que ofrecés</Text>
                <LineaArticuloEditor lineas={lineas} onChange={setLineas} />
              </div>

              <div>
                <Text variant="label" as="p" style={{ marginBottom: 6 }}>Punto de retiro</Text>
                <OrgLocationPickerLazy
                  center={coords ?? (hasUserPosition ? position : CORDOBA_CENTER)}
                  markerPosition={coords}
                  userPosition={hasUserPosition ? position : null}
                  recenterSignal={fixCount}
                  onPick={setCoords}
                />
                <Button type="button" variant="secondary" size="sm" style={{ marginTop: 8 }} onClick={() => { request(setCoords); }}>
                  Usar mi ubicación actual
                </Button>
              </div>

              <div>
                <label htmlFor="observaciones">
                  <Text variant="label" as="span" style={{ display: 'block', marginBottom: 6 }}>
                    Descripción (opcional)
                  </Text>
                </label>
                <textarea
                  id="observaciones"
                  value={observaciones}
                  onChange={(e) => { setObservaciones(e.target.value); }}
                  placeholder="Describí qué podés ofrecer…"
                  rows={3}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 14.5,
                    color: 'var(--ink)',
                    background: '#fff',
                    border: '1.5px solid var(--line)',
                    borderRadius: 'var(--r-input)',
                    padding: '12px 14px',
                    width: '100%',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {crear.isError && (
                <Text variant="body-sm" color="urgent">
                  {mapDonacionError(crear.error)}
                </Text>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <Button type="button" variant="ghost" onClick={() => { navigate('/mis-donaciones'); }}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!canSubmitFondoComun}
                  loading={crear.isPending}
                >
                  Ofrecer al fondo común
                </Button>
              </div>
            </Card>
          </form>

          <CriteriosAsignacionPanel />
        </div>
      )}
    </div>
  );
}
