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
- Commits: T1 0727acc.

## Next step
User reviews the diff and approves commits; then follow-ups (ReportesCola to drawer, other tables).
