# Feature: page-header-standard

## Objective
Every AppShell nav tab in `ts_hornero_admin` uses the same page header as `/referentes`:
left-aligned `h1` title + `body-sm` `ink-3` description below it.

## Problem
Pages mix `h2` titles, centered `maxWidth + margin: 0 auto` wrappers and no description
(e.g. `/needs` "Mis necesidades" is small and centered). Only referentes, control-donaciones and
auditoria look right.

## Scope (nav tabs only, all roles)
- ADMINISTRADOR: panel, admin, users, referentes, control-donaciones, auditoria, reclamos, rondas, catalogo, actividad
- REFERENTE: dashboard, needs, mis-organizaciones, acreditacion, prefs
- DONANTE: explorar, nueva-donacion (/donar), mis-donaciones
- Out of scope: detail/flow pages (entrega, donacion-detalle, necesidad-detalle, legajo, reportar, reclamar), auth screens.

## Constraints
- Reuse: new `src/components/ui/PageHeader.tsx` (title, description, optional actions slot on the right).
- UI copy in neutral Spanish (project convention).
- No commits without user permission (user memory rule overrides ODD work-unit commits).
- TDD: off (no project config); ordinary checks: `npm test`, `npm run build`, `npm run lint` in ts_hornero_admin.

## Tasks
- [x] T1 PageHeader component + test — route: delegated (writer trigger: 2+ non-trivial files)
- [x] T2 Apply to all scoped pages, remove centered wrappers on those pages — route: delegated (same writer)
- [x] T3 Checks: vitest, build, lint

## Acceptance
- All scoped pages render `PageHeader` with a non-empty description; titles left-aligned at h1.
- Tests, build, lint pass.

## Progress
- 2026-11-02: document created.
- 2026-11-02: T1-T3 done (delegated writer). Observed: `npm test` 105 files / 634 tests passed; `npm run build` ok (tsc -b + vite); `npm run lint` 0 errors, 3 warnings (generated coverage/*.js, pre-existing), no files rewritten; `npx eslint <changed files>` clean. No existing test needed changes.
- New: `src/components/ui/PageHeader.tsx` (+ `PageHeader.test.tsx`).
- Changed routes (centered wrappers removed where present; `marginTop` on the first block after the header dropped since the header adds marginBottom 20):
  - panel: "Validá las organizaciones que solicitaron acceso a la plataforma."
  - admin: "Una vista general de la actividad y el estado de la plataforma."
  - users: "Consultá y gestioná las cuentas de todos los usuarios de la plataforma."
  - referentes: unchanged text (now via PageHeader)
  - control-donaciones: "Seguí y controlá el estado de todas las donaciones de la plataforma."
  - auditoria / rondas / actividad: kept existing subtitle text
  - reclamos: "Revisá los reclamos de comedores sin reclamar y los reportes enviados por los usuarios."
  - catalogo: kept existing long subtitle
  - dashboard: "Seguí el estado de tus necesidades y donaciones en un solo lugar." (dynamic heading kept)
  - needs: "Publicá y gestioná las necesidades de tu organización." (3 places; "+ Nueva necesidad" in actions; create/edit forms keep maxWidth 600 without auto margin)
  - mis-organizaciones: "Administrá las organizaciones que representás y sumá nuevas." ("+ Agregar organización" in actions)
  - acreditacion: "Cargá la evidencia de tu organización para subir de nivel de acreditación." (NivelBadge in actions)
  - prefs: "Configurá tu cuenta y tus preferencias de uso." (StatePanel title changed to "Próximamente" to avoid duplicate title)
  - explorar: "Encontrá necesidades abiertas de organizaciones y elegí a cuál querés ayudar."
  - nueva-donacion: "Elegí si querés donar directo a una necesidad o aportar al fondo común." (breadcrumb kept above; maxWidth 880 kept)
  - mis-donaciones: "Revisá el estado y el historial de las donaciones que realizaste."
