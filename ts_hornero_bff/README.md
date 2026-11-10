# ts_hornero_bff

Backend-for-frontend of Hornero (NestJS 11, Node 20). A thin proxy and aggregator between the browser
apps and the domain microservice. It holds no database and no domain logic.

## Role in the chain

```
ts_hornero_astro / ts_hornero_admin  ->  ts_hornero_bff :3001  ->  jar_hornero_ms :8081
```

- Receives every browser request from the admin SPA (with credentials) and the public reads from Astro.
  Routes have **no** `/api` prefix (only the MS has one).
- Forwards to the MS at `${JAVA_MS_URL}/api/...`, copying the `access_token` cookie into a `Bearer` header
  for writes.
- Owns the auth cookies: `access_token` (httpOnly, 15 min), `refresh_token` (httpOnly, 7 days) and
  `session_hint` (readable flag, no role). `sameSite` is `none` + `secure` when `NODE_ENV=production`,
  `lax` otherwise. The role is resolved by clients through `GET /auth/me`.
- Handles file uploads and image processing (sharp) against an S3-compatible bucket.

## Main modules

Source in `src/`, one NestJS module per resource, each with `*.controller.ts`, `*.service.ts` and `dto/`:

| Module | Responsibility |
|---|---|
| `auth` | Login, register, refresh, logout, `JwtStrategy` (reads the cookie), `RolesGuard` + `@Roles(...)`, `@Public()` |
| `organizaciones`, `reclamos`, `reportes` | Organizaciones, claims and reports |
| `acreditacion`, `evidencia-files` | Accreditation levels, evidence upload and authenticated download |
| `necesidades`, `articulos` | Needs and article catalogue |
| `donaciones`, `rondas` | Donations and ronda execution (proxied to the MS) |
| `usuarios`, `actividad` | User administration, session revocation, activity log |
| `upload`, `images` | S3 client (`@aws-sdk/client-s3`), image processing, public image serving |
| `common`, `app.setup.ts` | Shared pieces, Helmet, CORS, cookie parser, validation, Swagger setup |

Rate limiting (`@nestjs/throttler`) applies to auth routes. Swagger UI is served at `/api/docs`
(its Bearer scheme is not what the BFF uses; auth is the cookie).

## Run

Supported way: Docker from the repository root (`make up-local` or `make up`); see the
[root README](../README.md). Directly, with a reachable MS:

```bash
npm install
npm run start:dev      # watch mode
```

## Tests, lint, build

```bash
npm test                      # Jest unit tests (*.spec.ts next to the source)
npm test -- auth.controller   # one spec by name
npm run test:cov              # coverage
npm run test:e2e              # BFF e2e config (test/jest-e2e.json)
npm run lint                  # eslint --fix
npm run build                 # nest build
npm run start:prod            # node dist/main
```

API-level end-to-end tests of the whole stack live in [`../e2e/`](../e2e/README.md). A Bruno collection
for manual calls is in [`../bruno/`](../bruno/README.md).

## Environment variables (names only)

Defined in the repository `.env.example` and wired in `docker-compose.yml` (service `bff`).

| Variable | Purpose |
|---|---|
| `PORT` | Listen port (`3001` in Compose) |
| `JAVA_MS_URL` | Base URL of the MS (`http://ms:8081` in Compose) |
| `JWT_SECRET` | Must be identical to the MS value |
| `NODE_ENV` | `production` makes auth cookies `sameSite=none; secure` (HTTPS required) |
| `FRONTEND_URL`, `CORS_ORIGINS` | Allowed browser origins (credentials are sent) |
| `AWS_ENDPOINT_URL`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION` | S3-compatible bucket (Cloudflare R2 in production, MinIO locally) |
| `UPLOAD_MAX_MB` | Per-file upload limit in megabytes (default 5) |

## Related docs

- [`../CLAUDE.md`](../CLAUDE.md): authentication and authorization layers, how the layers talk.
- [`../docs/security-access-token-httponly.md`](../docs/security-access-token-httponly.md): cookie posture.
- [`../docs/tfg/seguridad-c2.md`](../docs/tfg/seguridad-c2.md): sessions.
- [`../docs/tfg/seguridad-c3.md`](../docs/tfg/seguridad-c3.md): evidence upload and download.
- [`../docs/pagination-rest-endpoints.md`](../docs/pagination-rest-endpoints.md): response envelope and pagination.
