/**
 * Mail transport seam. SERVER ONLY — never import this from an island.
 *
 * The rest of the app depends on the `Mailer` interface, never on a provider.
 * Swapping Resend for SES, SMTP or an internal mail service later means adding
 * one function here and changing `getMailer()` — nothing else moves.
 *
 * When `RESEND_API_KEY` is absent the transport falls back to `logMailer`, which
 * prints the submission to the server log. That keeps local dev working with no
 * credentials, at the cost of silently not sending in a misconfigured prod —
 * hence the warning in `getMailer()`.
 */

import { Resend } from 'resend';
import type { Consulta } from './contacto';

export type MailResult = { ok: true } | { ok: false; error: string };

export interface Mailer {
  readonly nombre: string;
  enviarConsulta(consulta: Consulta): Promise<MailResult>;
}

/** Plain-text body. Kept provider-agnostic so every transport reuses it. */
function cuerpoConsulta(consulta: Consulta): string {
  return [
    `Nombre:  ${consulta.nombre}`,
    `Correo:  ${consulta.email}`,
    `Asunto:  ${consulta.asunto || '(sin asunto)'}`,
    '',
    consulta.mensaje,
  ].join('\n');
}

function asuntoConsulta(consulta: Consulta): string {
  return consulta.asunto
    ? `[Contacto] ${consulta.asunto}`
    : `[Contacto] Nueva consulta de ${consulta.nombre}`;
}

/**
 * Development fallback. Writes the submission to stdout instead of sending it.
 */
const logMailer: Mailer = {
  nombre: 'log',
  async enviarConsulta(consulta) {
    console.info(
      `[contacto] Nueva consulta (sin transporte configurado)\n${cuerpoConsulta(consulta)}`,
    );
    return { ok: true };
  },
};

/**
 * Resend transport (https://resend.com/docs/send-with-astro).
 *
 * Secrets are read from `process.env`, not `import.meta.env`: Astro can inline
 * `import.meta.env.*` at build time, and these values are injected at RUNTIME by
 * Docker. Reading them the other way would bake in `undefined` and fail silently.
 */
function crearResendMailer(apiKey: string, from: string, to: string): Mailer {
  const resend = new Resend(apiKey);

  return {
    nombre: 'resend',
    async enviarConsulta(consulta) {
      try {
        const { error } = await resend.emails.send({
          // Verified domain. NEVER the visitor's address: that breaks SPF/DMARC
          // and lands the mail in spam. The visitor goes in replyTo, so hitting
          // "reply" in the inbox answers them directly.
          from,
          to: [to],
          replyTo: consulta.email,
          subject: asuntoConsulta(consulta),
          text: cuerpoConsulta(consulta),
        });

        if (error) return { ok: false, error: `resend: ${error.message}` };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: `resend: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (mailer) return mailer;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACTO_FROM_EMAIL;
  const to = process.env.CONTACTO_TO_EMAIL;

  if (apiKey && from && to) {
    mailer = crearResendMailer(apiKey, from, to);
    return mailer;
  }

  const faltantes = [
    !apiKey && 'RESEND_API_KEY',
    !from && 'CONTACTO_FROM_EMAIL',
    !to && 'CONTACTO_TO_EMAIL',
  ].filter(Boolean);

  console.warn(
    `[contacto] Transporte de correo sin configurar (falta ${faltantes.join(', ')}). ` +
      'Las consultas sólo se escriben en el log.',
  );

  mailer = logMailer;
  return mailer;
}
