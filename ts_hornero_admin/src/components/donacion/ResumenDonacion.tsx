import { UNIDAD_ARTICULO } from '../../lib/domain-ui';
import { useArticulos } from '../../lib/hooks/useArticulos';
import { Card } from '../ui/Card';
import { Text } from '../ui/Typography';
import type { DonacionLineaInput, Necesidad } from '../../types/domain';

interface ResumenDonacionProps {
  necesidad: Necesidad;
  lineas: DonacionLineaInput[];
  /** Days the organization has to answer a direct offer (MS `app.donaciones.oferta-sin-respuesta-dias`). */
  diasParaAceptar: number;
}

/** Summary aside of the direct-donation wizard: destination, chosen lines and the response window. */
export function ResumenDonacion({ necesidad, lineas, diasParaAceptar }: ResumenDonacionProps) {
  const { data: articulos = [] } = useArticulos();
  const porId = new Map(articulos.map((a) => [a.id, a]));
  const elegidas = lineas.filter((l) => l.articuloId > 0 && l.cantidad > 0);

  return (
    <Card as="section" className="card-pad" >
      <Text variant="caption" color="ink-3">Tu donación</Text>
      <Text variant="title" as="p">Para {necesidad.organizacionNombre ?? 'la organización'}</Text>
      <Text variant="body-sm" color="ink-2" as="p">{necesidad.descripcion}</Text>
      {elegidas.length > 0 && (
        <ul className="plain-list" aria-label="Artículos de la donación">
          {elegidas.map((l, i) => {
            const a = porId.get(l.articuloId);
            return (
              <li key={i}>
                <Text variant="body-sm">
                  {a?.nombre ?? 'Artículo'} {l.cantidad} {a ? UNIDAD_ARTICULO[a.unidad] : ''}
                </Text>
              </li>
            );
          })}
        </ul>
      )}
      <p className="summary-note">El comedor tiene {diasParaAceptar} días para aceptar.</p>
    </Card>
  );
}
