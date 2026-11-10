import type { APIRoute } from 'astro';
import { validarConsulta, HONEYPOT_FIELD, type Consulta } from '../../lib/contacto';
import { getMailer } from '../../lib/mailer';
import { TURNSTILE_TOKEN_FIELD } from '../../lib/turnstile';

/** On-demand: this is the only dynamic route in an otherwise prerendered site. */
export const prerender = false;

const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 5;

/**
 * In-memory sliding window. Deliberately simple: it resets on restart and is
 * per-process, which is fine for a single-container deploy. If Astro is ever
 * scaled horizontally this stops being a real limit and should move to a shared
 * store.
 */
const historial = new Map<string, number[]>();

function limiteAlcanzado(ip: string): boolean {
  const ahora = Date.now();
  const previos = (historial.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);

  if (previos.length >= MAX_POR_VENTANA) {
    historial.set(ip, previos);
    return true;
  }

  previos.push(ahora);
  historial.set(ip, previos);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (historial.size > 5000) {
    for (const [clave, marcas] of historial) {
      if (marcas.every((t) => ahora - t >= VENTANA_MS)) historial.delete(clave);
    }
  }

  return false;
}

/**
 * Behind the Cloudflare tunnel every request arrives from the tunnel itself, so
 * `clientAddress` would bucket all visitors together. `cf-connecting-ip` carries
 * the real client IP and is set by Cloudflare (it cannot be spoofed end-to-end
 * because the origin is only reachable through the tunnel).
 */
function resolverIp(request: Request, clientAddress: string): string {
  return request.headers.get('cf-connecting-ip')?.trim() || clientAddress || 'desconocida';
}

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Canonical Turnstile server-side verification. The browser NEVER calls
 * siteverify: browser → this route → Cloudflare.
 *
 * Returns `true` when the token is valid. When `TURNSTILE_SECRET` is not set
 * the check is skipped so local dev works without credentials — which also
 * means the gate is inert in production until that variable exists.
 */
async function turnstileValido(token: string, remoteip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;

  if (!secret) {
    console.warn(
      '[contacto] TURNSTILE_SECRET no configurada: la verificación de Turnstile está desactivada.',
    );
    return true;
  }

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip,
      }),
    });

    const result = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };

    if (result.success !== true) {
      console.warn('[contacto] Turnstile rechazó el token:', result['error-codes'] ?? []);
      return false;
    }

    return true;
  } catch (e) {
    // Network failure reaching Cloudflare: fail closed. A contact form is not
    // worth leaving open to bots because siteverify was briefly unreachable.
    console.error('[contacto] No se pudo contactar a siteverify:', e);
    return false;
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido.' }, 400);
  }

  // Honeypot: a hidden field no human ever fills. Answer 200 so bots cannot
  // tell they were caught and start probing for the real validation.
  if (typeof payload[HONEYPOT_FIELD] === 'string' && payload[HONEYPOT_FIELD].trim() !== '') {
    return json({ ok: true }, 200);
  }

  const ip = resolverIp(request, clientAddress);

  if (limiteAlcanzado(ip)) {
    return json(
      { error: 'Recibimos varias consultas tuyas hace poco. Probá de nuevo en unos minutos.' },
      429,
    );
  }

  // Bot gate. Runs before any handler logic so a request that fails the
  // challenge never reaches validation or the mailer.
  const token = String(payload[TURNSTILE_TOKEN_FIELD] ?? '');
  if (!(await turnstileValido(token, ip))) {
    return json(
      { error: 'No pudimos verificar que seas una persona. Recargá la página e intentá de nuevo.' },
      403,
    );
  }

  const consulta: Consulta = {
    nombre: String(payload.nombre ?? '').trim(),
    email: String(payload.email ?? '').trim(),
    asunto: String(payload.asunto ?? '').trim(),
    mensaje: String(payload.mensaje ?? '').trim(),
  };

  const errores = validarConsulta(consulta);
  if (Object.keys(errores).length > 0) {
    return json({ errores }, 422);
  }

  const resultado = await getMailer().enviarConsulta(consulta);
  if (!resultado.ok) {
    console.error('[contacto] Falló el envío:', resultado.error);
    return json(
      { error: 'No pudimos enviar tu consulta. Escribinos por correo mientras lo resolvemos.' },
      502,
    );
  }

  return json({ ok: true }, 200);
};
