# admin-referentes-v2

## Objective
Implement the "v2 · Referentes" board of the design canvas "Referentes y organizaciones — rediseño"
(https://claude.ai/artifact/PjgMYWsdFipLxBPXB3RzXX, file `project/V2Referentes.dc.html`) in
`ts_hornero_admin/src/routes/referentes.tsx`.

## Problem / why
`admin-tabla-drawer` moved Reclamos, Control de donaciones and Usuarios to the common
PaginatedTable + Drawer pattern but left Referentes out ("new design version pending"). Referentes
still uses its own expandable-row list + Pager.

## Scope
- Layout: left column with "Bandejas" (Por revisar / Sin referente / Todas, with counts) and a
  "Referentes" list (filter by referente, with counts); main area with view title + subtitle,
  search ("Buscar por nombre o barrio") + tipo filter, table Organización / Referente / Estado,
  rows per page selector, pagination.
- Row selection checkboxes + bulk bar ("Aplicar" a referente to the selection, "Quitar selección").
- Clicking a row opens the shared `Drawer` with tabs Asignación / Info pública (badge when there is a
  pending change) / Legajo. Asignación: referente select + "Guardar asignación". Info pública:
  pending-change review with "Aprobar cambios" and "Rechazar" (motivo required, "Confirmar rechazo").
- Reuse existing hooks (useOrganizacionesAdmin, useUsuarios, useAsignarReferente,
  useAdminInfoPublica, usePageClamp) and existing UI atoms; server-side filtering/pagination as today.

## Constraints
- Frontend only, no BFF/MS changes. If a design element needs data the API does not expose
  (counts, filters, bulk endpoint), degrade gracefully and record the gap here.
- Work directly on `develop` (user decision 2026-11-03). Do not commit without asking the user.
- Domain terms Spanish, code in English as in the rest of the app.

## TDD
Mode: off (no project/session configuration enables it). Runner: vitest (`npm test` in
`ts_hornero_admin`). Ordinary functional checks apply.

## Tasks
- [x] T1 Rebuild `referentes.tsx` on the v2 layout (bandejas + referentes sidebar, toolbar,
  PaginatedTable, Drawer with Asignación / Info pública / Legajo tabs, bulk assignment), update
  `referentes.test.tsx`. Route: delegated direct (writer trigger: 2+ non-trivial files).

## Checks
- `npm run lint`, `npm test`, `npm run build` in `ts_hornero_admin`.

## Progress
- 2026-11-03: document created; T1 delegated.
- 2026-11-03: T1 done (uncommitted). Files: routes/referentes.tsx, routes/referentes.test.tsx,
  components/org/OrgReferenteDrawer.tsx (new), components/ui/PaginatedTable.tsx (optional
  `selection`/`banner`), components/ui/Drawer.tsx (optional tab `badge`),
  lib/hooks/useOrganizacionesPendientes.ts (optional `enabled`). Checks: lint 0 errors (3 warnings
  in generated coverage/), npm test 698 passed, npm run build OK; parent spot check
  referentes.test.tsx 9 passed. RDD off.

## Gaps vs design (API limits, frontend-only scope)
1. Rejection motivo is required in the UI but not sent: `PATCH info-publica/rechazar` has no body. Needs a decision.
2. "Por revisar" uses `/organizaciones/pendientes` (estado PENDIENTE only); pending info-pública changes on other estados only show as a badge.
3. No search in "Por revisar" (endpoint has no `q`).
4. No tipo filter (not supported server-side).
5. Search by name only; barrio not in `OrganizacionAdmin` (row shows tipo · dirección).
6. No per-referente counts; bandeja counts use size=1 queries reading totalElements.
7. Rail referentes capped at 100 (MS page limit), with a search box.
8. Legajo tab shows available data + link to full legajo (no acreditación level).
9. Inline status line instead of toast.

## Next step
User decides on gap 1 (backend motivo) and on committing.
