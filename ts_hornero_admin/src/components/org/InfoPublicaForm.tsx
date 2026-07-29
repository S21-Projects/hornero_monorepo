import { useState } from 'react';
import type { FormEvent } from 'react';
import { Badge } from '../Badge';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import { OrgImagesEditor } from './OrgImagesEditor';
import { useActualizarInfoPublica } from '../../lib/hooks/useActualizarInfoPublica';
import { useAdminInfoPublica } from '../../lib/hooks/useAdminInfoPublica';
import { mapInfoPublicaError } from '../../lib/hooks/mapInfoPublicaError';
import type { InfoPublica, InfoPublicaPendiente } from '../../types/domain';

type OrgInfoPublica = InfoPublica & InfoPublicaPendiente & {
  id: number;
  profileImageKey?: string | null;
  bannerKey?: string | null;
};

interface InfoPublicaFormProps {
  org: OrgInfoPublica;
  mode: 'referente' | 'admin';
}

/**
 * Edits the three info-pública fields (aceptaDonaciones, sitioWebUrl,
 * donacionDirectaUrl) — nothing else.
 *
 * Referente mode (organizacion-self-edit spec): writes go through the MS
 * pending-approval snapshot via the existing `PATCH /organizaciones/{id}`.
 * When a submission is already pending, the form pre-fills from the pending
 * snapshot and shows a badge + the currently-public values, since the public
 * site keeps rendering the last-approved values until an admin approves.
 *
 * Admin mode: writes go live immediately via `PATCH /{id}/info-publica`, no
 * approval step, no pending badge.
 */
export function InfoPublicaForm({ org, mode }: InfoPublicaFormProps) {
  const isPending = mode === 'referente' && org.infoPublicaPendienteEn != null;

  const [aceptaDonaciones, setAceptaDonaciones] = useState(
    isPending ? (org.aceptaDonacionesPendiente ?? false) : org.aceptaDonaciones,
  );
  const [sitioWebUrl, setSitioWebUrl] = useState(
    (isPending ? org.sitioWebUrlPendiente : org.sitioWebUrl) ?? '',
  );
  const [donacionDirectaUrl, setDonacionDirectaUrl] = useState(
    (isPending ? org.donacionDirectaUrlPendiente : org.donacionDirectaUrl) ?? '',
  );
  const [justSubmitted, setJustSubmitted] = useState(false);

  const referenteMutation = useActualizarInfoPublica();
  const { actualizar: adminMutation } = useAdminInfoPublica();

  const mutation = mode === 'referente' ? referenteMutation : adminMutation;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setJustSubmitted(false);
    const input = { aceptaDonaciones, sitioWebUrl, donacionDirectaUrl };
    try {
      if (mode === 'referente') {
        await referenteMutation.mutateAsync({ organizacionId: org.id, input });
      } else {
        await adminMutation.mutateAsync({ organizacionId: org.id, input });
      }
      setJustSubmitted(true);
    } catch (err) {
      void err; // surfaced below via mutation.error
    }
  }

  return (
    <form
      onSubmit={(e) => { void handleSubmit(e); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <OrgImagesEditor
        organizacionId={org.id}
        profileImageKey={org.profileImageKey}
        bannerKey={org.bannerKey}
      />

      {isPending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Badge tone="sky" label="Cambios pendientes de aprobación" />
          <Text variant="micro" color="ink-3">
            Actualmente público: {org.aceptaDonaciones ? 'Recibe donaciones' : 'No indica recibir donaciones'}
            {org.sitioWebUrl ? ` · Sitio: ${org.sitioWebUrl}` : ''}
            {org.donacionDirectaUrl ? ` · Donación directa: ${org.donacionDirectaUrl}` : ''}
          </Text>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={aceptaDonaciones}
          onChange={(e) => setAceptaDonaciones(e.target.checked)}
        />
        <Text as="span" variant="body-sm">Recibe donaciones</Text>
      </label>

      <Input
        id={`sitio-web-${mode}-${org.id}`}
        label="Sitio web (opcional)"
        value={sitioWebUrl}
        onChange={(e) => setSitioWebUrl(e.target.value)}
        placeholder="https://miorganizacion.org"
      />

      <Input
        id={`donacion-directa-${mode}-${org.id}`}
        label="Enlace de donación directa (opcional)"
        value={donacionDirectaUrl}
        onChange={(e) => setDonacionDirectaUrl(e.target.value)}
        placeholder="https://mpago.la/miorganizacion"
      />

      {mutation.isError && (
        <Text variant="body-sm" color="urgent">{mapInfoPublicaError(mutation.error)}</Text>
      )}

      {justSubmitted && mode === 'referente' && !mutation.isError && (
        <Text variant="body-sm" color="ink-3">
          Guardado. Los cambios quedan pendientes de aprobación de un administrador y no se publican hasta entonces.
        </Text>
      )}

      <Button type="submit" variant="secondary" size="sm" loading={mutation.isPending}>
        {mode === 'referente' ? 'Guardar cambios' : 'Guardar (publica de inmediato)'}
      </Button>
    </form>
  );
}
