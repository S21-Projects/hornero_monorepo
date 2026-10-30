# Feature: unclaimed orgs on the home map + admin pagination

Branch: `feat/inicio-chip-sin-reclamar` (from `develop`).

## Objective

Show the ~2730 ReNaCoM unclaimed organizations (`SIN_RECLAMAR`) on the public home without ever
shipping the whole dataset, let visitors locate themselves and see what is near them, and keep
every admin list usable now that the organizaciones table holds thousands of rows.

## Problem / why

- Importing ReNaCoM (`make importar-renacom`) put 2730 `SIN_RECLAMAR` orgs in the DB. The home
  only listed `APROBADA` orgs, so they were invisible outside `/mapa`.
- The first chip version embedded all 2730 pins in the home HTML (~1 MB) and drew them as
  individual Leaflet markers.
- The public site has no geolocation (`Permissions-Policy: geolocation=()`), so the list is sorted
  by distance to Córdoba even for visitors in Buenos Aires.
- Admin "Referentes y organizaciones" calls `GET /organizaciones/todas` (bare `List`, `findAll()`)
  and renders all ~2700 unreferenced orgs in one card.

## Scope

- MS + BFF: viewport (bbox) query for map pins; paginated, filterable admin org listing.
- Astro home: chip loads unclaimed pins per viewport on demand, min-zoom guard, loading state,
  marker clustering, "Mi ubicación" button, list sorted by the visitor's position.
- Admin: paginate the referentes page org lists; fix other lists that silently cap or grow.

Out of scope: BFF public/admin split, PostGIS, changing `/mapa` (vulnerability page).

## Constraints

- Pagination convention: `?page=0&size=20&sort=campo,desc`, default 20, cap 100, envelope
  `{status,message,timestamp,data,errors}` with `PageData<T>`.
- Keep the three auth layers in sync (MS `SecurityConfig`, BFF `@Roles/@Public`, admin routes).
- New schema changes that `ddl-auto=update` cannot express go to `scripts/sql/V0xx__*.sql`.
- TDD: off (no project/session configuration found); ordinary functional checks per task.
  Runners: MS `mvn test`, BFF `npm test` + `npm run lint`, admin `npm test` + `npm run build`,
  Astro `npm run build` + `npx astro check` (no test runner).
- Receipt-driven development: off (default) — no native review.
- Delivery: `ask-on-risk`; forecast exceeds ~400 authored lines, chain strategy to be asked
  before opening any PR. Commits stay local until the user asks to push.

## Tasks

- [x] T0 — Home chip "Sin reclamar" (first version: SSR fetch of `/organizaciones/mapa`, list cap 30,
  gray pins). Route: delegated (2+ files). Checks: astro build PASS, astro check 0 errors.
  User tested it in the browser. Superseded in part by T2 (no SSR fetch).
- [x] T1 — MS + BFF: `GET /organizaciones/mapa/zona?minLat&maxLat&minLng&maxLng` (public) returning
  `{pins: OrgMapa[], truncated}` (APROBADA + SIN_RECLAMAR, inclusive box, cap 500, order by id,
  `max-age=60`); `V012__organizaciones_lat_lng_idx.sql`; global 400 for type mismatches.
  Route: delegated (MS+BFF, 2+ files). Checks: `mvn test` 1073/0 failures; BFF `npm test` 420/420;
  `npm run lint` fails on base (313 pre-existing errors, new spec clean). Smoke: Gran Buenos Aires box
  returns 500 pins + truncated=true; `minLat=abc` → 400. Commit `9a1e55f`.
- [x] T2 — Astro home: drop the SSR fetch of all pins; when the chip is on, fetch the viewport from
  the browser on `moveend` (debounced), skip below a min zoom with a hint, loading indicator,
  clustering; "Mi ubicación" button (port admin `useGeolocation`, `geolocation=(self)`), list
  sorted by user position. Route: delegated. Done: `react-leaflet-cluster@4.1.3`, min zoom 11, debounce
  300 ms, 0.02° box snapping + 40-box cache, pins replaced per viewport. Checks: astro build PASS,
  astro check 0 errors; home HTML 1 MB → 17 KB with no SIN_RECLAMAR data; header
  `geolocation=(self)` served. Commit `6d735e2`.
- [x] T3 — Admin referentes: paginated, searchable "Sin referente" list and per-referente orgs from
  a paginated/filtered MS endpoint instead of `/organizaciones/todas`. Route: delegated. Done:
  `/organizaciones/todas` now returns `PageData` with `sinReferente`, `referenteIds` (≤100), `q`;
  admin `useOrganizacionesAdmin` replaces `useTodasOrganizaciones`. Checks: `mvn test` 1084/0;
  BFF 423 passed; admin 601 passed, build OK, lint 0 errors; prettier fixed on the two BFF files.
  Smoke: anonymous `/organizaciones/todas` → 401. Limitation: `/usuarios` has no `tipo`/`q` filter,
  so referente search and the reassign dropdown only cover the current page (moved to T4).
  Commit `b2c1521`.
- [x] T4 — Admin pagination sweep: `useOrgNombre` (size 100 cap), `/donaciones/mi-organizacion`
  (grows unbounded), page-0-only summaries in `reclamos.tsx`, users search limited to the current
  page. Route: delegated. Done: `/donaciones/mi-organizacion` paginated (MS + BFF + admin), `useOrgNombre`
  size-100 cap, reclamos summaries and user search fixed. Checks: `mvn test` 1099/0; BFF 430 passed;
  admin 609 passed, build OK. Commit `e241c7f`. Regression found: the dashboard action lists only saw
  the current page (fixed in T5).
- [x] T5 — Fix T4 regression: `mi-organizacion` accepts an optional `estado` filter (comma-separated or
  repeated `EstadoDonacion`, invalid value -> 400); the referente dashboard action lists ("pendientes de
  decisión" = OFRECIDA, "para confirmar entrega" = ACEPTADA/EN_CAMINO/PENDIENTE_CONFIRMACION) query it
  server-side at size 100 with a "Mostrando N de M" note; the history keeps its Pager. Delivery
  verification (`useVerificarCodigo`) now invalidates `['donaciones']`. Bruno `donaciones/mi-organizacion.bru`.
  Route: delegated (2+ non-trivial files across MS/BFF/admin). Checks: `mvn test` 1106/0; BFF `npm test`
  432 passed, `npx eslint` on changed files reports the same 53 pre-existing type-aware errors before and
  after; admin `npm test` 612 passed, build OK, lint 0 errors (3 pre-existing warnings). Commit `0fc0745`.

## Acceptance criteria

- Home HTML no longer contains the unclaimed dataset; with the chip on, only pins of the visible
  area are requested, never more than the cap per request.
- Zoomed out beyond the min zoom, no request is made and a hint is shown.
- "Mi ubicación" centers the map on the visitor and the list orders by distance to them; denial
  falls back to Córdoba.
- Admin referentes page renders at most one page of orgs per section, with search and pager.
- All listed checks pass per task.

## Progress / evidence

- T0: commit `ba2a45f`.
- T1: commit `9a1e55f`. Dense areas (GBA) hit the cap: T2 must show a "zoom in" hint when `truncated`.

## Delivery

Strategy `ask-on-risk`; chain strategy chosen by the user: `stacked-to-main` (base `develop`).
Slice branches pushed to origin, each PR based on the previous one:

1. `feat/inicio-sin-reclamar-01-chip` — `ba2a45f` (T0), ~181 lines.
2. `feat/inicio-sin-reclamar-02-zona-endpoint` — `9a1e55f`, `8f75442` (T1), ~385 lines.
3. `feat/inicio-sin-reclamar-03-viewport-astro` — `6d735e2`, `2b65a0b` (T2), ~494 lines.
4. `feat/inicio-sin-reclamar-04-referentes-paginacion` — `b2c1521`, `99c1e25` (T3), ~689 lines,
   `size:exception` (single MS+BFF+admin contract change).
5. `feat/inicio-sin-reclamar-05-admin-paginacion` — `e241c7f`, `f62506e` (T4), ~1147 lines,
   `size:exception` (one commit, 43 files, coordinated contract change).
6. `feat/inicio-sin-reclamar-06-donaciones-estado` — `0fc0745`, `6db2dd6` (T5), ~405 lines.

PRs not opened yet: `gh` is not authenticated locally.

## Next step

Decide delivery chain strategy before any PR.
