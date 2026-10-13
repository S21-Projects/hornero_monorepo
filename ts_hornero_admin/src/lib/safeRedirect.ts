/** Auth screens that must never be a post-login destination (loop / pointless). */
const AUTH_SCREENS = ['/login', '/register', '/olvide-contrasena'];

/**
 * Validates a "return to" path before navigating to it after login.
 * Accepts only same-origin relative paths ("/x?y#z"); returns null for anything
 * that could leave the origin (absolute URLs, "//host", backslash tricks, other
 * schemes) or that would bounce straight back into an auth screen.
 */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  const pathname = value.split(/[?#]/, 1)[0];
  if (AUTH_SCREENS.includes(pathname)) return null;
  return value;
}
