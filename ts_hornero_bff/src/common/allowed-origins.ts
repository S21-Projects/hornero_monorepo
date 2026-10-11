const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4321',
];

/**
 * Single source of the browser-origin allowlist, used by both CORS and the CSRF Origin check.
 * CORS_ORIGINS (if set) is the explicit allowlist (prod). Otherwise merge the local dev origins
 * with FRONTEND_URL so setting FRONTEND_URL never shadows the SPA (:5173) / Astro (:4321) origins.
 */
export function resolveAllowedOrigins(
  env: Record<string, string | undefined> = process.env,
): string[] {
  if (env.CORS_ORIGINS) {
    return env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return Array.from(
    new Set([
      ...DEFAULT_ORIGINS,
      ...(env.FRONTEND_URL ? [env.FRONTEND_URL.trim()] : []),
    ]),
  );
}
