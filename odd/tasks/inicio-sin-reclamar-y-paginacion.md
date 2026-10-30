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
- [ ] T2 — Astro home: drop the SSR fetch of all pins; when the chip is on, fetch the viewport from
  the browser on `moveend` (debounced), skip below a min zoom with a hint, loading indicator,
  clustering; "Mi ubicación" button (port admin `useGeolocation`, `geolocation=(self)`), list
  sorted by user position. Route: delegated.
- [ ] T3 — Admin referentes: paginated, searchable "Sin referente" list and per-referente orgs from
  a paginated/filtered MS endpoint instead of `/organizaciones/todas`. Route: delegated.
- [ ] T4 — Admin pagination sweep: `useOrgNombre` (size 100 cap), `/donaciones/mi-organizacion`
  (grows unbounded), page-0-only summaries in `reclamos.tsx`, users search limited to the current
  page. Route: delegated.

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

## Next step

Delegate T2.
