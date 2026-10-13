/**
 * Security headers for every SSR response (applied by `src/middleware.ts`).
 *
 * HSTS is intentionally NOT set: TLS terminates at Cloudflare, so it is configured at the edge
 * (Cloudflare > SSL/TLS > Edge Certificates > HSTS), where it also covers Cloudflare's own pages.
 */

import { createHash } from 'node:crypto';

const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
const OSM_TILES = 'https://*.tile.openstreetmap.org';

/** Origin of a URL, or null when it is empty/relative/invalid. */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export type CspMode = 'report-only' | 'enforce';

/** `CSP_MODE=enforce` enforces; anything else (unset, typo) stays on the safe Report-Only default. */
export function cspModeFrom(value: string | undefined): CspMode {
  return value?.trim().toLowerCase() === 'enforce' ? 'enforce' : 'report-only';
}

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

/**
 * CSP `'sha256-...'` sources for every inline `<script>` in an HTML document (Astro's island
 * bootstrap, the Nav toggle). Scripts with `src` are covered by the origin allowlist instead.
 */
export function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const [, attrs, body] of html.matchAll(INLINE_SCRIPT)) {
    if (/\bsrc\s*=/i.test(attrs) || body.trim() === '') continue;
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  return [...hashes];
}

/**
 * Built from what the site really loads:
 *  - script: inline scripts are allowed by per-response hash (no 'unsafe-inline'); inline event
 *    handler attributes are not used (image fallbacks are wired in Nav.astro's script).
 *  - Turnstile: script, iframe and verification XHR on challenges.cloudflare.com.
 *  - Google Fonts (Layout.astro): stylesheet from googleapis, files from gstatic.
 *  - style 'unsafe-inline': `style=` attributes in the templates and React islands (residual,
 *    far lower impact than script injection).
 *  - img: org banners/profiles come from `${PUBLIC_BFF_URL}/images`, map tiles from OSM.
 *  - connect: client islands may call the BFF.
 *  - Resend is server-side only, so it needs no entry.
 */
export function buildCsp(publicBffUrl: string | undefined, scriptHashes: string[] = []): string {
  const bff = originOf(publicBffUrl);
  const withBff = (...sources: string[]) => [...sources, ...(bff ? [bff] : [])].join(' ');

  return [
    "default-src 'self'",
    `script-src ${["'self'", ...scriptHashes, TURNSTILE_ORIGIN].join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src ${withBff("'self'", 'data:', 'blob:', OSM_TILES)}`,
    `connect-src ${withBff("'self'", TURNSTILE_ORIGIN)}`,
    "font-src 'self' https://fonts.gstatic.com data:",
    `frame-src ${TURNSTILE_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Report-Only logs violations in the console and blocks nothing; `enforce` blocks. The mode is a
 * runtime env (`CSP_MODE`), so switching needs a restart, not a rebuild.
 */
export function securityHeaders(
  publicBffUrl: string | undefined,
  mode: CspMode = 'report-only',
  scriptHashes: string[] = [],
): Record<string, string> {
  const cspHeader =
    mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // The public site never asks for geolocation (see HomeMapExplorer) or the camera.
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
    [cspHeader]: buildCsp(publicBffUrl, scriptHashes),
  };
}
