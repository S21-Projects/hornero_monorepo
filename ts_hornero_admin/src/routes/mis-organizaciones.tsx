import { useState } from 'react';
import type { FormEvent } from 'react';
import { AsyncSection } from '../components/AsyncSection';
import { Badge } from '../components/Badge';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';
import { OrgLocationPickerLazy } from '../components/map/OrgLocationPickerLazy';
import { useGeolocation } from '../lib/hooks/useGeolocation';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useCrearOrganizacion } from '../lib/hooks/useCrearOrganizacion';
import { mapCrearOrganizacionError } from '../lib/hooks/mapCrearOrganizacionError';
import { ESTADO_ORGANIZACION, TIPO_ORGANIZACION } from '../lib/domain-ui';
import { TipoOrganizacion } from '../types/domain';
import type { TipoOrganizacion as TipoOrganizacionType, Organizacion } from '../types/domain';
import { InfoPublicaForm } from '../components/org/InfoPublicaForm';
import { MisReclamos } from '../components/reclamo/MisReclamos';
import { CORDOBA_CENTER, type LatLng } from '../lib/geo';

const CAP = 3;

const TIPO_OPTIONS = Object.values(TipoOrganizacion).map((v) => ({
  value: v,
  label: TIPO_ORGANIZACION[v]?.label ?? v,
}));

interface FieldErrors {
  nombre?: string;
  tipo?: string;
  direccion?: string;
  ubicacion?: string;
}

function CrearOrganizacionForm({ onDone }: { onDone(): void }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoOrganizacionType | ''>('');
  const [direccion, setDireccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const { position, hasUserPosition, fixCount, request } = useGeolocation();
  const crear = useCrearOrganizacion();

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!nombre.trim()) errs.nombre = 'El nombre de la organización es obligatorio';
    if (!tipo) errs.tipo = 'El tipo es obligatorio';
    if (!direccion.trim()) errs.direccion = 'La dirección es obligatoria';
    if (!coords) errs.ubicacion = 'Marcá la ubicación en el mapa';
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    try {
      await crear.mutateAsync({
        nombre: nombre.trim(),
        tipo: tipo as TipoOrganizacionType,
        direccion: direccion.trim(),
        descripcion: descripcion.trim() || undefined,
        latitud: coords!.lat,
        longitud: coords!.lng,
      });
      onDone();
    } catch (err) {
      void err; // surfaced below via crear.error
    }
  }

  return (
    <Card style={{ padding: 24, marginTop: 20 }}>
      <Text variant="h3" style={{ marginBottom: 16 }}>Nueva organización</Text>

      <form onSubmit={(e) => { void handleSubmit(e); }} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          id="org-nombre"
          label="Nombre de la organización"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Comedor Los Hornitos"
        />
        {fieldErrors.nombre && <Text variant="body-sm" color="urgent">{fieldErrors.nombre}</Text>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="tipo">
            <Text as="span" variant="label" color="ink-2">Tipo de organización</Text>
          </label>
          <select
            id="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoOrganizacionType | '')}
            style={{ padding: '12px 14px', borderRadius: 'var(--r-input)', border: '1.5px solid var(--line)', fontSize: 14.5, width: '100%' }}
          >
            <option value="" disabled>Seleccioná un tipo</option>
            {TIPO_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        {fieldErrors.tipo && <Text variant="body-sm" color="urgent">{fieldErrors.tipo}</Text>}

        <Input
          id="direccion"
          label="Dirección"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Av. Colón 1234, Córdoba"
        />
        {fieldErrors.direccion && <Text variant="body-sm" color="urgent">{fieldErrors.direccion}</Text>}

        <Input
          id="descripcion"
          label="Descripción (opcional)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Breve descripción de la organización"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <Text as="span" variant="label" color="ink-2">Ubicación de la organización</Text>
            <button
              type="button"
              onClick={() => request((latlng) => setCoords(latlng))}
              style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--sky)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Usar mi ubicación
            </button>
          </div>
          <Text as="p" variant="label" color="ink-3" style={{ marginBottom: 2 }}>
            Tocá el mapa para marcar dónde está tu organización.
          </Text>
          <div style={{ height: 280, borderRadius: 'var(--r-input)', overflow: 'hidden', border: '1.5px solid var(--line)' }}>
            <OrgLocationPickerLazy
              center={coords ?? (hasUserPosition ? position : CORDOBA_CENTER)}
              markerPosition={coords}
              userPosition={hasUserPosition ? position : null}
              recenterSignal={fixCount}
              onPick={(latlng) => setCoords(latlng)}
              height={280}
            />
          </div>
          <Text as="div" variant="label" color="ink-2" style={{ marginTop: 2 }}>
            {coords ? `Lat: ${coords.lat.toFixed(5)} · Lng: ${coords.lng.toFixed(5)}` : 'Sin ubicación marcada'}
          </Text>
          {fieldErrors.ubicacion && <Text variant="body-sm" color="urgent">{fieldErrors.ubicacion}</Text>}
        </div>

        {crear.isError && (
          <Text variant="body-sm" color="urgent">{mapCrearOrganizacionError(crear.error)}</Text>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" variant="primary" loading={crear.isPending}>
            Crear organización
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function OrgCard({ org }: { org: Organizacion }) {
  const [showInfoPublica, setShowInfoPublica] = useState(false);
  const estadoConfig = ESTADO_ORGANIZACION[org.estado] ?? { tone: 'neutral' as const, label: org.estado };

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Text variant="title">{org.nombre}</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge tone={estadoConfig.tone} label={estadoConfig.label} />
          {org.infoPublicaPendienteEn != null && <Badge tone="sky" label="Info pública pendiente" />}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowInfoPublica((v) => !v)}
          >
            {showInfoPublica ? 'Cerrar' : 'Editar info pública'}
          </Button>
        </div>
      </div>

      {showInfoPublica && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <InfoPublicaForm org={org} mode="referente" />
        </div>
      )}
    </Card>
  );
}

export default function MisOrganizacionesPage() {
  const { data, isLoading, isError, refetch } = useMisOrganizaciones();
  const [showForm, setShowForm] = useState(false);

  const orgs = data ?? [];
  const atCap = orgs.length >= CAP;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text variant="h2">Mis organizaciones</Text>
        <Button
          variant="primary"
          disabled={atCap || showForm}
          title={atCap ? 'Alcanzaste el máximo de 3 organizaciones' : undefined}
          onClick={() => setShowForm(true)}
        >
          + Agregar organización
        </Button>
      </div>

      <Text variant="body-sm" color="ink-3" style={{ marginBottom: 20 }}>
        {orgs.length}/{CAP} organizaciones
      </Text>

      <AsyncSection
        isLoading={isLoading}
        isError={isError}
        isEmpty={orgs.length === 0 && !showForm}
        emptyLabel="Todavía no tenés ninguna organización registrada."
        onRetry={() => { void refetch(); }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orgs.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      </AsyncSection>

      {showForm && (
        <CrearOrganizacionForm onDone={() => { setShowForm(false); void refetch(); }} />
      )}

      <MisReclamos />
    </div>
  );
}
