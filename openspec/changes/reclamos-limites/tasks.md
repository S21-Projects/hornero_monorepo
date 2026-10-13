# Tasks: Persistent anti-spam limits for reclamos and reportes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250-330 (about 110 production, 140-190 tests, 20 deletions of ReporteThrottle and its test, plus docs) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR, 3 work-unit commits |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not needed) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Claim pending cap + rolling window in MS (R1, R2, R4, R5) | PR 1 | `mvn test -Dtest=ReclamoServiceTest,ReclamoServiceGuardsTest` (from `jar_hornero_ms`) | N/A: no new endpoint; behavior covered by service slice tests with seeded rows | `LimitesReclamo`, `ReclamoService`, `ReclamoOrganizacionRepository`, `application.yml` `app.reclamo`, and their tests |
| 2 | Persistent report window, delete `ReporteThrottle` (R3, R4, R5) | PR 1 | `mvn test -Dtest=ReporteServiceTest,ReporteServiceGuardsTest` | N/A: same reason; S6 proves no in-memory state is needed | `LimitesReporte`, `ReporteService`, `ReporteOrganizacionRepository`, `application.yml` `app.reporte`, restore deleted throttle + test |
| 3 | Admin error messages for the two new claim codes (R6) | PR 1 | `npm test -- mapReclamoError` then `npm run build` (from `ts_hornero_admin`) | N/A: pure mapper function | `mapReclamoError.ts` and its test |
| 4 | Record P3 evidence in the ODD feature document | PR 1 | N/A: documentation | N/A | `odd/tasks/seguridad-calidad.md` |

Tests are capped at the design's 5 (user request: no excessive tests). Do not add more.

## Phase 1: Claim limits in the MS (Unit 1)

- [x] 1.1 RED: in `jar_hornero_ms/src/test/java/org/example/reclamo/ReclamoServiceTest.java`, add `@Import` of `LimitesReclamo` and write test 1 (S1+S2): seed 5 `PENDIENTE` claims on 5 different `SIN_RECLAMAR` orgs for one referente; assert `crear` and `verificarReclamable` both throw 409 `LIMITE_RECLAMOS_PENDIENTES` and nothing new is persisted. Confirm it fails (class `LimitesReclamo` missing / no check).
- [x] 1.2 RED: in the same test class, write test 2 (S3+S5): seed 5 `RECHAZADO` claims with `creadoEn = now - 1h`; assert `crear` throws 429 `DEMASIADOS_RECLAMOS` and `verificarReclamable` passes. Write test 3 (S4): seed 5 claims with `creadoEn = now - 25h`; assert `crear` succeeds. Use `em.persist` plus `setCreadoEn(...)` and the real `Clock` bean (no clock mocking).
- [x] 1.3 GREEN: create `jar_hornero_ms/src/main/java/org/example/reclamo/LimitesReclamo.java` as a `@Component record LimitesReclamo(pendientesMax, diarioMax, windowHours)` with `@Value("${app.reclamo.pendientes-max:5}")`, `diario-max:5`, `window-hours:24`, `POR_DEFECTO = new LimitesReclamo(5, 5, 24)` and `ventana()`.
- [x] 1.4 GREEN: in `jar_hornero_ms/src/main/java/org/example/domain/ReclamoOrganizacionRepository.java`, add `long countByReferente_IdAndEstado(Long, EstadoReclamo)` and `long countByReferente_IdAndCreadoEnGreaterThanEqual(Long, Instant)`.
- [x] 1.5 GREEN: in `jar_hornero_ms/src/main/java/org/example/reclamo/ReclamoService.java`, add `Clock` and `LimitesReclamo` fields and constants `LIMITE_RECLAMOS_PENDIENTES` / `DEMASIADOS_RECLAMOS`. In `exigirReclamable`, add the pending cap check as the last check (after org-state, duplicate-pending and `CAP_ORGANIZACIONES`) -> 409. In `crear`, after `validarEvidencias` and before `saveAndFlush`, add the window check (`clock.instant().minus(limites.ventana())`, `>= diarioMax`) -> 429. Add a one-line comment on each check documenting the accepted burst overshoot (R5). The window check must NOT be in the preflight.
- [x] 1.6 GREEN: in `jar_hornero_ms/src/main/resources/application.yml`, add `app.reclamo` (`pendientes-max: 5`, `diario-max: 5`, `window-hours: 24`) as literal values next to `otp`/`entrega`.
- [x] 1.7 Fix existing tests: in `jar_hornero_ms/src/test/java/org/example/reclamo/ReclamoServiceGuardsTest.java`, pass `Clock.systemUTC()` and `LimitesReclamo.POR_DEFECTO` to the manual constructor (mock counts return 0). No new tests.
- [x] 1.8 Verify: `mvn test -Dtest=ReclamoServiceTest,ReclamoServiceGuardsTest` is green. Commit step deferred to the orchestrator: `feat(reclamos): cap pending claims and rate-limit creation by persisted rows`.

## Phase 2: Persistent report window (Unit 2)

- [x] 2.1 RED: in `jar_hornero_ms/src/test/java/org/example/reporte/ReporteServiceTest.java`, replace `crear_countsAgainstTheDailyThrottle...` and `crear_whenTheDailyThrottleTrips...` with test 4 (S6): seed 20 non-pending (resolved) reports for one reportante within the window, with no in-memory state; assert `crear` throws 429 `DEMASIADOS_REPORTES` and the row count is unchanged. Drop `ReporteThrottle` from `@MockBean` and its field; `@Import` adds `LimitesReclamo` and `LimitesReporte`. Confirm RED.
- [x] 2.2 GREEN: create `jar_hornero_ms/src/main/java/org/example/reporte/LimitesReporte.java` (`@Component record(diarioMax, windowHours)`, `app.reporte.diario-max:20`, `window-hours:24`, `POR_DEFECTO`, `ventana()`).
- [x] 2.3 GREEN: in `jar_hornero_ms/src/main/java/org/example/domain/ReporteOrganizacionRepository.java`, add `long countByReportante_IdAndCreadoEnGreaterThanEqual(Long, Instant)`.
- [x] 2.4 GREEN: in `jar_hornero_ms/src/main/java/org/example/reporte/ReporteService.java`, replace the `ReporteThrottle` field with `Clock` and `LimitesReporte`; move constant `DEMASIADOS_REPORTES` into the service; replace `reporteThrottle.checkAndRecord(userId)` at the same position (after `resolverDuplicada`) with the window count check -> 429. Add the burst-overshoot comment (R5).
- [x] 2.5 GREEN: in `jar_hornero_ms/src/main/resources/application.yml`, add `app.reporte` (`diario-max: 20`, `window-hours: 24`) as literal values.
- [x] 2.6 Cleanup: delete `jar_hornero_ms/src/main/java/org/example/reporte/ReporteThrottle.java` and `jar_hornero_ms/src/test/java/org/example/reporte/ReporteThrottleTest.java`. Update `jar_hornero_ms/src/test/java/org/example/reporte/ReporteServiceGuardsTest.java`: drop the `ReporteThrottle` mock, pass `Clock.systemUTC()` and `LimitesReporte.POR_DEFECTO`. Grep for leftover `ReporteThrottle` references.
- [x] 2.7 Verify: `mvn test -Dtest=ReporteServiceTest,ReporteServiceGuardsTest` green (existing `crear_whenTheUserHasTenPendingReports...` still passes), then full `mvn test` green. Commit step deferred to the orchestrator: `refactor(reportes): derive the daily report limit from persisted rows`.

## Phase 3: Admin messages (Unit 3)

- [x] 3.1 RED: in `ts_hornero_admin/src/lib/hooks/mapReclamoError.test.ts`, add test 5 (S7): 409 `LIMITE_RECLAMOS_PENDIENTES` returns the dedicated message (not the generic "un reclamo pendiente" one) and 429 `DEMASIADOS_RECLAMOS` returns its dedicated message. Confirm RED.
- [x] 3.2 GREEN: in `ts_hornero_admin/src/lib/hooks/mapReclamoError.ts`, inside the 409 branch add `message === 'LIMITE_RECLAMOS_PENDIENTES'` right after `CONFLICTO_CONCURRENTE` and before `/pendiente/i` -> `Ya tenés muchos reclamos en revisión. Esperá a que un administrador resuelva alguno.`; add `if (status === 429)` before the 403 branch -> `Enviaste demasiados reclamos hoy. Intentá de nuevo mañana.`, mirroring `mapReporteError`.
- [x] 3.3 Verify: `npm test` and `npm run build` (tsc -b) both pass in `ts_hornero_admin`. Commit step deferred to the orchestrator: `feat(admin): show dedicated messages for the claim limit errors`.

## Phase 4: Documentation (Unit 4)

- [x] 4.1 Update `odd/tasks/seguridad-calidad.md` line 374 (P3): check it off and add evidence (the three work-unit commit hashes, `mvn test` / `npm test` / `npm run build` results, defaults 5/5/24 for claims and 20/24 for reports, accepted burst overshoot and orphaned-evidence-on-429 note). Commit step deferred to the orchestrator: `docs(odd): record P3 claim limits evidence` (commit hashes not recorded in the ODD note).
