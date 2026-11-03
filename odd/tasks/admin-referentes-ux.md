# admin-referentes-ux

Locator: `odd/tasks/admin-referentes-ux.md` · Engram topic `odd/admin-referentes-ux/tasks`
Branch: `fix/admin-referentes-ux` (from `develop`)

## Objective
Fix three admin SPA UX issues reported by the user (separately from the referentes tab redesign proposal, which is delivered as an artifact).

## Scope (authorized)
- T1 Pagination: page size 10 by default with a 10/25/50 selector; the list scrolls inside its own container, not the whole page (referentes page lists).
- T2 Selects: "Tipo de organizacion" native select (register.tsx) renders badly; align it with the app's input/dropdown look.
- T3 Register flow: real stepper (numbered steps, connectors, done state) for "Tu cuenta / Organizacion / Acreditacion"; image dropzones must not clip content.

Out of scope: uncommitted user changes in router/dashboard/login/needs/pending-validation (must not be staged).

## Constraints
- UI copy stays in Spanish (existing convention); code/comments in English.
- Inline-style + CSS-variable tokens approach (global.css), as in existing ui atoms.
- TDD: not configured (no project/session setting) -> ordinary functional checks.
- Checks: `npm test`, `npm run lint`, `npm run build` in ts_hornero_admin.

## Tasks
- [x] T1 Pager page-size selector (10/25/50) + scrollable list container in referentes.tsx — route: delegated (writer, 2+ files)
- [x] T2 Select styling fix for "Tipo de organizacion" — route: delegated (same writer)
- [ ] T3 Stepper component + ImageDropZone minHeight fix — route: delegated (same writer)

## Acceptance
- Default page size 10; selector changes size and resets to page 0.
- Long lists scroll inside a bounded container; page header/search stay visible; dropdown panels inside rows are not clipped.
- Select matches Input height/border/radius with a custom chevron.
- Stepper shows number/check, connector, current/done/pending states, aria-current preserved.
- Dropzones show icon + both captions fully at half-width columns.

## Progress / evidence
- T1 done: Dropdown panel now portaled to body (fixed coords, flips up near viewport bottom, recomputed on scroll/resize); Pager size selector (Dropdown-based, 10/25/50); referentes lists in bounded scroll containers, default size 10. Checks: npm test 628 passed; npm run lint 0 errors (3 warnings in coverage/); npm run build ok. Commit: T1_HASH
- T2 done: ui/Select.tsx atom (appearance none + ArrowDown2 chevron), used for Tipo de organizacion in register.tsx. Checks: npm test 630 passed; lint 0 errors; build ok. Commit: T2_HASH
(pending T3)

## Next step
Run writer for T1-T3.
