# Exploration: reclamos-limites (P3 anti-spam for claims and reports)

Mirror of Engram `sdd/reclamos-limites/explore` (obs #741).

## Current state

- **Reports** already have a pending cap and a throttle. `ReporteService.crear` enforces
  `MAX_PENDIENTES_POR_USUARIO=10` (409 `LIMITE_REPORTES_PENDIENTES`, via
  `countByReportante_IdAndEstado`) and calls `ReporteThrottle.checkAndRecord(userId)` as the last
  check (429 `DEMASIADOS_REPORTES`). `ReporteThrottle` is an in-memory sliding window
  (`app.reporte.diario-max=20`, `app.reporte.window-hours=24`, hourly sweep, injected `Clock`).
  Tests: `ReporteThrottleTest` (3 unit tests); `ReporteServiceTest` mocks it (`@MockBean`, line 56,
  used around lines 400–412).
- **Claims** have neither. `ReclamoService.exigirReclamable` checks the org is `SIN_RECLAMAR`, no
  duplicate pending claim for (org, referente) (+ `ux_reclamo_pendiente`, V008), and the cap of 3
  organizations per referente. `verificarReclamable` (BFF evidence-upload preflight) shares
  `exigirReclamable`.
- Rows are never deleted: `anonimizar()` keeps rows, FKs and `creadoEn`. Counting rows by creator
  and `creadoEn` is reliable.
- Indexes on `reclamos_organizacion.referente_id` and `reportes_organizacion.reportante_id` exist.
  No SQL script needed.
- Admin: `mapReporteError.ts` maps both report codes. `mapReclamoError.ts` has no 429 branch and a
  `/pendiente/` regex fallthrough that would swallow a new cap message; new codes must be matched
  before it.

## Approaches

1. **Count rows in the domain tables (recommended).** Window cap = rows with `creado_en >= now -
   window` by creator; pending cap = rows with `estado=PENDIENTE`. Delete `ReporteThrottle`.
   Persistent by construction, no table/job. Cons: concurrent bursts may overshoot slightly;
   only persisted submissions count. Effort: low–medium.
2. **Generic persistent throttle table** plus purge job. Reusable, counts attempts. Cons: new
   table, job and write per request; duplicates domain data. Effort: medium–high.
3. **Keep in-memory throttle, add claim pending cap only.** Smallest diff, but resets on every
   restart: fails the persistence requirement. Effort: low.

## Recommendation

Approach 1. New codes `LIMITE_RECLAMOS_PENDIENTES` (409, in `exigirReclamable`) and
`DEMASIADOS_RECLAMOS` (429, last check in `crear`); reports keep `DEMASIADOS_REPORTES` backed by
row counts. Config: `app.reclamo.pendientes-max`, `app.reclamo.diario-max`,
`app.reclamo.window-hours`; keep `app.reporte.*`. Admin `mapReclamoError` maps the new codes
before the regex.

Minimal tests (~5–6, RED → GREEN): claim pending cap 409; claim window 429 + old rows allowed;
report window 429 from persisted rows; preflight applies the pending cap; two mapper assertions.

## Open questions (configurable defaults proposed)

1. Pending-claims cap per user: 5.
2. Claim rate window: 5 per 24 h (reports stay 20 / 24 h).
3. Withdrawn/rejected claims count toward the window (row count).
4. Evidence-upload preflight enforces the pending cap, not the rate window.

## Risks

- Concurrent submissions may overshoot by a few (single Pi instance; low).
- Mapper regex ordering in `mapReclamoError.ts`.
- `ReporteServiceTest` / `ReporteThrottleTest` must be updated together.
