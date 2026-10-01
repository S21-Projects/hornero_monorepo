import { Card } from '../ui/Card';
import { Text } from '../ui/Typography';

interface Criterio {
  titulo: string;
  descripcion: string;
}

// Spec `donacion-fondo-comun` — "Nueva Donación Screen": static explainer of the 5 scoring
// criteria the assignment engine uses, without exposing organizacion-identifying data before
// assignment. The 5th criterion (cumplimiento, AD-11) was added cosmetically in slice 6b.
const CRITERIOS: Criterio[] = [
  {
    titulo: 'Déficit de cobertura',
    descripcion: 'Prioriza zonas donde la necesidad supera ampliamente lo que hoy se cubre.',
  },
  {
    titulo: 'Urgencia',
    descripcion: 'Da más peso a las necesidades marcadas como urgentes o próximas a vencer.',
  },
  {
    titulo: 'Proximidad',
    descripcion: 'Favorece organizaciones cercanas al punto de retiro que marcaste en el mapa.',
  },
  {
    titulo: 'Tiempo de espera',
    descripcion: 'Evita que una misma organización espere demasiadas rondas sin recibir nada.',
  },
  {
    titulo: 'Cumplimiento histórico',
    descripcion: 'Favorece organizaciones con buen historial de entregas en donaciones anteriores.',
  },
];

/** Static "¿Cómo se elige el destino?" side panel for the Nueva donación (Fondo común) screen. */
export function CriteriosAsignacionPanel() {
  return (
    <Card as="section" style={{ padding: '20px 24px' }}>
      <Text variant="h3" style={{ marginBottom: 6 }}>¿Cómo se elige el destino?</Text>
      <Text variant="body-sm" color="ink-2" style={{ marginBottom: 16, display: 'block' }}>
        El motor de asignación corre por rondas y reparte cada donación del fondo común según estos
        criterios, sin que vos elijas una organización puntual.
      </Text>

      <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: 0, padding: 0, listStyle: 'none' }}>
        {CRITERIOS.map((c) => (
          <li key={c.titulo}>
            <Text variant="label" as="p" style={{ marginBottom: 2 }}>{c.titulo}</Text>
            <Text variant="caption" as="p">{c.descripcion}</Text>
          </li>
        ))}
      </ul>

      <Text variant="micro" color="ink-3" style={{ marginTop: 16, display: 'block' }}>
        El nivel de acreditación de cada organización también influye en qué categorías puede recibir.
      </Text>
    </Card>
  );
}
