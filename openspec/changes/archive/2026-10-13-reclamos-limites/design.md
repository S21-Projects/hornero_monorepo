# Design: Persistent anti-spam limits for reclamos and reportes

## Technical Approach

Every limit is derived from rows that already exist in `reclamos_organizacion` and
`reportes_organizacion`. Those rows are never deleted, because anonymization keeps them along with
`creadoEn`. Two Spring Data derived `count` queries per table provide the counts: one for the
pending cap and one for the rolling window. The services compare those counts with values from a
small config record bean (one record per package), following the `VentanasDonacion` pattern. The
window start is `clock.instant().minus(window)`, using the existing `Clock` bean from
`MainApplication`. `ReporteThrottle` is deleted. Its call site becomes a row-count check in the same
position. This covers spec R1 to R7. Nothing changes in the schema, the BFF or the security layers.

## Architecture Decisions

### Decision: Config binding through a `@Component` record per package

**Choice**: Add `org.example.reclamo.LimitesReclamo(pendientesMax, diarioMax, windowHours)` and `org.example.reporte.LimitesReporte(diarioMax, windowHours)`. Each one is a `@Component record` with `@Value("${app.…:default}")` components and a `POR_DEFECTO` constant, the same shape as `VentanasDonacion`.
**Alternatives considered**: (a) Put `@Value` on the service constructor parameters. This does not work with `@RequiredArgsConstructor` without a `lombok.config` copyable-annotation change, and it would force explicit 10-argument constructors. (b) Use `@ConfigurationProperties`. The codebase does not use it anywhere. (c) Use one shared `LimitesSpam` bean. That would couple two packages that each own their own rules.
**Rationale**: This matches an existing pattern, keeps `@RequiredArgsConstructor` on both services, and lets the manually constructed guard tests pass `POR_DEFECTO`. Today `app.reporte.*` is bound only through `@Value` defaults in `ReporteThrottle`, and the keys are absent from `application.yml`, `docker-compose.yml` and `.env.example`. Those keys move into `LimitesReporte` unchanged.

### Decision: Derived count queries, not `@Query`

**Choice**:
- `ReclamoOrganizacionRepository`: `long countByReferente_IdAndEstado(Long, EstadoReclamo)` and `long countByReferente_IdAndCreadoEnGreaterThanEqual(Long, Instant)`.
- `ReporteOrganizacionRepository`: `long countByReportante_IdAndCreadoEnGreaterThanEqual(Long, Instant)`. `countByReportante_IdAndEstado` already exists.
**Alternatives considered**: JPQL `@Query`. It is only needed for joins, like `existeEvidenciaDeReferente`.
**Rationale**: These are single-table predicates, and they follow the existing `countByReportante_IdAndEstado`. `GreaterThanEqual` matches the spec boundary `creadoEn >= now - window`. The existing indexes on `referente_id` and `reportante_id` cover them.

### Decision: Check placement and order

**Choice**:
- `ReclamoService.exigirReclamable` checks, in order: (1) org not `SIN_RECLAMAR` → 409; (2) duplicate pending claim on the same org → 409 `MSG_RECLAMO_PENDIENTE`; (3) org cap `contarACargo >= CAP_ORGANIZACIONES` → 409; (4) **new** pending cap `countByReferente_IdAndEstado(PENDIENTE) >= pendientesMax` → 409 `LIMITE_RECLAMOS_PENDIENTES`. Both `crear` and `verificarReclamable` therefore apply the new check.
- `ReclamoService.crear` adds a **new** final check after `validarEvidencias` and before `saveAndFlush`: if the window count is `>= diarioMax`, it answers 429 `DEMASIADOS_RECLAMOS`. This check is not in the preflight.
- `ReporteService.crear` replaces `reporteThrottle.checkAndRecord(userId)` at the same position, after `resolverDuplicada`, with the window count check against `LimitesReporte`. If the count is `>= diarioMax`, it answers 429 `DEMASIADOS_REPORTES`.
**Alternatives considered**: Put the pending cap before the org-specific checks. That would hide the more specific message, such as "already pending here". Put the window check in the preflight too. The spec rules this out (R2/S5).
**Rationale**: Specific errors come first and volume caps come last. Only well-formed submissions reach the window check, the same contract `ReporteThrottle` had.

### Decision: Error codes as `reason` constants

**Choice**: Add `static final String LIMITE_RECLAMOS_PENDIENTES` and `DEMASIADOS_RECLAMOS` to `ReclamoService`. Move `DEMASIADOS_REPORTES` from `ReporteThrottle` into `ReporteService`. Throw `ResponseStatusException(status, CODE)` with the code as the reason, the same way `LIMITE_REPORTES_PENDIENTES` works today. Place a one-line comment on each window and cap check that documents the accepted burst overshoot (R5).
**Rationale**: The BFF passes `message` through, and the admin mappers match on exact codes.

### Decision: Admin mapper ordering

**Choice**: In `mapReclamoError`, add `message === 'LIMITE_RECLAMOS_PENDIENTES'` inside the 409 branch, directly after `CONFLICTO_CONCURRENTE` and before `/pendiente/i`. Add `if (status === 429) return …` before the 403 branch, mirroring `mapReporteError`.
**Rationale**: `/pendiente/i` matches `LIMITE_RECLAMOS_PENDIENTES` because the match is case-insensitive, so the code has to be tested first. Before this change, 429 fell through to the generic error.

Messages (neutral Spanish, `contexto`-aware where relevant):
- 409: `Ya tenés muchos reclamos en revisión. Esperá a que un administrador resuelva alguno.`
- 429: `Enviaste demasiados reclamos hoy. Intentá de nuevo mañana.`

## Data Flow

    POST /reclamos (BFF passthrough) ──→ ReclamoService.crear
        verificacionService → usuario/referente → org
        exigirReclamable:  estado → dup pendiente → contarACargo → countPendientes   (409)
        validarEvidencias                                                           (400)
        countVentana(referente, clock.instant() - ventana) >= diarioMax             (429)
        saveAndFlush → actividad

    GET preflight ──→ verificarReclamable ──→ exigirReclamable (no window check)

    POST /reportes ──→ ReporteService.crear
        ... dup pendiente → countPendientes(10) → resolverDuplicada
        countVentana(reportante, clock.instant() - ventana) >= diarioMax            (429)
        saveAndFlush

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `jar_hornero_ms/src/main/java/org/example/reclamo/LimitesReclamo.java` | Create | `@Component record` binding `app.reclamo.*` (5 / 5 / 24), with `POR_DEFECTO` and `ventana()` |
| `jar_hornero_ms/src/main/java/org/example/reporte/LimitesReporte.java` | Create | `@Component record` binding `app.reporte.diario-max` (20) and `window-hours` (24) |
| `jar_hornero_ms/src/main/java/org/example/reclamo/ReclamoService.java` | Modify | New fields `Clock` and `LimitesReclamo`; pending cap in `exigirReclamable`; window check in `crear`; two code constants |
| `jar_hornero_ms/src/main/java/org/example/reporte/ReporteService.java` | Modify | Replace the `ReporteThrottle` field with `Clock` and `LimitesReporte`; row-count window check; `DEMASIADOS_REPORTES` constant |
| `jar_hornero_ms/src/main/java/org/example/domain/ReclamoOrganizacionRepository.java` | Modify | Two derived count methods |
| `jar_hornero_ms/src/main/java/org/example/domain/ReporteOrganizacionRepository.java` | Modify | One derived count method |
| `jar_hornero_ms/src/main/java/org/example/reporte/ReporteThrottle.java` | Delete | Replaced by the row count |
| `jar_hornero_ms/src/test/java/org/example/reporte/ReporteThrottleTest.java` | Delete | Its subject is gone |
| `jar_hornero_ms/src/main/resources/application.yml` | Modify | Add `app.reclamo` (`pendientes-max: 5`, `diario-max: 5`, `window-hours: 24`) and `app.reporte` (`diario-max: 20`, `window-hours: 24`) as literal values, like `otp`/`entrega` |
| `jar_hornero_ms/src/test/java/org/example/reclamo/ReclamoServiceTest.java` | Modify | `@Import` adds `LimitesReclamo`; new limit tests |
| `jar_hornero_ms/src/test/java/org/example/reporte/ReporteServiceTest.java` | Modify | Drop `ReporteThrottle` from `@MockBean` and the field; `@Import` adds `LimitesReclamo` and `LimitesReporte`; replace the two throttle tests with one row-based test |
| `jar_hornero_ms/src/test/java/org/example/reclamo/ReclamoServiceGuardsTest.java` | Modify | Constructor gets `Clock.systemUTC()` and `LimitesReclamo.POR_DEFECTO` (mock counts return 0) |
| `jar_hornero_ms/src/test/java/org/example/reporte/ReporteServiceGuardsTest.java` | Modify | Constructor drops the `ReporteThrottle` mock and gets `Clock.systemUTC()` and `LimitesReporte.POR_DEFECTO` |
| `ts_hornero_admin/src/lib/hooks/mapReclamoError.ts` | Modify | 409 code branch before `/pendiente/`; new 429 branch |
| `ts_hornero_admin/src/lib/hooks/mapReclamoError.test.ts` | Modify | Assertions for both codes |

Neither `docker-compose.yml` nor `.env.example` needs changes, because no `app.reporte.*` environment wiring exists today. Spring relaxed binding (`APP_RECLAMO_DIARIOMAX`, …) still allows an override without new variables.

## Interfaces / Contracts

```java
@Component
public record LimitesReclamo(
        @Value("${app.reclamo.pendientes-max:5}") int pendientesMax,
        @Value("${app.reclamo.diario-max:5}") int diarioMax,
        @Value("${app.reclamo.window-hours:24}") long windowHours) {
    public static final LimitesReclamo POR_DEFECTO = new LimitesReclamo(5, 5, 24);
    public Duration ventana() { return Duration.ofHours(windowHours); }
}
// LimitesReporte: same shape, (diarioMax 20, windowHours 24), app.reporte.*
```

HTTP contract (unchanged envelope, `message` = code):

| Code | Status | Where |
|------|--------|-------|
| `LIMITE_RECLAMOS_PENDIENTES` | 409 | `crear`, `verificarReclamable` |
| `DEMASIADOS_RECLAMOS` | 429 | `crear` only |
| `LIMITE_REPORTES_PENDIENTES` | 409 | unchanged |
| `DEMASIADOS_REPORTES` | 429 | unchanged code; now based on persisted rows |

## Testing Strategy

Strict TDD: each test is written RED before its production change. There are 5 tests in total. In the MS tests, rows are seeded with `em.persist` and a backdated `setCreadoEn(...)`. The real `Clock` bean (`MainApplication`, which slice tests load) is enough, so no clock mocking is needed.

| # | Layer | What to Test | Approach |
|---|-------|-------------|----------|
| 1 | MS `ReclamoServiceTest` | S1+S2: 5 PENDIENTE claims → `crear` and `verificarReclamable` both 409 `LIMITE_RECLAMOS_PENDIENTES`; nothing new persisted | Seed 5 pending rows on 5 different `SIN_RECLAMAR` orgs |
| 2 | MS `ReclamoServiceTest` | S3+S5: 5 RECHAZADO claims created within 24 h → `crear` 429 `DEMASIADOS_RECLAMOS`; `verificarReclamable` passes | Seed rejected rows with `creadoEn = now - 1h` |
| 3 | MS `ReclamoServiceTest` | S4: 5 claims with `creadoEn = now - 25h` → `crear` succeeds | Backdated rows |
| 4 | MS `ReporteServiceTest` | S6: 20 resolved reports within the window (no in-memory state exists) → 429 `DEMASIADOS_REPORTES`; count unchanged | Replaces `crear_countsAgainstTheDailyThrottle…` and `crear_whenTheDailyThrottleTrips…` |
| 5 | Admin vitest `mapReclamoError.test.ts` | S7: 409 `LIMITE_RECLAMOS_PENDIENTES` → dedicated message (not "un reclamo pendiente"); 429 `DEMASIADOS_RECLAMOS` → dedicated message | Pure function |

Regression: the existing `crear_whenTheUserHasTenPendingReports…` test still passes, because 10 reports stay under the window cap of 20. The full `mvn test`, admin `npm test` and `npm run build` must pass.

## Threat Matrix

N/A: there is no routing, shell, subprocess, VCS/PR automation, executable-file classification or process-integration boundary.

## Migration / Rollout

No migration is required. The code only reads existing columns. Rollback is a code revert. A softer lever is raising `app.reclamo.*` / `app.reporte.*` and restarting the MS.

## Open Questions

- [ ] The spec R2 mentions "withdrawn" claims, but `EstadoReclamo` only has `PENDIENTE/APROBADO/RECHAZADO`. "All states count" covers this anyway, so it is not blocking.
- [ ] The window check runs after the evidence upload (spec S5). A referente who hits 429 leaves uploaded evidence objects orphaned in the bucket. This is accepted under the current spec, and no cleanup is in scope.
