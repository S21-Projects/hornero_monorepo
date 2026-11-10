# Implementation Plan: Admin Backoffice (separate domain + own BFF)

**Status:** Plan — not yet implemented
**Date:** 2026-06-18
**Topology chosen:** Separate domain with its own BFF (isolated origin, independent session).

## Context

Admin functionality (organization validation, user management, metrics panel) currently
lives inside the public `ts_hornero_app` and is gated through a mixed role matrix in
`src/proxy.ts`. We want to extract it into a dedicated backoffice on its own origin and its
own BFF.

Because `access_token` / `refresh_token` are `httpOnly`, a second app on a different origin
**cannot share the public app's cookies**. The backoffice needs its own session. This is
viable because the **MS (`jar_hornero_ms`) is the single JWT issuer** (shared `JWT_SECRET`):
the new admin BFF authenticates against the same MS and issues its own cookies on the admin
origin. The MS and the database are reused unchanged.

## Pre-existing security gap (must close)

The public BFF does **not** enforce `@Roles(ADMINISTRADOR)` on the organization admin routes
(`GET /organizaciones/pendientes`, `PATCH /:id/validar`, `PATCH /:id/rechazar`). They only
forward the cookie to the MS and rely on the MS `@PreAuthorize`. User routes (`/usuarios`,
`/usuarios/:id/activo`) do enforce it. The new admin BFF must enforce roles on **every** admin
route, closing this gap.

## Target architecture

```
Browser (admin) → ts_hornero_admin_app  :3100  (new Next.js)
                → ts_hornero_admin_bff   :3101  (new NestJS)
                → jar_hornero_ms         :8081  (same MS, unchanged)
                → PostgreSQL                     (same database)
```

Two new services in the monorepo (`ts_hornero_admin_app`, `ts_hornero_admin_bff`), each with
its own `Dockerfile` and independent Railway deploy. The MS reads `Authorization: Bearer`
only; the admin BFF forwards the cookie token as a Bearer header, same pattern as the
existing BFF.

## Authorization: three-layer model in the admin stack

| Layer | Today | In the backoffice |
|---|---|---|
| MS (`@PreAuthorize hasRole('ADMINISTRADOR')`) | Enforces pendientes/validar/rechazar/usuarios | Unchanged — remains the real authority |
| BFF (`@Roles`) | usuarios YES, organizaciones NO | Every admin route guarded with `@Roles(ADMINISTRADOR)` |
| Frontend (`proxy.ts`) | Mixed matrix of roles/routes | Single gate: everything requires ADMINISTRADOR, else `/login` |

## Admin-only login gate (new logic)

The MS `/api/auth/login` issues a JWT to any valid user. The admin BFF adds a role gate:

1. Admin BFF receives credentials → calls MS `POST /api/auth/login`.
2. Decode the `tipo` claim from the returned JWT.
3. If `tipo !== 'ADMINISTRADOR'` → reject, do **not** set cookies (`403`).
4. If admin → set `access_token` / `refresh_token` / `session_hint` on the admin origin.

Refresh and logout: copy the existing BFF `auth.service.ts` logic, pointed at the same MS.

## Admin BFF routes (:3101)

| Method + path | Guard | Forwards to MS |
|---|---|---|
| `POST /auth/login` | public + post-login ADMINISTRADOR gate | `/api/auth/login` |
| `POST /auth/refresh` | public | `/api/auth/refresh` |
| `POST /auth/logout` | public | — (clears cookies) |
| `GET /organizaciones/pendientes` | `@Roles(ADMINISTRADOR)` | `/api/organizaciones/pendientes` |
| `PATCH /organizaciones/:id/validar` | `@Roles(ADMINISTRADOR)` | same on MS |
| `PATCH /organizaciones/:id/rechazar` | `@Roles(ADMINISTRADOR)` | same on MS |
| `GET /usuarios` | `@Roles(ADMINISTRADOR)` | `/api/usuarios` |
| `PATCH /usuarios/:id/activo` | `@Roles(ADMINISTRADOR)` | same on MS |
| `GET /organizaciones`, `/necesidades`, `/donaciones` | `@Roles(ADMINISTRADOR)` | read-only for metrics panel |

Reuse `JwtStrategy`, `RolesGuard`, `JwtAuthGuard`, `@Public()`, `@Roles()` from the existing
BFF almost verbatim.

## Admin app routes (:3100)

| Route | Source |
|---|---|
| `/login` | new (admin login) |
| `/` or `/panel` | move from `app/panel/page.tsx` + `AdminShell` |
| `/organizaciones` | move from `app/admin/page.tsx` + `PendingOrgsList` |
| `/usuarios` | move from `app/users/page.tsx` |

`proxy.ts` (admin app): matcher over everything except `login`/`_next`/static; decode `tipo`
from `access_token` (no signature verification, UX-only, same as today); if not
`ADMINISTRADOR` → redirect `/login`. Simpler than the current matrix: a single valid role.

Components/hooks to port: `AdminShell`, `PendingOrgsList`, `usePanelMetricas`,
`useValidateOrgMutation`, `useRejectOrgMutation`, `useToggleActivoMutation`, and the API
functions in `lib/api/organizaciones.ts` + `lib/api/usuarios.ts`. Point `NEXT_PUBLIC_BFF_URL`
at the admin BFF.

## Changes to remove from the existing public app

- `src/proxy.ts`: remove `ADMINISTRADOR` branches and the `/admin`, `/users` routes from the matcher.
- Delete pages `app/admin/`, `app/users/`, `app/panel/` (migrated).
- Public BFF: remove `GET /usuarios`, `PATCH /usuarios/:id/activo`, and the 3 organization
  admin routes. Reduces attack surface — the public app no longer needs admin endpoints.
- The uncommitted `dashboard/page.tsx` change (DONANTE redirect + pending-state fix) stays;
  its admin branch becomes unnecessary.

## Config / new env vars

**admin BFF:** `PORT=3101`, `JWT_SECRET` (same as MS), `JAVA_MS_URL` (same internal MS),
`FRONTEND_URL`=admin app origin, `COOKIE_DOMAIN`=its own origin.

**admin app:** `NEXT_PUBLIC_BFF_URL`=admin BFF (build ARG — baked into the bundle),
`BFF_BASE_URL`=internal admin BFF URL.

CORS: admin BFF allows only the admin app origin (`credentials: true`). The MS needs no CORS
changes — it only receives server-to-server traffic.

## Phases

1. **Scaffolding** — `ts_hornero_admin_bff` with auth (login gate + refresh + logout) against the MS. Validate with Bruno.
2. **Admin BFF routes** — organizaciones + usuarios with `@Roles`.
3. **Admin app** — login + `proxy.ts` + port the 3 pages and components.
4. **Public app cleanup** — remove admin pages/routes/guards.
5. **Docker + Railway** — Dockerfiles and deploys for both new services.

## Main risk

**BFF duplication.** The admin BFF is ~70% a copy of the existing BFF's auth edge. For this
project, copying is the pragmatic choice for the first iteration. If auth ends up changing
often across both, evaluate extracting a shared `@hornero/bff-auth` package later — not in the
first pass.
