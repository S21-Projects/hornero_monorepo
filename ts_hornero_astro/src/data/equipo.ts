/**
 * Team content for the "Quiénes somos" page.
 *
 * ⚠️ PLACEHOLDER CONTENT — written to fill the layout, NOT verified.
 *
 * Only the names of the first three developers are real (taken from the
 * repository's git history), along with the two GitHub handles derivable from
 * their commit addresses. Every role and every bio below is invented and must be
 * replaced before this page goes live — see each `TODO(equipo)` marker.
 *
 * Links are intentionally left blank rather than guessed: a wrong handle points
 * a public page at a stranger's account.
 *
 * Photos are optional. Drop a square image in `public/equipo/` and set `foto`.
 * When `foto` is absent the card falls back to coloured initials.
 */

export interface Integrante {
  nombre: string;
  rol: string;
  bio: string;
  /** Square headshot served from `public/equipo/`. Falls back to initials. */
  foto?: string;
  github?: string;
  linkedin?: string;
}

export const DESARROLLADORES: Integrante[] = [
  {
    nombre: 'Luciano Peralta',
    // TODO(equipo): confirmar rol y reemplazar la bio
    rol: 'Arquitectura e infraestructura',
    bio: 'Definió la arquitectura en capas del sistema y se ocupó del despliegue: contenedores, base de datos y el servidor donde hoy corre la plataforma. Trabajó de punta a punta, del modelo de datos a la interfaz.',
    github: 'https://github.com/Uziano',
  },
  {
    nombre: 'Juan Blázquez',
    // TODO(equipo): confirmar rol, reemplazar la bio y agregar el GitHub
    rol: 'Backend y modelo de dominio',
    bio: 'Modeló el corazón del sistema: organizaciones, necesidades y donaciones. Se encargó de que las reglas del negocio vivan en el backend y no se dispersen por la aplicación.',
  },
  {
    nombre: 'Diego Suárez',
    // TODO(equipo): confirmar rol y reemplazar la bio
    rol: 'Backend y calidad',
    bio: 'Construyó los servicios de validación de organizaciones y sostuvo la suite de pruebas del proyecto. Su obsesión por los casos borde evitó más de un problema en producción.',
    github: 'https://github.com/diegosuarez07',
  },
  {
    // TODO(equipo): completar — este integrante no figura en el historial de git
    nombre: 'Nombre Apellido',
    rol: 'Frontend y experiencia de usuario',
    bio: 'Llevó los prototipos a una interfaz real y cuidó que el recorrido de quien dona sea corto y claro. Se ocupó de que la plataforma se entienda tanto en una computadora como en un teléfono.',
  },
];

/**
 * Design credit. Rendered apart from the developer grid on purpose: it is an
 * acknowledgement, not a fourth column of the same list.
 */
export const DISENO: Integrante = {
  // TODO(equipo): completar con el nombre real y reemplazar la bio
  nombre: 'Nombre Apellido',
  rol: 'Diseño de producto e identidad visual',
  bio: 'Definió la identidad visual de El Hornero —la paleta cálida, la tipografía y el tono— y acompañó las decisiones de diseño de toda la plataforma. Sin ese trabajo, esto sería una base de datos con botones.',
};
