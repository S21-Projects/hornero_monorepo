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
- [x] T6 Astro map panel: layer chips, horizontal legend, department card top-right, sources in a
      "Sobre los datos" disclosure, using `components/ui` atoms. Route: delegated writer.

- [x] T7 Ronda assignments endpoint (user chose option 2, 2026-11-11): MS `GET /api/rondas/{id}/asignaciones`
      (ADMINISTRADOR) returning each assignment of the ronda (donación, organización/necesidad, estado,
      score + terms + weights), BFF proxy `GET /rondas/:id/asignaciones`, tests in both. Route: delegated writer.
- [x] T8 Rondas admin UI: run confirmation in `ConfirmDialog` with pool size, last result as stat cards,
      history with origen/considerados/error, clickable rows opening a `Drawer` with summary, applied
      weights and the ronda's assignment list (from T7). Route: delegated writer.

Review round 2 (user, 2026-11-12):

- [x] T9 Map: replace the ~530-option native department `<select>` (renders as a huge mostly-empty
      menu on macOS) with a searchable combobox; Córdoba first. Route: delegated writer.
- [x] T10 Necesidad delete returned 409 from a raw FK violation (`asignaciones.necesidad_id`, also
      `donaciones`): MS answers a clear 409 `NECESIDAD_CON_DONACIONES` before deleting, admin shows a
      helpful message instead of "Ocurrió un error". Route: delegated writer.
- [x] T11 Donation detail "nueva" banner told DIRECTA donors it enters the next ronda; copy per
      modalidad, banner styling via classes. Route: delegated writer.
- [x] T12 Pi deploy guide with ReNaCoM/map data loaded. Route: mapper + parent.

Ronda finding (no code change): pooled donation #1 (8 kg Carne, CONGELADO) was rejected by Los
Naranjos, the only N3 org; the worker excludes orgs that rejected a donation (`OrganizacionesExcluidas`)
and N1/N2 orgs cannot take CONGELADO, so every ronda leaves it unassigned by design.

## Progress

- 2026-11-11: doc created; Nosotros flag committed separately (bdc74ca).
- T1 done (delegated writer). Admin `npm test` 721 passed, `npm run lint` 0 errors (3 warnings in
  generated coverage/), `npm run build` ok; parent re-ran ConfirmDialog + mis-donaciones tests (13 passed).
  donacion-detalle has no cancel action, skipped. Commit: see git log "feat(admin): confirm destructive actions in a modal dialog".
- T2 done (delegated writer): needs list cards, form cards, ArticuloPicker chips. Admin npm test 723 passed, lint 0 errors, build ok; parent re-ran needs + necesidad tests. Not checked in a browser yet.
- T3+T4 done (one delegated writer, shared status sentences/progress/cancel flow): admin npm test 744 passed, lint 0 errors, build ok; parent re-ran tsc -b + donor tests (60 passed). Stats/tab counts cover the loaded page only (server-side pagination), with a caption when there is more than one page. DesgloseScore only used by donacion-detalle, so no admin variant. ~1230 changed lines, over the 400 heuristic: list, detail and shared helpers are one behaviour.
- T5 done (delegated writer): /donar/directa wizard (Stepper fullWidth), necesidad-detalle inline form replaced by a CTA so creation has one path; 7-day note verified against DonacionesEstancadasJob (constant mirrors the default). Search/priority filters are client-side on the loaded page (useNecesidades only has page/size). admin npm test 747 passed, lint 0 errors, build ok; parent re-ran wizard/nueva/necesidad-detalle tests.
- T6 done (delegated writer): map panel chips, horizontal legend (tick labels derived from BREAKS lower bounds), top-right department card, sources in a details. astro build ok (parent re-ran), astro check 0 errors. Not checked in a browser.
- Next: visual check of all screens in the browser (make up-local), then the user decides push/PR. Branch carries ~2.5k changed lines; PR split pending user choice.
- T7 done (delegated writer): MS GET /api/rondas/{id}/asignaciones (admin, list ordered by score desc, 404 unknown) wrapping AsignacionResponse in AsignacionRondaResponse; BFF proxy; admin type + useAsignacionesRonda. MS full mvn test 1285 passed (8 skipped); BFF npm test -- rondas 18 passed; admin useRondas 7 passed, admin build ok. BFF build fails locally only because node_modules lacks sharp (declared in package.json, environmental, untouched code); BFF lint has 460 pre-existing problems, the new methods follow the same pattern. Query tested on H2, not Postgres.
- T8 done (delegated writer + parent): rondas page with Fondo común card, ConfirmDialog run, stat cards, clickable history (PaginatedTable onRowClick) opening RondaDrawer (Asignaciones with DesgloseScore toggle, Resumen with applied weights). Parent extracted the duplicated StatCard into components/ui/StatCard.tsx (mis-donaciones + rondas). Admin npm test 754 passed, lint 0 errors on touched files, build ok. No admin donation detail route, so no "Ver donación" link.
- Next: browser check of every screen on make up-local (also validates the T7 query on Postgres); then the user decides push/PR (branch ~3.5k changed lines, PR split pending).
- 2026-11-11 demo stack rebuilt (make demo-up) on the branch: API checks ok — /rondas/{id}/asignaciones returns data on Postgres (ronda 4: "Arroz x20 -> Copa de Leche El Molino", PROPUESTA, 0.53), unknown ronda 404; astro /mapa 200, /nosotros 404 (flag off), admin /, /donar/directa, /rondas 200. Visual review: user (no Playwright by user preference).
- 2026-11-12 review round 2 (T9-T12): DepartamentoCombobox (ARIA combobox, Córdoba first) replaces
  the native select; MS rejects deleting a necesidad referenced by asignaciones/donaciones with 409
  NECESIDAD_CON_DONACIONES and the admin explains it; donation banner copy per modalidad; Pi map
  guide in docs/deploy-mapa-rpi.md. Commits bda6a8a, fc5a565, f353efb, d42f9e2. Checks: MS
  `mvn test -Dtest='Necesidad*'` passed; admin npm test 758 passed, lint 0 errors, build ok; astro
  build ok (parent re-ran), astro check 0 errors. Not checked in a browser (user reviews).
