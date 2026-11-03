# admin-tabla-drawer

Locator: `odd/tasks/admin-tabla-drawer.md` · Engram topic `odd/admin-tabla-drawer/tasks`
Worktree: `../hornero_app-tablas` · Branch: `feat/admin-tabla-drawer` (from `develop` @ 0861c1a)

## Objective
Apply the common admin table pattern (design canvas https://claude.ai/artifact/PjgMYWsdFipLxBPXB3RzXX, row "Iteración 2") to Reclamos, Control de donaciones and Usuarios: toolbar + filters, inner-scroll table, whole-row click opens a right-side drawer with the row's actions.

## Scope (authorized)
- Shared UI: `Drawer` atom (right side, scrim, focus trap, Esc closes, sticky footer, optional tabs) and `PaginatedTable` support for clickable rows (`onRowClick`, selected row highlight, keyboard accessible) + chip filters if useful.
- Reclamos: tabs Reclamos/Reportes kept; detail + approve/reject (motivo required) move from inline expand to the drawer; 3/3 orgs warning.
- Control de donaciones: detail + "Forzar estado" form move to the drawer (tabs Detalle / Forzar estado); keep search, estado filter, "Solo estancadas".
- Usuarios: activar/desactivar (motivo opcional) and anonimizar move to the drawer; anonimizar requires typing ANONIMIZAR.
- No checkboxes / bulk actions (user decision 2026-11-02).

Out of scope: Referentes (new design version pending), Auditoría, Actividad, Catálogo, Rondas; backend changes.

## Constraints
- UI copy in Spanish; code/comments in English. Inline-style + CSS variable tokens like existing atoms.
- Commits: work-unit commits approved 2026-11-03 (Phase A); later work stays uncommitted until the user approves. Do not touch the main worktree.
- TDD: not configured -> ordinary checks.
- Checks (ts_hornero_admin): `npm test`, `npm run lint`, `npm run build`.

## Tasks
- [x] T1 Drawer atom + PaginatedTable row click/selection (+ tests) — route: delegated writer
- [x] T2 Reclamos to drawer (+ tests) — route: delegated writer
- [x] T3 Control de donaciones to drawer (+ tests) — route: delegated writer
- [x] T4 Usuarios to drawer (+ tests) — route: delegated writer

### Phase B: server-side queries + loading states (user requirement 2026-11-03: "no manual filters in the front; everything queries with proper loading states"; UNCOMMITTED until approved)
Audit result: only `catalogo.tsx` filters client-side (search + categoria over the full `useArticulos` list, single page). All other admin lists (users, control-donaciones, reclamos, ReportesCola, rondas, actividad, auditoria, referentes) already send filters/page/size as query params with `keepPreviousData`. Remaining gap everywhere: loading states (table hidden behind `AsyncSection` on first load; refetch is only an opacity dim).
- [x] T5 PaginatedTable loading states: `isLoading` (skeleton rows, header+toolbar visible), `isFetching` (dimmed previous rows + thin indeterminate bar, `aria-busy`), `isError` + `onRetry` (StatePanel style), empty -> `emptyLabel`; reduced-motion respected. Adopt in users, control-donaciones, reclamos, ReportesCola, rondas, actividad, auditoria, referentes (replace table-wrapping `AsyncSection`). Route: delegated direct (inline here: single writer).
- [x] T6 Catalogo server-side: MS `GET /api/articulos/admin` (paged; q, categoria, incluirInactivos; ADMINISTRADOR via @PreAuthorize), BFF `GET /articulos/admin` proxy, SPA `useArticulosAdmin` hook + debounced search (300ms, page reset), page size 10/25/50. Public `GET /articulos` unchanged (pickers).
- [x] T7 Drawer mutation feedback audit: buttons loading/disabled while pending, errors inline (reclamos, control-donaciones, users, ReportesCola if applicable).
- [x] T8 Final checks (admin test/lint/build, bff test/lint, ms targeted tests) recorded below.

## Acceptance
- Clicking anywhere on a row (or Enter/Space on it) opens the drawer; actions inside a row never double-trigger.
- Drawer: Esc / scrim / close button close it; focus moves into it and returns to the row.
- Every existing action is still reachable and its existing tests (adapted) pass.

## Progress / evidence
- T1: `npm test`: 107 files / 646 tests passed; `npm run lint`: clean; `npm run build`: built OK (only chunk-size warning). New `Drawer.tsx`, `PaginatedTable` onRowClick/selectedKey/page-size passthrough, sticky header, inner scroll, toolbar+count inside the card.
- T2: `npm test`: 107 files / 648 tests passed; `npm run lint`: clean; `npm run build`: built OK. Reclamos drawer (Reportes tab `ReportesCola` left on the old inline expand: not trivial, follow-up).
- T3: `npm test`: 107 files / 651 tests passed; `npm run lint`: clean; `npm run build`: built OK.
- T4: `npm test`: 107 files / 653 tests passed; `npm run lint`: clean; `npm run build`: built OK.
- Default page size is now 10 (selector 10/25/50) on reclamos, control-donaciones, users. Pre-commit: `npm test` 107 files / 653 tests passed; `npm run lint` clean; `npm run build` OK.
- Commits: T1 c386600, T2 ef5b646, T3 67d2f58, T4 ca97a52.

- Phase B evidence (uncommitted):
  - T5: PaginatedTable `isLoading`/`isError`/`onRetry`/`isFetching` (skeleton rows, retry panel, progress bar + aria-busy, reduced-motion CSS); adopted in users, control-donaciones, reclamos, ReportesCola, rondas, actividad, auditoria, catalogo. Page size default 10 also set on rondas/actividad/auditoria/ReportesCola. Referentes uses its own list + Pager (not PaginatedTable), already server-side; left as is.
  - T6: MS `GET /api/articulos/admin` (q, categoria, incluirInactivos, page/size/sort; `@PreAuthorize` ADMINISTRADOR; SecurityConfig untouched), BFF `GET /articulos/admin`, SPA `useArticulosAdmin`; catalogo no longer filters locally. No schema change.
  - T7: users drawer now stays open while pending (spinner/disabled), closes on success, shows error inline; Button `loading` sets aria-busy. Reclamos/control-donaciones/ReportesCola drawers already had pending + inline error.
  - T8 checks: admin `npm test`: 107 files / 668 tests passed; `npm run lint`: clean; `npm run build`: built OK. bff `npx jest`: 52 suites / 438 tests passed (role-matrix pinned with `GET /articulos/admin`); bff `npx eslint src/articulos`: only the repo's pre-existing `no-unsafe-*` pattern errors (full-repo baseline 361 problems). ms `mvn -q test` (full): EXIT 0; new tests ArticuloServiceTest 11, ArticuloRepositoryTest 5, ArticuloControllerSecurityTest 15 passed.

## Next step
User reviews the diff and approves commits; then follow-ups (ReportesCola to drawer, other tables).
