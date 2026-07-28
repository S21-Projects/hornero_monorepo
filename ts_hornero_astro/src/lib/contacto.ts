/**
 * Shared contract for the contact form.
 *
 * Imported by BOTH the browser island and the API route so the limits can never
 * drift apart. The client-side check is a UX affordance only — `validarConsulta`
 * runs again on the server, which is the authority.
 *
 * Must stay free of server-only imports (no secrets, no node APIs).
 */

export interface Consulta {
  nombre: string;
  email: string;
  asunto: string;
  mensaje: string;
}

export const LIMITES = {
  nombre: { min: 2, max: 80 },
  email: { max: 160 },
  asunto: { max: 120 },
  mensaje: { min: 10, max: 2000 },
} as const;

/** Field name of the honeypot input. Bots fill it; humans never see it. */
export const HONEYPOT_FIELD = 'apellido_materno';

export type ErroresConsulta = Partial<Record<keyof Consulta, string>>;

/**
 * Deliberately permissive: the only way to truly validate an address is to send
 * to it. This rejects obvious typos without locking out valid exotic addresses.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarConsulta(valores: Partial<Consulta>): ErroresConsulta {
  const errores: ErroresConsulta = {};
  const nombre = valores.nombre?.trim() ?? '';
  const email = valores.email?.trim() ?? '';
  const asunto = valores.asunto?.trim() ?? '';
  const mensaje = valores.mensaje?.trim() ?? '';

  if (nombre.length < LIMITES.nombre.min) {
    errores.nombre = 'Contanos cómo te llamás.';
  } else if (nombre.length > LIMITES.nombre.max) {
    errores.nombre = `El nombre no puede superar los ${LIMITES.nombre.max} caracteres.`;
  }

  if (!email) {
    errores.email = 'Necesitamos un correo para poder responderte.';
  } else if (email.length > LIMITES.email.max || !EMAIL_RE.test(email)) {
    errores.email = 'Revisá el correo, parece que tiene un error.';
  }

  if (asunto.length > LIMITES.asunto.max) {
    errores.asunto = `El asunto no puede superar los ${LIMITES.asunto.max} caracteres.`;
  }

  if (mensaje.length < LIMITES.mensaje.min) {
    errores.mensaje = `Escribinos al menos ${LIMITES.mensaje.min} caracteres para poder ayudarte.`;
  } else if (mensaje.length > LIMITES.mensaje.max) {
    errores.mensaje = `El mensaje no puede superar los ${LIMITES.mensaje.max} caracteres.`;
  }

  return errores;
}
