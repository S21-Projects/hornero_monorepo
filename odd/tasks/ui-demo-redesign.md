# Feature: ui-demo-redesign

Engram mirror: `odd/ui-demo-redesign/tasks` (project hornero_monorepo).
Branch: `fix/updates-for-demo` (from `develop`).
Design reference: canvas https://claude.ai/artifact/J5rLQJLVrk6xPcvQ2BG4nC

## Objective

Polish the screens shown during the thesis evaluation: public vulnerability map, donor
"Mis donaciones" + donation detail, a real direct-donation flow, and the referente needs
screens. Destructive actions (delete, cancel) confirm in a modal.

## Constraints

- Styling: reusable CSS classes (admin `src/styles/global.css` component classes or registered
  Tailwind utilities) instead of inline `style={{}}` for common styling. Reuse existing atoms
  (`Card`, `Button`, `Badge`, `Drawer`, `Stepper`, `PageHeader`, `Text`, `EmptyState`, …).
- No backend changes. Direct donation payload stays `{ necesidadId, lineas[{articuloId, cantidad}], observaciones? }`.
  Canvas ideas without domain support are dropped: delivery date, "que la retiren" option.
- A necesidad may mix categories (derived category = most demanding, `lib/categoria.ts`); the
  canvas note "one category only" was wrong and is not implemented.
- Copy in Spanish (existing convention); code identifiers follow the existing mix.
- ~400 changed lines per task is a planning heuristic only.

## Checks

- TDD: off (no project/session configuration found); ordinary functional checks.
- Admin: `npm test`, `npm run lint`, `npm run build` (tsc -b catches what vitest misses).
- Astro: `npm run build`.
- RDD: off (decided by default) — no review lifecycle.

## Tasks

- [x] T1 `ConfirmDialog` atom (modal alertdialog, focus on safe action, Escape closes) + replace inline
      confirms: needs delete (`routes/needs.tsx`), donation cancel in `mis-donaciones.tsx` (today has
      no confirm) and donation detail, `panel.tsx`, `catalogo.tsx`. Route: delegated writer.
- [x] T2 Referente needs: list items as `Card` with background, icon delete button; edit/create forms
      inside a `Card`; `ArticuloPicker` as chip toggles per category. Route: delegated writer.
- [x] T3 Mis donaciones: summary counts, Activas/Historial tabs, per-row status line + single primary
      action, cancel in an overflow menu → ConfirmDialog. Route: delegated writer.
- [x] T4 Donation detail: next-step card, two-column layout, plain-language `DesgloseScore` (raw
      "Fuente del déficit: NEUTRAL" replaced by a sentence; numbers behind a disclosure), history
      as timeline. Route: delegated writer.
- [x] T5 Direct donation wizard: `/donar` DIRECTA no longer redirects to `/explorar`; 3 steps
      (necesidad, artículos + cantidades via `LineaArticuloEditor`, nota + confirm) with a summary
      aside, reusing `Stepper` and `useCrearDonacion`; lands on the detail with `?nueva=1`.
      Route: delegated writer.
- [ ] T6 Astro map panel: layer chips, horizontal legend, department card top-right, sources in a
      "Sobre los datos" disclosure, using `components/ui` atoms. Route: delegated writer.

## Progress

- 2026-11-11: doc created; Nosotros flag committed separately (bdc74ca).
- T1 done (delegated writer). Admin `npm test` 721 passed, `npm run lint` 0 errors (3 warnings in
  generated coverage/), `npm run build` ok; parent re-ran ConfirmDialog + mis-donaciones tests (13 passed).
  donacion-detalle has no cancel action, skipped. Commit: see git log "feat(admin): confirm destructive actions in a modal dialog".
- T2 done (delegated writer): needs list cards, form cards, ArticuloPicker chips. Admin npm test 723 passed, lint 0 errors, build ok; parent re-ran needs + necesidad tests. Not checked in a browser yet.
- T3+T4 done (one delegated writer, shared status sentences/progress/cancel flow): admin npm test 744 passed, lint 0 errors, build ok; parent re-ran tsc -b + donor tests (60 passed). Stats/tab counts cover the loaded page only (server-side pagination), with a caption when there is more than one page. DesgloseScore only used by donacion-detalle, so no admin variant. ~1230 changed lines, over the 400 heuristic: list, detail and shared helpers are one behaviour.
- T5 done (delegated writer): /donar/directa wizard (Stepper fullWidth), necesidad-detalle inline form replaced by a CTA so creation has one path; 7-day note verified against DonacionesEstancadasJob (constant mirrors the default). Search/priority filters are client-side on the loaded page (useNecesidades only has page/size). admin npm test 747 passed, lint 0 errors, build ok; parent re-ran wizard/nueva/necesidad-detalle tests.
