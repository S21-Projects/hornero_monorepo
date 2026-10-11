import { defineMiddleware } from 'astro:middleware';
import { securityHeaders } from './lib/securityHeaders';

const headers = securityHeaders(import.meta.env.PUBLIC_BFF_URL);

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
});
