/**
 * Early sketches, prototypes and past versions shown in "Del papel a la pantalla".
 *
 * ⚠️ The image files do not exist yet. Drop them in `public/proceso/` using the
 * paths below (or edit the paths to match your filenames). Until a file exists
 * the card renders a labelled placeholder instead of a broken image, so the
 * layout stays reviewable.
 *
 * Recommended: landscape images, ~1200px wide, JPG/PNG/WebP.
 */

export interface HitoProceso {
  /** Short stage label shown as a pill over the image. */
  etapa: string;
  titulo: string;
  descripcion: string;
  /** Path under `public/`. */
  src: string;
  /** Required: describes the image for screen readers. */
  alt: string;
}

export const PROCESO: HitoProceso[] = [
  {
    etapa: 'Boceto',
    // TODO(proceso): reemplazar por el título y la descripción reales
    titulo: 'Los primeros dibujos',
    descripcion:
      'Las pantallas iniciales dibujadas a mano, cuando la idea todavía era una lista de comedores y un formulario de contacto.',
    src: '/proceso/01-bocetos.jpg',
    alt: 'Bocetos a mano de las primeras pantallas de El Hornero.',
  },
  {
    etapa: 'Wireframe',
    titulo: 'Wireframes de baja fidelidad',
    descripcion:
      'La primera traducción de los dibujos a una estructura navegable, todavía sin identidad visual.',
    src: '/proceso/02-wireframes.jpg',
    alt: 'Wireframes de baja fidelidad de la plataforma.',
  },
  {
    etapa: 'Prototipo',
    titulo: 'Prototipo en Figma',
    descripcion:
      'El primer prototipo con la paleta y la tipografía definitivas, usado para validar el recorrido de donación.',
    src: '/proceso/03-prototipo.jpg',
    alt: 'Prototipo de alta fidelidad diseñado en Figma.',
  },
  {
    etapa: 'v1',
    titulo: 'La primera versión funcionando',
    descripcion:
      'La primera iteración desplegada, con el listado de organizaciones y las necesidades ya conectadas al backend.',
    src: '/proceso/04-v1.jpg',
    alt: 'Captura de la primera versión funcional de El Hornero.',
  },
];
