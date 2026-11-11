import { FaseDonacion, type FaseDonacion as FaseDonacionType } from '../../types/domain';
import { PASOS_DONACION, pasoActual } from '../../lib/donacion-progreso';

interface BarraProgresoProps {
  fase: FaseDonacionType;
}

/** Compact 4-segment progress bar for list rows; shares its phase logic with `ProgresoDonacion`. */
export function BarraProgreso({ fase }: BarraProgresoProps) {
  const actual = pasoActual(fase);
  const cancelada = fase === FaseDonacion.CANCELADA || fase === FaseDonacion.RECHAZADA;
  const label =
    actual != null
      ? `Progreso: ${PASOS_DONACION[actual]} (paso ${actual + 1} de ${PASOS_DONACION.length})`
      : cancelada
        ? 'Progreso: donación cerrada'
        : 'Progreso: en espera de asignación';

  return (
    <div role="img" aria-label={label} className="progress-bar">
      {PASOS_DONACION.map((paso, i) => (
        <span
          key={paso}
          className={`progress-bar__seg${actual != null && i <= actual ? ' progress-bar__seg--on' : ''}${
            cancelada ? ' progress-bar__seg--off' : ''
          }`}
        />
      ))}
    </div>
  );
}
