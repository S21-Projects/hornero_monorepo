/**
 * Security headers for every SSR response (applied by `src/middleware.ts`).
 *
 * HSTS is intentionally NOT set: TLS terminates at Cloudflare, so it is configured at the edge
 * (Cloudflare > SSL/TLS > Edge Certificates > HSTS), where it also covers Cloudflare's own pages.
 */

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

/**
 * CSP delivered as Report-Only (violations show in the console, nothing is blocked).
 * Built from what the site really loads:
 *  - script 'unsafe-inline': Astro island hydration and `is:inline` scripts (Nav, Turnstile
 *    bootstrap) are inline; a nonce/hash scheme is the follow-up before enforcing.
 *  - Turnstile: script, iframe and verification XHR on challenges.cloudflare.com.
 *  - Google Fonts (Layout.astro): stylesheet from googleapis, files from gstatic.
 *  - img: org banners/profiles come from `${PUBLIC_BFF_URL}/images`, map tiles from OSM.
 *  - connect: client islands may call the BFF.
 *  - Resend is server-side only, so it needs no entry.
 */
export function buildCsp(publicBffUrl: string | undefined): string {
  const bff = originOf(publicBffUrl);
  const withBff = (...sources: string[]) => [...sources, ...(bff ? [bff] : [])].join(' ');

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${TURNSTILE_ORIGIN}`,
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

export function securityHeaders(publicBffUrl: string | undefined): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // The public site never asks for geolocation (see HomeMapExplorer) or the camera.
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
    'Content-Security-Policy-Report-Only': buildCsp(publicBffUrl),
  };
}
