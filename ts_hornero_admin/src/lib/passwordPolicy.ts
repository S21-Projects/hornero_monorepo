/**
 * Client mirror of the MS PasswordPolicy (NIST SP 800-63B-4 3.1.1.2): length only, no composition
 * rules. The MS stays the authority for the blocklist and the email/nombre checks; its stable
 * codes are mapped to Spanish copy here.
 */
export const PASSWORD_MIN = 15;
export const PASSWORD_MAX = 64;
const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_HINT = 'Mínimo 15 caracteres. Podés usar una frase; no hace falta mezclar símbolos.';

const MESSAGES: Record<string, string> = {
  PASSWORD_DEMASIADO_CORTA: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  PASSWORD_DEMASIADO_LARGA: `La contraseña es demasiado larga (máximo ${PASSWORD_MAX} caracteres).`,
  PASSWORD_COMUN: 'Esa contraseña es demasiado común o predecible. Probá con una frase más personal.',
  PASSWORD_CONTIENE_DATOS_PERSONALES:
    'La contraseña no puede incluir tu nombre, tu email ni el nombre de Hornero.',
};

export function validatePasswordLength(password: string): string | undefined {
  const length = [...password].length;
  if (length < PASSWORD_MIN) return MESSAGES.PASSWORD_DEMASIADO_CORTA;
  if (length > PASSWORD_MAX) return `La contraseña no puede tener más de ${PASSWORD_MAX} caracteres.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return 'La contraseña es demasiado larga: usá menos caracteres especiales o acentuados.';
  }
  return undefined;
}

/** Returns Spanish copy when the failed request carried one of the MS password codes. */
export function passwordErrorFromResponse(err: unknown): string | undefined {
  const data = (err as { response?: { data?: { message?: unknown; errors?: unknown } } })?.response?.data;
  if (!data) return undefined;
  const candidates = [data.message, data.errors].flatMap((v) => (Array.isArray(v) ? v : [v]));
  for (const c of candidates) {
    if (typeof c === 'string' && MESSAGES[c]) return MESSAGES[c];
  }
  return undefined;
}
