# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hornero is a monorepo with three services that form a single request chain. A NGO/donation
platform: organizations (`organizaciones`) post needs (`necesidades`); donors (`donantes`)
make donations (`donaciones`); admins validate organizations. Domain terms are Spanish; keep
that convention in new code.

```
Browser → ts_hornero_app :3000 (Next.js)
        → ts_hornero_bff :3001 (NestJS BFF — auth proxy + aggregation)
        → jar_hornero_ms :8081 (Spring Boot — domain logic, JWT issuer)
        → PostgreSQL :5432
```

The three services were originally separate git repos, merged into this monorepo on 2026-06-08
(histories not migrated). Each still has its own `Dockerfile` and deploys independently on Railway.

## Commands

All dev workflows run through the root `Makefile`, which auto-loads a root `.env*` file (`ENV_FILE`
defaults to `.env`). There are three run modes — see `README.md` for the full matrix.

```bash
make up              # full stack in Docker incl. Postgres (uses .env)
make start-local     # all 3 services as local processes + Postgres in Docker (uses .env.local)
make start-desa      # all 3 services local + Railway-hosted DB (uses .env.desa)
make down            # stop docker; add `-v` to drop the DB volume
make seed            # run scripts/seed.ts against the BFF (creates seed users/orgs)
```

Per-service commands (run from the service directory):

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

# ts_hornero_app  (Next.js 16 / React 19)
npm run dev
npm run build
npm run lint
```

There is no root-level aggregate lint/test command — run them per service.

## ⚠️ Next.js 16 — read before touching the frontend

`ts_hornero_app` uses **Next.js 16 / React 19**, which has breaking changes from earlier
versions you may know. Per `ts_hornero_app/AGENTS.md`: **read the relevant guide in
`ts_hornero_app/node_modules/next/dist/docs/` before writing frontend code.** Notable here:

- Route protection lives in `src/proxy.ts` (this is Next 16's renamed middleware — `export function proxy`, not `middleware`).
- React Compiler is enabled (`babel-plugin-react-compiler`).

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
3. **Frontend** (`src/proxy.ts`): route guards that decode the JWT **without verifying the
   signature** — UX redirects only, never trusted for security. The guard matrix is documented in a
   table at the top of that file.

**Cookie model (set by the BFF in `auth.service.ts` `setCookies`):**
- `access_token` — `httpOnly: true`, 15 min. NOT readable in JS.
- `refresh_token` — `httpOnly: true`, 7 days.
- `session_hint` — value `'1'`, `httpOnly: false`, 15 min. The only JS-readable flag — it
  signals that a session may exist but carries NO role.
- `sameSite` is `none` (with `secure`) in production, `lax` in dev. All three are cleared on logout.
- The role is NOT in a cookie: the frontend resolves it via `GET /auth/me` → `{userId, email, nombre, tipo}`.
- Rationale/tradeoffs of this posture are in `docs/security-access-token-httponly.md`.

The frontend axios client (`src/lib/axios.ts`) auto-refreshes on 401 via a single-flight queue,
then retries; on refresh failure it redirects to `/login` only if `session_hint` was present.
The React/Vite SPA (`ts_hornero_admin`) cannot read `access_token` (httpOnly), so its guards key off
`session_hint` + `GET /auth/me` rather than decoding the JWT client-side.

## How the layers talk

- **BFF → MS**: every BFF service injects `HttpService` + `ConfigService` and calls
  `${JAVA_MS_URL}/api/...`. The BFF is a thin proxy/aggregator — it holds no DB and no domain logic.
  Mirror the existing `*.service.ts` / `*.controller.ts` / `dto/` structure per resource.
- **App → BFF**: two paths.
  - Server Components / loaders use `src/lib/serverFetch.ts`, which forwards the incoming request's
    cookies to `BFF_BASE_URL` (server-side env, internal URL).
  - Client Components use the axios instance against `NEXT_PUBLIC_BFF_URL` with TanStack Query
    hooks in `src/lib/hooks/` and `src/hooks/`. State that isn't server data lives in Zustand
    (`src/store/`).
- `NEXT_PUBLIC_BFF_URL` is **baked into the bundle at build time** — changing it requires a
  rebuild/dev-server restart, and in Docker/Railway it's a build ARG, not a runtime env var.

## MS persistence notes

- `spring.jpa.hibernate.ddl-auto=update` — schema is auto-migrated from entities; there are no
  migration files. Be deliberate about entity changes against a shared DB.
- `DataInitializer` seeds the admin and demo accounts on startup (see README for credentials).
- The healthcheck used by docker-compose hits the public springdoc endpoint `/v3/api-docs`
  (no actuator dependency) — keep that endpoint public if you touch `SecurityConfig`.

## Other directories

- `bruno/` — Bruno API collection for manual endpoint testing.
- `claude_design/` — standalone JSX/CSS design mockups (a design system canvas), **not** wired into
  the running app; reference only.
- `scripts/seed.ts` — DB seeding run via `make seed`.
- `.env.example`, `.env.local.example`, `.env.desa.example` — templates for the three run modes.
