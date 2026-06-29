import type { UserRole } from '../../store/auth.store';

interface TokenPayload {
  tipo: UserRole;
}

/**
 * Decodes the payload of a JWT access token without verifying the signature.
 * Used for UX routing only — same trust level as proxy.ts in ts_hornero_app.
 */
export function decodeToken(token: string): { tipo: UserRole } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as TokenPayload;
    if (!payload.tipo) return null;
    return { tipo: payload.tipo };
  } catch {
    return null;
  }
}
