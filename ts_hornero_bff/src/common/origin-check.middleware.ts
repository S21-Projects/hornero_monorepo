import type { NextFunction, Request, Response } from 'express';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function refererOrigin(referer: string): string | null {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF defense for cookie auth with `sameSite=none`: a state-changing request carrying a browser
 * `Origin` (or, failing that, a `Referer`) outside the allowlist is rejected with 403.
 *
 * Requests with neither header are allowed on purpose: browsers always send `Origin` on a
 * cross-origin POST, so only non-browser clients (scripts/seed.ts, server-to-server) omit both.
 * Safe methods (GET/HEAD/OPTIONS) are never checked.
 */
export function createOriginCheckMiddleware(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!STATE_CHANGING_METHODS.has(req.method)) return next();

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const source =
      origin ?? (referer ? (refererOrigin(referer) ?? 'invalid') : undefined);

    if (source === undefined || allowed.has(source)) return next();

    const message = 'Origin not allowed';
    res.status(403).json({
      status: 403,
      message,
      timestamp: new Date().toISOString(),
      data: null,
      errors: [message],
    });
  };
}
