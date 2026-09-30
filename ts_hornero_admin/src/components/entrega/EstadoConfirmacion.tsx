import { Badge } from '../Badge';
import { Card } from '../ui/Card';
import { Text } from '../ui/Typography';

interface EstadoConfirmacionProps {
  /** Which party is viewing this screen — decides the "Tu confirmación" vs. counterpart labels. */
  parteActual: 'DONANTE' | 'REFERENTE';
  confirmadaDonanteEn: string | null;
  confirmadaReferenteEn: string | null;
}

/**
 * Mockup card "Estado de la confirmación": the viewer's own status pill ("Tu confirmación") and
 * the counterpart's ("Organización" for a donante viewer, "Donante" for a referente viewer), per
 * spec `donacion-entrega-codigo` — "Screen reflects the counterpart's confirmation status".
 */
export function EstadoConfirmacion({
  parteActual,
  confirmadaDonanteEn,
  confirmadaReferenteEn,
}: EstadoConfirmacionProps) {
  const propia = parteActual === 'DONANTE' ? confirmadaDonanteEn : confirmadaReferenteEn;
  const contraparte = parteActual === 'DONANTE' ? confirmadaReferenteEn : confirmadaDonanteEn;
  const etiquetaContraparte = parteActual === 'DONANTE' ? 'Organización' : 'Donante';

  return (
    <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Text variant="label">Estado de la confirmación</Text>
      <FilaEstado etiqueta="Tu confirmación" confirmadaEn={propia} />
      <FilaEstado etiqueta={etiquetaContraparte} confirmadaEn={contraparte} />
    </Card>
  );
}

function FilaEstado({ etiqueta, confirmadaEn }: { etiqueta: string; confirmadaEn: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text variant="body-sm">{etiqueta}</Text>
      {confirmadaEn ? (
        <Badge tone="ok" label="Confirmado" />
      ) : (
        <Badge tone="neutral" label="Pendiente" />
      )}
    </div>
  );
}
