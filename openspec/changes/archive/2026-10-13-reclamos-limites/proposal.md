# Proposal: Persistent anti-spam limits for reclamos and reportes

## Intent

Claims (`reclamos_organizacion`) have no pending cap and no rate limit, so a single referente can
flood the admin review queue. Reports (`reportes_organizacion`) do have a 24 h throttle, but it is
an in-memory sliding window (`ReporteThrottle`) that resets on every MS restart, and the Pi
restarts on every deploy. Both limits must survive restarts and be configurable.

Success: a user cannot exceed a configured number of pending claims or claims per window, report
limits keep their current values and codes but become restart-proof, and the admin SPA shows a
clear message for each new error code.

## Scope

### In Scope
- Claim pending cap per user (default 5): 409 `LIMITE_RECLAMOS_PENDIENTES`, enforced in
  `ReclamoService.exigirReclamable`, so both `crear` and the evidence-upload preflight
  `verificarReclamable` apply it.
- Claim rate window (default 5 per 24 h): 429 `DEMASIADOS_RECLAMOS`, the last check in
  `ReclamoService.crear` only (not in the preflight). Withdrawn and rejected claims count.
- Report rate window rebased on row counts (`creadoEn >= now - window` by reportante); values
  (10 pending, 20 / 24 h) and codes (`LIMITE_REPORTES_PENDIENTES`, `DEMASIADOS_REPORTES`) unchanged.
- Delete `ReporteThrottle` and its test; update `ReporteServiceTest` accordingly.
- Config keys `app.reclamo.pendientes-max`, `app.reclamo.diario-max`, `app.reclamo.window-hours`;
  keep `app.reporte.*` (now read by the row-count check).
- Admin `mapReclamoError.ts`: map the two new codes before the `/pendiente/` regex fallthrough.
- Minimal strict-TDD tests (about 5–6 total, one per behavior).

### Out of Scope
- A generic persistent throttle table or purge job (Approach 2).
- Counting rejected or failed attempts that never persist a row.
- Strict concurrency guarantees (locks, serializable transactions) against burst overshoot.
- Per-IP limits, CAPTCHA, BFF-level rate limiting, Astro changes.
- SQL scripts: the creator-id indexes already exist.

## Capabilities

### New Capabilities
- `reclamo-reporte-limites`: per-user pending caps and rolling-window rate limits for reclamos and
  reportes, derived from persisted rows, with their error codes, HTTP statuses, configuration keys
  and admin SPA messages.

### Modified Capabilities
- None (no existing spec covers reclamos or reportes).

## Approach

Approach 1 from exploration: derive every limit from the domain tables, which are never deleted
(`anonimizar()` keeps rows and `creadoEn`).

- Pending cap = count of the user's rows with `estado = PENDIENTE`.
- Window cap = count of the user's rows with `creadoEn >= now - window`, using the injected
  `Clock` already present for `ReporteThrottle`.
- Check order in `ReclamoService.crear`: existing reclamable checks (now including the pending
  cap) first, the window check last, mirroring `ReporteService.crear`.
- Repository derived-query count methods; no new tables, jobs or migrations.
- The three JWT enforcement layers are untouched: no route, role or guard changes. The BFF passes
  the MS status and code through as today.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `jar_hornero_ms/.../ReclamoService.java` | Modified | Pending cap in `exigirReclamable`, window check in `crear` |
| `jar_hornero_ms/src/main/java/org/example/domain/ReclamoOrganizacionRepository.java` | Modified | Count by referente + estado, count by referente + `creadoEn` after |
| `jar_hornero_ms/.../ReporteService.java` | Modified | Replace `ReporteThrottle` call with row-count window check |
| `jar_hornero_ms/src/main/java/org/example/domain/ReporteOrganizacionRepository.java` | Modified | Count by reportante + `creadoEn` after |
| `jar_hornero_ms/.../ReporteThrottle.java` (+ `ReporteThrottleTest`) | Removed | In-memory window no longer needed |
| `jar_hornero_ms/src/main/resources/application*.properties` | Modified | Add `app.reclamo.*` defaults |
| `jar_hornero_ms/src/test/.../ReclamoServiceTest`, `ReporteServiceTest` | Modified | Minimal limit tests; drop the throttle mock |
| `ts_hornero_admin/src/lib/hooks/mapReclamoError.ts` (+ `.test.ts`) | Modified | Messages for `LIMITE_RECLAMOS_PENDIENTES` (409) and `DEMASIADOS_RECLAMOS` (429) |

Services touched: `jar_hornero_ms`, `ts_hornero_admin`. BFF, Astro and the worker are not changed.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Concurrent bursts overshoot a cap by a few rows (check-then-insert) | Low | Single Pi MS instance; accepted and documented in the spec |
| New 409 message swallowed by the `/pendiente/` regex in `mapReclamoError.ts` | Med | Match by code first; a mapper test asserts the ordering |
| `ReporteServiceTest` breaks when the `ReporteThrottle` mock is removed | Med | Update both test classes in the same task |
| Existing users already above the new claim caps get blocked immediately | Low | Intended; caps are configurable via properties |

## Rollback Plan

Revert the change commits: this restores `ReporteThrottle` and removes the claim checks and the
mapper branches. No schema, data or migration is involved, so rollback is code-only. As a softer
lever without reverting code, raise `app.reclamo.*` / `app.reporte.*` values and restart the MS.

## Dependencies

- None. Existing indexes on `reclamos_organizacion.referente_id` and
  `reportes_organizacion.reportante_id` support the counts.

## Success Criteria

- [ ] A referente with 5 pending claims gets 409 `LIMITE_RECLAMOS_PENDIENTES` on `crear` and on the evidence-upload preflight.
- [ ] A referente with 5 claims created in the last 24 h gets 429 `DEMASIADOS_RECLAMOS`; claims older than the window do not count.
- [ ] The report window is enforced from persisted rows and still applies after an MS restart.
- [ ] `ReporteThrottle` no longer exists; report codes and default values are unchanged.
- [ ] The admin SPA shows a specific message for each new code.
- [ ] `mvn test` and the admin `npm test` + `npm run build` pass, with about 5–6 new or updated tests.
