# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hornero is a monorepo with services that form a single request chain. A NGO/donation
platform: organizations (`organizaciones`) post needs (`necesidades`); donors (`donantes`)
make donations (`donaciones`); admins validate organizations. Domain terms are Spanish; keep
that convention in new code.

```
Browser → ts_hornero_astro :4321 (Astro SSR — public/anonymous site)
        → ts_hornero_admin :5173 (React/Vite SPA — all authenticated roles)
        → ts_hornero_bff   :3001 (NestJS BFF — auth proxy + aggregation)
        → jar_hornero_ms   :8081 (Spring Boot — domain logic, JWT issuer)
        → PostgreSQL       :5432
jar_hornero_ms → go_algorithms_worker :8090 (Go — donation assignment rondas; internal only,
                 no host port; the MS calls it over HTTP at WORKER_URL=http://worker:8090)
```

The worker is only called when an ADMINISTRADOR triggers a ronda (`POST /api/rondas`); the MS
starts and serves everything else when it is down (the ronda answers 503). Its `metrics` and
`assign` CLI subcommands still exist for offline batch runs.

The original Next.js frontend (`ts_hornero_app`) was removed on 2026-11-10. Frontend work goes
into `ts_hornero_astro` (public) or `ts_hornero_admin` (authenticated).

The services were originally separate git repos, merged into this monorepo on 2026-06-08
(histories not migrated). Production runs self-hosted on a Raspberry Pi behind a Cloudflare
Tunnel — Railway has been fully decommissioned. See `docs/deploy-rpi-cloudflare.md` for the
deploy runbook.

## Commands

Docker only — there is no native/hot-reload dev mode. Two full-stack modes via the root `Makefile`:

```bash
make up              # prod-parity: full stack in Docker incl. Postgres, uses root .env as-is
make up-local        # fast local: uses .env.local (also starts MinIO, but the team's .env.local
                      # points AWS_* at the PRODUCTION R2 bucket — never enable destructive bucket code);
                      # sets SEED_DEMO_DATA=true (demo users/orgs; e2e needs this — prod seeds none,
                      # and requires SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD)
make down             # stop docker; `docker compose down -v` to also drop the DB volume
make e2e              # API-level e2e tests (e2e/) against an already-running `make up-local` stack
make escenario ESC=fondo-comun N=5  # leave the local stack in a known state for manual UI testing (no ESC lists them; see e2e/README.md)
make seed             # run scripts/seed.ts against the BFF (creates seed users/orgs)
make backup           # verified pg_dump (custom format) of the running postgres into backups/ (gitignored),
                      # via scripts/backup/backup.sh
make restore-check    # restore the newest dump into a throwaway postgres and sanity-check it (never touches the real DB)
make coverage         # report-only line coverage for ms, bff, admin and worker (see docs/validacion-calidad.md)
make demo-up          # thesis demo stack: dedicated compose project `hornero-demo`, generated .env.demo, local MinIO
make demo-seed        # load the fictional demo data (about 2 min) and print the logins
make demo-verify EMAIL=x@example.com  # mark a demo account verified (stands in for the OTP email)
make demo-reset       # wipe the demo project's own volumes and reseed
make demo-down        # stop the demo stack, keep its data
make migrate          # backup, then apply every scripts/sql/V*.sql in order (idempotent);
                      # add ENV_FILE=.env.local for the local stack, restart ms afterwards
```

In production, the Pi runs `docker compose up --build -d` directly, not through the Makefile
(see `docs/deploy-rpi-cloudflare.md`).

Per-service commands below still work for running tests/lint/build directly — just not wired
into the Makefile as a `make dev-*` shortcut anymore (run from the service directory):

```bash
# jar_hornero_ms  (Java 17 / Maven)
mvn spring-boot:run
mvn test                                  # all tests
mvn test -Dtest=NecesidadServiceTest      # single test class
mvn test -Dtest=NecesidadServiceTest#crea # single test method

# ts_hornero_bff  (NestJS / Node 20)
npm run start:dev      # watch mode
npm test               # jest unit tests (*.spec.ts next to source)
npm test -- auth.controller    # single spec by name
npm run lint           # eslint --fix
npm run test:e2e

# ts_hornero_astro  (Astro SSR)
npm run dev
npm run build
npm run preview

# ts_hornero_admin  (React 19 / Vite SPA)
npm run dev
npm run build           # tsc -b && vite build
npm run lint
npm test                # vitest run

# go_algorithms_worker  (Go)
go test ./...
go vet ./...
go run . serve --addr :8090 --data data/renacom.csv   # the HTTP mode compose runs
```

There is no root-level aggregate lint/test command — run them per service.

## Authentication & authorization (the core cross-cutting concern)

JWT is issued by the **MS** (`JwtService`, HS256). The `JWT_SECRET` env var **must be identical
in the MS and the BFF** or token validation silently fails. Access token = 15 min, refresh = 7 days.

The access-token JWT carries a `tipo` claim = the user's role discriminator. User roles:
`ADMINISTRADOR`, `REFERENTE` (org contact), `DONANTE`. `Usuario` is a JPA single-table inheritance
hierarchy (`@DiscriminatorColumn("tipo")`) with subclasses `Administrador` / `Referente` / `Donante`;
the discriminator value becomes the JWT `tipo` claim (see `JwtService.resolveDiscriminatorValue`).

**Three independent enforcement layers — keep them in sync when changing access rules:**

1. **MS** (`SecurityConfig`): stateless filter chain. `/api/auth/**` and `GET` on
   `organizaciones`/`necesidades`/`donaciones` are public (`permitAll`); everything else needs a
   valid JWT. `JwtAuthFilter` runs before the username/password filter. This is the real authority.
2. **BFF** (`RolesGuard` + `@Roles(...)` decorator, `JwtStrategy`): reads the JWT from the
   `access_token` **cookie** (not the Authorization header). `@Public()` opts a route out of auth.
   When forwarding a write to the MS, the BFF copies the cookie token into a `Bearer` header
   (see `NecesidadesService.crear`).
3. **`ts_hornero_admin` (React/Vite SPA, the only place authenticated routing exists now)**:
   `src/app/ProtectedRoute.tsx` (`ProtectedRoute` / `PublicOnlyRoute`) drives route access off
   `useAuthStore` (`src/store/auth.store.ts`), which is populated by `GET /auth/me` — never by
   decoding the cookie, since `access_token` is httpOnly and unreadable from JS. UX redirects
   only, never trusted for security.

**Cookie model (set by the BFF in `auth.service.ts` `setCookies`):**
- `access_token` — `httpOnly: true`, 15 min. NOT readable in JS.
- `refresh_token` — `httpOnly: true`, 7 days.
- `session_hint` — value `'1'`, `httpOnly: false`, 15 min. The only JS-readable flag — it
  signals that a session may exist but carries NO role.
- `sameSite` is `none` (with `secure`) in production, `lax` in dev. All three are cleared on logout.
- The role is NOT in a cookie: clients resolve it via `GET /auth/me` → `{userId, email, nombre, tipo}`.
- Rationale/tradeoffs of this posture are in `docs/security-access-token-httponly.md`.

`ts_hornero_admin`'s axios client (`src/lib/axios.ts`) auto-refreshes on 401 via a single-flight
queue, then retries; on refresh failure it redirects to `/login` only if `session_hint` was
present (checked via `document.cookie`, since `access_token` itself is unreadable).

## How the layers talk

- **BFF → MS**: every BFF service injects `HttpService` + `ConfigService` and calls
  `${JAVA_MS_URL}/api/...`. The BFF is a thin proxy/aggregator — it holds no DB and no domain logic.
  Mirror the existing `*.service.ts` / `*.controller.ts` / `dto/` structure per resource.
- **Astro → BFF**: server-side rendering uses `src/lib/publicFetch.ts`, which calls
  `BFF_BASE_URL` (a runtime env var, e.g. `http://bff:3001` in `docker-compose.yml`) with plain
  `fetch`, no cookies or auth forwarded — Astro only serves public/anonymous data. Client-side
  islands (e.g. `HomeMapExplorer.tsx`) that need to build asset URLs (org images) use
  `PUBLIC_BFF_URL`, a build-time env var exposed to the browser via Vite's `import.meta.env`.
- **Admin (SPA) → BFF**: all requests go through the axios instance in `src/lib/axios.ts`,
  `baseURL: import.meta.env.VITE_BFF_URL` (Vite build-time env, no `/api` prefix — only the MS
  has one), `withCredentials: true` so the httpOnly cookies ride along. Server state lives in
  TanStack Query hooks; non-server state (auth session, etc.) lives in Zustand (`src/store/`).
- Both `PUBLIC_BFF_URL` (astro, build arg) and `VITE_BFF_URL` (admin, build arg) are **baked in
  at build time** — changing them requires a rebuild, and in Docker they're build ARGs, not
  runtime env vars. `BFF_BASE_URL` (astro's server-side var) is the one runtime exception.

## MS persistence notes

- `spring.jpa.hibernate.ddl-auto=update` — schema is auto-migrated from entities. There is no
  Flyway/Liquibase; what `ddl-auto` cannot do (relax NOT NULL, widen CHECK constraints, triggers, indexes)
  lives in the hand-written idempotent `scripts/sql/V001`..`V015` (`make migrate`). Be deliberate about
  entity changes against a shared DB.
- `DataInitializer` seeds the admin and demo accounts on startup when `SEED_DEMO_DATA=true`
  (credentials: `e2e/README.md`). Without it, `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` are required.
- The healthcheck used by docker-compose hits the public springdoc endpoint `/v3/api-docs`
  (no actuator dependency) — keep that endpoint public if you touch `SecurityConfig`.

## Object storage

Images (org banners/profiles) live in an S3-compatible bucket — Cloudflare R2 in production
(`hornero-images`). The BFF (`ts_hornero_bff/src/upload/upload.service.ts`) uses
`@aws-sdk/client-s3` with `forcePathStyle: true`, `region: 'auto'`, reading
`AWS_ENDPOINT_URL` / `AWS_S3_BUCKET_NAME` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` /
`AWS_DEFAULT_REGION` from env. A local MinIO is available behind the opt-in
`docker-compose --profile minio` for anyone without an external bucket; the Pi deployment uses
R2 (it only has a microSD, so images stay off-device).

The MS also reads the same `AWS_*` vars, but only to **delete** claim evidence
(`reclamo-evidencia/` and nothing else): after a user is anonymized
(`EvidenciaBorradoListener`) and in a nightly orphan sweep (`EvidenciaHuerfanaBarridoJob`, kill
switch `EVIDENCIA_BARRIDO_ENABLED=false`). Deletion is **opt-in**: only with
`EVIDENCIA_BORRADO_ENABLED=true` (set on the Pi only) and the `AWS_*` vars present does the MS build the
S3 store; otherwise it uses a no-op store. Local stacks point at the production R2 bucket, so never
enable it locally.

## Other directories

- `bruno/` — Bruno API collection for manual endpoint testing.
- `claude_design/` — standalone JSX/CSS design mockups (a design system canvas), **not** wired into
  the running app; reference only.
- `scripts/seed.ts` — DB seeding run via `make seed` (invoked from `ts_hornero_bff`).
- `scripts/sql/` — hand-written, idempotent schema scripts for changes `ddl-auto=update` cannot
  make (relaxing NOT NULL, widening enum CHECK constraints). Applied with `make migrate`; see
  `scripts/sql/README.md`. The MS `EsquemaVerificador` reports a pending script at startup.
- `.env.example` — template for the root `.env` (prod-parity, `make up`), the single source of
  truth for every service. `.env.local` (`make up-local`) is a copy of it with
  `MAIL_LOG_ONLY=true`. In practice the team's `.env.local` uses the production R2 bucket
  (`hornero-images`); blank `AWS_*` would fall back to local MinIO. There is no separate template.
- `scripts/demo/demo.sh` — guarded demo stack behind `make demo-*` (own compose project, never reads
  `.env`/`.env.local`); data comes from `e2e/scenarios/demo-seed.ts`. See `e2e/README.md`.
- `scripts/backup/` — `backup.sh`, `restore-check.sh`, `evidence-copy.sh` behind `make backup` /
  `make restore-check` and the systemd units in `deploy/systemd/`.
- `scripts/mapa/` — vulnerability-map data pipeline (`make mapa-datos`, `importar-renacom`,
  `importar-poblacion`, `mapa-radios`); see `scripts/mapa/README.md`.
- `docs/tfg/` and `docs/tesis/` — thesis material (business rules, inventory, security annexes, test
  evidence, diagrams in `docs/tfg/diagramas/` and `docs/tesis/diagramas/`). Spanish; read-only reference
  for feature work.
- `docs/deploy-rpi-cloudflare.md` — production deploy runbook (Raspberry Pi + Cloudflare Tunnel).
