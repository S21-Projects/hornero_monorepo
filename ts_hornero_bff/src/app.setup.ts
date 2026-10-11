import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {
  clientIpMiddleware,
  installClientIpForwarding,
} from './common/client-ip.js';
import { AxiosExceptionFilter } from './common/axios-exception.filter.js';
import { resolveAllowedOrigins } from './common/allowed-origins.js';
import { createOriginCheckMiddleware } from './common/origin-check.middleware.js';
import { VALIDATION_PIPE_OPTIONS } from './common/validation.js';

export const SWAGGER_PATH = 'api/docs';

// The BFF serves images (`/images`) that the Astro site and the admin SPA embed from another
// origin, so helmet's default `same-origin` Cross-Origin-Resource-Policy would break them.
const HELMET_BASE = {
  crossOriginResourcePolicy: { policy: 'cross-origin' as const },
  // No includeSubDomains: the parent domain hosts other sites we do not want to pin to HTTPS here.
  strictTransportSecurity: { maxAge: 15_552_000, includeSubDomains: false },
};

/** Everything but Swagger UI (HTML) returns JSON/binary, so helmet's default CSP is safe there. */
function securityHeaders() {
  const api = helmet(HELMET_BASE);
  // Swagger UI ships inline bootstrap code; the strict default CSP would blank the page.
  const docs = helmet({ ...HELMET_BASE, contentSecurityPolicy: false });
  return (req: any, res: any, next: any) =>
    (req.path.startsWith(`/${SWAGGER_PATH}`) ? docs : api)(req, res, next);
}

/** Bootstrap shared by `main.ts` and the specs, so tests exercise the real setup. */
export function configureApp(
  app: INestApplication,
  options: { allowedOrigins?: string[] } = {},
) {
  const allowedOrigins = options.allowedOrigins ?? resolveAllowedOrigins();

  app.use(securityHeaders());
  app.use(cookieParser());
  // N10: forward the visitor's IP to the MS on every proxied call (activity log).
  app.use(clientIpMiddleware);
  installClientIpForwarding();
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.useGlobalFilters(new AxiosExceptionFilter());
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, Swagger).
      // Disallowed origins are rejected cleanly (no header) rather than throwing a 500.
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Idempotency-Key',
    ],
    // N11: lets the SPA tell a replayed response from a first execution.
    exposedHeaders: ['Idempotent-Replayed'],
  });
  // After CORS so preflights (OPTIONS, never checked) are answered by it first.
  app.use(createOriginCheckMiddleware(allowedOrigins));
}
