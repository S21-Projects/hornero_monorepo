import { defineMiddleware } from 'astro:middleware';
import { cspModeFrom, inlineScriptHashes, securityHeaders } from './lib/securityHeaders';

// Read per request from the runtime env (not import.meta.env, which is inlined at build time).
const mode = () => cspModeFrom(process.env.CSP_MODE);

export const onRequest = defineMiddleware(async (_context, next) => {
  let response = await next();

  // HTML is buffered so the CSP can list the hashes of its inline scripts (the header is sent
  // before the body). Pages are small; other content types stream through untouched.
  let hashes: string[] = [];
  if (response.headers.get('content-type')?.includes('text/html')) {
    const html = await response.text();
    hashes = inlineScriptHashes(html);
    response = new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const headers = securityHeaders(import.meta.env.PUBLIC_BFF_URL, mode(), hashes);
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
});
