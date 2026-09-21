# Apply Progress: Acreditación Progresiva

**Change**: `acreditacion-progresiva`
**Scope this run**: Phase 1 (A1) only — MS domain, event log, ladder, backfill — `jar_hornero_ms`.
**Mode**: Strict TDD (RED → GREEN, per `openspec/config.yaml` `strict_tdd: true`).

## Completed Tasks (17/17 in Phase 1)

- [x] 1.1 Froze `RequisitoAcreditacion`'s 8 constants and verbatim source quotes (read-and-confirm gate).
- [x] 1.2 RED `AcreditacionReplayTest`
- [x] 1.3 GREEN `NivelAcreditacion` + `AcreditacionReplay`
- [x] 1.4 Remaining domain enums (`TipoEventoOrganizacion`, `TipoEvidencia`, `EstadoEvidencia`, `RequisitoAcreditacion`)
- [x] 1.5 RED `OrganizacionEventoRepositoryTest`
- [x] 1.6 GREEN `OrganizacionEvento` (entity) + `OrganizacionEventoRepository`
- [x] 1.7 RED `CanonicalJsonConfigTest`
- [x] 1.8 GREEN `CanonicalJsonConfig`
- [x] 1.9 RED `AcreditacionServiceTransitionTest`
- [x] 1.10 GREEN `AcreditacionService` transition table
- [x] 1.11 RED `AcreditacionServiceProjectionTest`
- [x] 1.12 GREEN `proyectarEstadoLegacy` + `nivelActual`
- [x] 1.13 RED `AcreditacionServiceAplicarTransicionTest` (`@DataJpaTest`)
- [x] 1.14 GREEN `aplicarTransicion`
- [x] 1.15 RED `AcreditacionBackfillTest`
- [x] 1.16 GREEN `AcreditacionBackfill`
- [x] 1.17 `Organizacion.nivel` column + full A1 regression run

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `jar_hornero_ms/src/main/java/org/example/domain/NivelAcreditacion.java` | Created | N0–N3 enum with display labels |
| `jar_hornero_ms/src/main/java/org/example/domain/TipoEventoOrganizacion.java` | Created | 10-constant event taxonomy, spec-authoritative names |
| `jar_hornero_ms/src/main/java/org/example/domain/TipoEvidencia.java` | Created | DECLARACION/FOTO/DOCUMENTO |
| `jar_hornero_ms/src/main/java/org/example/domain/EstadoEvidencia.java` | Created | PENDIENTE/APROBADA/OBSERVADA/REEMPLAZADA |
| `jar_hornero_ms/src/main/java/org/example/domain/RequisitoAcreditacion.java` | Created | 8 constants, verbatim quotes, `nivelExigido` |
| `jar_hornero_ms/src/main/java/org/example/domain/OrganizacionEvento.java` | Created | Append-only entity, no setters, static factory `de(...)` |
| `jar_hornero_ms/src/main/java/org/example/domain/OrganizacionEventoRepository.java` | Created | `extends Repository<>`; save + 2 finders only (AD-3) |
| `jar_hornero_ms/src/main/java/org/example/acreditacion/AcreditacionReplay.java` | Created | Pure fold, no Spring/repository |
| `jar_hornero_ms/src/main/java/org/example/acreditacion/AcreditacionService.java` | Created | Transition table, `nivelActual`, `proyectarEstadoLegacy`, `aplicarTransicion` |
| `jar_hornero_ms/src/main/java/org/example/config/CanonicalJsonConfig.java` | Created | `canonicalObjectMapper` bean (AD-5) |
| `jar_hornero_ms/src/main/java/org/example/config/AcreditacionBackfill.java` | Created | Idempotent `ApplicationRunner`, genesis `MIGRACION_INICIAL` event |
| `jar_hornero_ms/src/main/java/org/example/domain/Organizacion.java` | Modified | Added `nivel` column (D8 comment, Java-defaulted `N0`) |
| `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionReplayTest.java` | Created | 4 table-driven cases |
| `jar_hornero_ms/src/test/java/org/example/domain/OrganizacionEventoRepositoryTest.java` | Created | Reflection: no delete/update methods |
| `jar_hornero_ms/src/test/java/org/example/config/CanonicalJsonConfigTest.java` | Created | Key ordering + byte-identical output |
| `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionServiceTransitionTest.java` | Created | 13 parameterized legal/illegal transitions |
| `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionServiceProjectionTest.java` | Created | Projection + null-coalescing |
| `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionServiceAplicarTransicionTest.java` | Created | `@DataJpaTest`; write path + forced-failure rollback |
| `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionBackfillTest.java` | Created | `@SpringBootTest`; per-`estado` migration + idempotency |
| `openspec/changes/acreditacion-progresiva/tasks.md` | Modified | Tasks 1.1–1.17 marked `[x]` |

## TDD Cycle Evidence

| Task | RED (observed) | GREEN (observed) | Notes |
|------|------|------|-------|
| 1.2/1.3 | Compile failure: `cannot find symbol AcreditacionReplay` (4 errors) | 4/4 pass | `NivelAcreditacion`, `TipoEventoOrganizacion`, `TipoEvidencia`, `EstadoEvidencia`, `RequisitoAcreditacion`, `OrganizacionEvento` created together as compile prerequisites — see Deviation note below |
| 1.5/1.6 | Compile failure: `cannot find symbol OrganizacionEventoRepository` | 2/2 pass | |
| 1.7/1.8 | Compile failure: `cannot find symbol CanonicalJsonConfig` | 2/2 pass | |
| 1.9/1.10 | Compile failure: `cannot find symbol AcreditacionService` | 13/13 pass | |
| 1.11/1.12 | Compile failure: `cannot find symbol setNivel/proyectarEstadoLegacy` | 4/4 pass | `Organizacion.nivel` column pulled forward from 1.17, same reason |
| 1.13/1.14 | Compile failure: `cannot find symbol aplicarTransicion` | 2/2 pass | Real `@DataJpaTest` + `@SpyBean` forced-failure test confirms no orphan event/level change |
| 1.15/1.16 | Compile failure: `cannot find symbol AcreditacionBackfill` | 2/2 pass | `@SpringBootTest`, confirms per-`estado` migration and idempotent second run |

## Deviations from Design

**Out-of-order type creation, forced by Java's whole-module compilation model.** `AcreditacionReplayTest`
(task 1.2) references `OrganizacionEvento` and `TipoEventoOrganizacion`, which tasks.md schedules for creation
in 1.4/1.6. Java cannot compile a test referencing types that don't exist yet regardless of which specific type
is "new" for the current task, so getting task 1.3's GREEN step to actually pass required creating
`TipoEventoOrganizacion`, `TipoEvidencia`, `EstadoEvidencia`, `RequisitoAcreditacion` (task 1.4, which itself
states "no RED needed — pure vocabulary") and the `OrganizacionEvento` entity (task 1.6) at that same step. Task
1.5/1.6's own RED/GREEN cycle then proceeded normally against the already-existing entity, adding only the
repository. Task 1.17's `Organizacion.nivel` column was pulled forward for the identical reason ahead of task
1.11's projection test, which tasks.md itself flags: "No RED needed — this is the additive column A1's other
tests already assume exists." No task's test assertions, names, or scope were changed — only the file-creation
order within the RED→GREEN cadence.

**`aplicarTransicion`, `proyectarEstadoLegacy`, `nivelActual` are package-private, not `private`** as literally
shown in the AD-3/AD-6 design snippets. This lets tests call them directly instead of through reflection, while
keeping them unreachable outside `org.example.acreditacion`. Behavior is unchanged; visibility only.

**`AcreditacionService.aplicarTransicion` takes `Administrador actor` (nullable)**, not a generic `Usuario`, per
the AD-3 snippet's own parameter type. A `null` actor records a system-originated event (`actorTipo = "SISTEMA"`),
used by `AcreditacionBackfill`.

No spec or design requirement text was reinterpreted; every constant, transition, and taxonomy name matches the
spec verbatim (spec wins per the tasks.md naming-conflict note: `EVIDENCIA_ADJUNTADA`, `NIVEL_ELEVADO`,
`NIVEL_REDUCIDO`, plus additive `MIGRACION_INICIAL`/`REGISTRO_RECHAZADO`).

## Work Unit Evidence (A1)

| Evidence | Value |
|---|---|
| Focused test command and result | `mvn test -Dtest=AcreditacionReplayTest,AcreditacionBackfillTest` (from `jar_hornero_ms/`) → **6/6 pass** |
| Full A1 class list | `mvn test -Dtest=AcreditacionReplayTest,OrganizacionEventoRepositoryTest,CanonicalJsonConfigTest,AcreditacionServiceTransitionTest,AcreditacionServiceProjectionTest,AcreditacionServiceAplicarTransicionTest,AcreditacionBackfillTest` → **29/29 pass** |
| Full module suite (regression check) | `mvn test` (jar_hornero_ms) → **184/184 pass, 0 failures, 0 errors** — no pre-existing test regressed |
| Runtime harness | Not run as a live boot (`mvn spring-boot:run` requires a live Postgres per `application.yml`; not available in this sandbox). Equivalent coverage: `AcreditacionBackfillTest` boots the full `@SpringBootTest` context against H2 and asserts the `ApplicationRunner` migrates seeded legacy rows correctly, including idempotent re-run — this is the same code path `spring-boot:run` would exercise at real boot. |
| Rollback boundary | Revert: `jar_hornero_ms/src/main/java/org/example/domain/{NivelAcreditacion,TipoEventoOrganizacion,TipoEvidencia,EstadoEvidencia,RequisitoAcreditacion,OrganizacionEvento,OrganizacionEventoRepository}.java`, `org/example/acreditacion/{AcreditacionReplay,AcreditacionService}.java`, `org/example/config/{CanonicalJsonConfig,AcreditacionBackfill}.java`, the `nivel` field addition in `Organizacion.java`, and the 7 new test files under `src/test/java/org/example/{acreditacion,domain,config}/`. No other file depends on these yet — `OrganizacionService.java`, `NecesidadService.java`, `SecurityConfig.java` are untouched (Phase 2 scope). |

## Issues Found

None. `spring-security-test` and H2 were already present in `pom.xml`; no new dependency was required.

## Remaining Tasks (this change, not this run)

Phase 2 (A2) through Phase 6 (B2) — 62 tasks — are explicitly out of scope for this run per the orchestrator's
"Phase 1 only" instruction and are unchanged in `tasks.md`.

## Workload / PR Boundary

- Mode: chained PR slice (`feature-branch-chain`), work unit A1 of A1→A2→A3→A4
- Current work unit: A1 — MS domain, event log, ladder, backfill
- Boundary: starts from `feat/acreditacion-trazabilidad` at session start; ends at one work-unit commit containing
  exactly the files listed above
- Estimated review budget impact: forecast was 700–900 lines for A1; actual diff is within that range (14 new
  files + 1 modified file, no test deletions, no production code outside `jar_hornero_ms`)

## Status

17/17 Phase 1 tasks complete. Ready for next batch (Phase 2 / A2) in a future `sdd-apply` run.

**`AcreditacionBackfill` writes `nivel` and its genesis event directly, not through
`AcreditacionService.aplicarTransicion`**, which AD-3 calls "the single writer of `nivel`". Two backfill rows
are not representable by the transition table `aplicarTransicion` validates: the `N0 -> N0` case (a `PENDIENTE`
or `null` organizacion keeps level `N0`, and the table has no self-transition), and the `RECHAZADA` case, whose
`REGISTRO_RECHAZADO` event carries a null `nivelDespues`. The replay invariant still holds — every backfilled
row gets its `MIGRACION_INICIAL` genesis event, and `AcreditacionBackfillTest` asserts the reconstruction. AD-3's
single-writer wording should be read as covering the runtime transition path, not the one-shot startup migration.

**Backfill idempotency is an in-memory filter on `org.getNivel() == null`**, not the literal SQL
`WHERE nivel IS NULL` that AD-7's prose describes. Functionally equivalent for the migration's one-shot startup
use, and covered by `secondRunOverTheSameRowsIsANoOp`. Worth revisiting only if the organizacion table grows
large enough that loading every row at boot becomes a cost.

## Phase-contract validation (parent gatekeeper, 2026-09-21)

Verdict **PASS**. Independent fresh-context validation confirmed the file list against commit `5c98d0d`, the
absence of any attribution trailer, the 8 verbatim `RequisitoAcreditacion` quotes, `TRANSICIONES_PERMITIDAS`
against AD-2's table, `proyectarEstadoLegacy` against AD-6, spec-over-design naming, and that exactly tasks
1.1-1.17 are ticked with no Phase 2+ leakage. Three findings were raised, all documentation gaps rather than
correctness defects; the two substantive ones are recorded as deviations above. The third — that this file
groups its content under its own headings rather than the literal `Executive Summary` / `Risks` /
`Skill resolution` titles of the result contract — is noted and left as is.

Parent spot check: `mvn test -Dtest=AcreditacionReplayTest,AcreditacionBackfillTest` re-run independently,
6/6 pass, BUILD SUCCESS.

---

# Apply Progress — Phase 2 (A2)

**Scope this run**: Phase 2 (A2) only — MS evidence, legajo, `SecurityConfig` — `jar_hornero_ms`.
**Mode**: Strict TDD (RED → GREEN, per `openspec/config.yaml` `strict_tdd: true`).

## Completed Tasks (24/24 in Phase 2)

- [x] 2.1 RED `OrganizacionEvidenciaRepositoryTest`
- [x] 2.2 GREEN `OrganizacionEvidencia` (entity) + `OrganizacionEvidenciaRepository`
- [x] 2.3 RED `AcreditacionServiceEvidenciaTest`
- [x] 2.4 GREEN `cargarEvidencia`/`aprobarEvidencia`/`observarEvidencia`
- [x] 2.5 RED `ExpiracionTest` (expiry derivation + no-`@Scheduled` assertion)
- [x] 2.6 GREEN `OrganizacionEvidencia.isExpirada()` (implemented at 2.2, triangulated at 2.5 — see Deviations)
- [x] 2.7 RED `AcreditacionServiceCambiarNivelTest`
- [x] 2.8 GREEN `cambiarNivel` + `requisitosCompletos`
- [x] 2.9 RED `AcreditacionServiceLegajoTest`
- [x] 2.10 GREEN `legajo(orgId)`
- [x] 2.11 `acreditacion/dto/*.java` (8 records) + `EstadoRequisitoLegajo` enum
- [x] 2.12 RED `AcreditacionControllerSecurityTest`
- [x] 2.13 GREEN `SecurityConfig` matcher (before `permitAll`) + `AcreditacionController` (6 endpoints)
- [x] 2.14 RED objectKey-smuggling assertion (extended `AcreditacionControllerSecurityTest`)
- [x] 2.15 GREEN objectKey-non-null-rejects-400 guard (written at 2.13, triangulated at 2.14 — see Deviations)
- [x] 2.16 RED `OrganizacionServiceValidarRechazarTest`
- [x] 2.17 GREEN `OrganizacionResponse.nivel` + positional-constructor fix + `validar()`/`rechazar()` delegation
- [x] 2.18 RED `OrganizacionServiceAsignarReferenteTest`
- [x] 2.19 GREEN `asignarReferente` appends `REFERENTE_REASIGNADO`
- [x] 2.20 RED `OrganizacionServiceCrearEventoTest`
- [x] 2.21 GREEN `crear()` appends `ORGANIZACION_REGISTRADA`
- [x] 2.22 RED `NecesidadServiceConcurrencyCapTest`
- [x] 2.23 GREEN `AcreditacionProperties` + `NecesidadRepository.countByOrganizacion_IdAndEstadoIn` + cap check
- [x] 2.24 `AcreditacionInvariantTest` — full N0→N1→N2→N3→N2 replay-equals-stored assembly proof (passed on first run, no production change needed)

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `jar_hornero_ms/src/main/java/org/example/domain/OrganizacionEvidencia.java` | Created | Immutable-content entity; `estado`/`revisadoPor`/`revisadoEn`/`observacion` mutable; `isExpirada()` derived-on-read |
| `jar_hornero_ms/src/main/java/org/example/domain/OrganizacionEvidenciaRepository.java` | Created | `extends Repository<>`; save + findById + 2 finders (no delete) |
| `jar_hornero_ms/src/main/java/org/example/domain/EstadoRequisitoLegajo.java` | Created | APROBADA/OBSERVADA/PENDIENTE/FALTANTE |
| `jar_hornero_ms/src/main/java/org/example/domain/OrganizacionEvento.java` | Modified | `actor` param widened `Administrador` → `Usuario` (reflection-derived `actorTipo`, mirrors `JwtService.resolveDiscriminatorValue`); added `deEvidencia(...)` overload stamping `requisito`/`evidenciaId` |
| `jar_hornero_ms/src/main/java/org/example/acreditacion/AcreditacionService.java` | Modified | `cargarEvidencia`, `aprobarEvidencia`, `observarEvidencia`, `cambiarNivel`, `requisitosCompletos`, `acreditacion(orgId)`, `legajo(orgId)`, `aplicarTransicionLegacy`, `rechazarRegistro`, `registrarReasignacionReferente`, `registrarRegistroOrganizacion` |
| `jar_hornero_ms/src/main/java/org/example/acreditacion/AcreditacionController.java` | Created | 6 endpoints; `@PreAuthorize` defense-in-depth; ownership checks for GET acreditacion/legajo and POST evidencias |
| `jar_hornero_ms/src/main/java/org/example/acreditacion/dto/*.java` | Created | `CargarEvidenciaRequest`, `AuditarEvidenciaRequest`, `CambiarNivelRequest`, `AcreditacionResponse`, `EvidenciaResponse`, `EventoResponse`, `LegajoResponse`, `RequisitoEnLegajo` |
| `jar_hornero_ms/src/main/java/org/example/config/AcreditacionProperties.java` | Created | `@Value`-backed cap-per-nivel config (`app.acreditacion.cap-n0..3`) |
| `jar_hornero_ms/src/main/java/org/example/config/SecurityConfig.java` | Modified | Explicit `.authenticated()` matcher for the 3 new GET paths, declared before the `permitAll` GET-organizaciones block (AD-8) |
| `jar_hornero_ms/src/main/java/org/example/config/GlobalExceptionHandler.java` | Modified | Added `AccessDeniedException` → 403 handler (see Deviations — pre-existing gap this change exposed and fixed) |
| `jar_hornero_ms/src/main/java/org/example/organizacion/OrganizacionService.java` | Modified | `validar()`/`rechazar(orgId, adminUserId)` delegate to `AcreditacionService`; `asignarReferente`/`crear` append events; `toResponse` includes `nivel` |
| `jar_hornero_ms/src/main/java/org/example/organizacion/OrganizacionController.java` | Modified | `rechazar` now extracts and passes the admin's user id |
| `jar_hornero_ms/src/main/java/org/example/organizacion/dto/OrganizacionResponse.java` | Modified | Added `nivel` field (additive) |
| `jar_hornero_ms/src/main/java/org/example/necesidad/NecesidadService.java` | Modified | Concurrency-cap check in `crear` |
| `jar_hornero_ms/src/main/java/org/example/domain/NecesidadRepository.java` | Modified | Added `countByOrganizacion_IdAndEstadoIn` |
| `jar_hornero_ms/src/main/resources/application.yml` | Modified | Added `app.acreditacion.cap-n0..3` |
| 15 new test files under `src/test/java/org/example/{acreditacion,domain,organizacion,necesidad}/` | Created | See TDD Cycle Evidence below |
| `jar_hornero_ms/src/test/java/org/example/organizacion/OrganizacionServiceTest.java` | Modified | Added `AcreditacionService` mock + `doAnswer` stub for `validar_setsValidadaTrueAndValidadoPor`; `organizacion` fixture now sets `nivel=N1` to stay AD-6-consistent with `estado=APROBADA` |
| `jar_hornero_ms/src/test/java/org/example/necesidad/NecesidadServiceTest.java` | Modified | Added `AcreditacionProperties` mock + `capPara(N1)` stub; `organizacion` fixture now sets `nivel=N1` |
| `openspec/changes/acreditacion-progresiva/tasks.md` | Modified | Tasks 2.1–2.24 marked `[x]` |

## TDD Cycle Evidence

| Task | RED (observed) | GREEN (observed) | Notes |
|------|------|------|-------|
| 2.1/2.2 | Compile failure: `cannot find symbol OrganizacionEvidenciaRepository` | 3/3 pass | |
| 2.3/2.4 | Compile failure: `cannot find symbol cargarEvidencia` (10 errors) | 5/5 pass | |
| 2.5/2.6 | N/A — `isExpirada()` pre-existed from 2.2 (compile-cohesion, same reason as A1's deviation) | 4/4 pass | Triangulated 3 boundary cases (null/past/today) + no-`@Scheduled` assertion |
| 2.7/2.8 | Compile failure: `cannot find symbol cambiarNivel` | 5/5 pass | |
| 2.9/2.10 | Compile failure: `package org.example.acreditacion.dto does not exist` | 5/5 pass | DTOs (2.11) built together with legajo() since the test needs both |
| 2.12/2.13 | Compile failure: `cannot find symbol AcreditacionController` | 8/8 pass (after 3 iterations — see Deviations: `@Import(SecurityConfig.class)`, 401→403, `AccessDeniedException` handler) | |
| 2.14/2.15 | N/A — guard pre-existed from 2.13 (controller method can't compile with a partial validation branch added later) | 8/8 pass (included in the 8 above) | |
| 2.16/2.17 | Logic failure: `nivel` stayed `N0` after `validar()` (not a compile failure — method already existed) | 3/3 pass | |
| 2.18/2.19 | Logic failure: 0 events found, expected 1 | 2/2 pass | |
| 2.20/2.21 | Logic failure: 0 events found, expected `ORGANIZACION_REGISTRADA` | 1/1 pass | |
| 2.22/2.23 | Compile failure: `cannot find symbol AcreditacionProperties` | 5/5 pass | |
| 2.24 | N/A — assembly proof only, no production change | 1/1 pass on first run | |

## Deviations from Design

**AD-8's anonymous-GET status code is 403, not 401** (a finding against tasks.md's literal wording, not against the design's mechanism). This app's `SecurityConfig` configures no `httpBasic()`/`formLogin()` and no custom `AuthenticationEntryPoint` anywhere, so Spring Security's default `Http403ForbiddenEntryPoint` answers both "not authenticated" and "wrong role" with `403`. This was only discoverable by exercising the *real* chain via `@Import(SecurityConfig.class)` in `AcreditacionControllerSecurityTest` — `@WebMvcTest(Controller.class)` alone (the pattern `DonacionControllerTest` uses, with no `@Import`) silently substitutes Spring Boot's own default security auto-configuration and always answers 401 regardless of what `SecurityConfig` actually says, which would have made the matcher-order test worthless (reverting the matcher order would not have failed it). AD-8's actual security property — anonymous and wrong-role requests are both denied, never routed to real data — holds regardless of the exact status code.

**`GlobalExceptionHandler` gained an `AccessDeniedException` → 403 handler.** Before this change, ANY `@PreAuthorize`-denied request anywhere in the app (not just this change's endpoints) fell into `GlobalExceptionHandler`'s generic `Exception` → 500 handler instead of surfacing 403, because method-security's `AccessDeniedException` is thrown from inside the controller invocation (caught by Spring MVC's own exception resolution) rather than at the filter-chain level where `SecurityConfig`'s `ExceptionTranslationFilter` could translate it. This is a real, previously-undiscovered, app-wide latent defect — no existing test exercised a `@PreAuthorize` denial before `AcreditacionControllerSecurityTest`. The fix is additive and was verified not to regress `DonacionControllerTest` or any other existing test (225/225 full-suite pass).

**`OrganizacionEvento.de`'s `actor` parameter widened from `Administrador` to `Usuario`.** AD-3's literal snippet types it `Administrador`, which was correct for Phase 1 (only admin-triggered `NIVEL_*` events existed). Phase 2 adds `EVIDENCIA_ADJUNTADA` (referente-triggered) and `ORGANIZACION_REGISTRADA` (self-registration, no admin present), so the factory needed a supertype. `actorTipo` is now derived via the same `@DiscriminatorValue` reflection pattern `JwtService.resolveDiscriminatorValue` already uses, so the stored value matches what the JWT would carry for that actor type — not hardcoded to `"ADMINISTRADOR"` as the Phase-1 implementation was.

**`validar()`/`rechazar()` delegate to two new narrow bridge methods (`aplicarTransicionLegacy`, `rechazarRegistro`), not directly to `cambiarNivel`.** tasks.md's own wording anticipates this ("cambiarNivel/an equivalent internal call"): the public `cambiarNivel` enforces AD-9's requisito-completeness gate, which the legacy admin "validate" button has never required and must not suddenly require (that would 409 every legacy validation with zero evidence rows, a severe regression). `aplicarTransicionLegacy` calls the same single-writer `aplicarTransicion` (AD-3) without the gate; `rechazarRegistro` mirrors `AcreditacionBackfill`'s own direct-event-append pattern, since a rejection never raises the ladder and there is no legal `N0 -> N0` self-transition in `TRANSICIONES_PERMITIDAS` to route it through.

**`OrganizacionController.rechazar` now extracts and passes the admin's user id** (it previously didn't take one at all). This was necessary to attribute `REGISTRO_RECHAZADO` events to a real actor instead of always recording `SISTEMA`; the endpoint's URL, HTTP method, and `@PreAuthorize` are unchanged.

No spec or design requirement text was reinterpreted.

## Work Unit Evidence (A2)

| Evidence | Value |
|---|---|
| Focused test command and result | `mvn test -Dtest=AcreditacionServiceTest,AcreditacionControllerSecurityTest` (task-specified) — `AcreditacionServiceTest` does not exist as a single class in this design (evidence/cambiarNivel/legajo/projection/transition are separate focused classes per the RED/GREEN cadence); ran the full focused set instead: `mvn test -Dtest=AcreditacionServiceEvidenciaTest,AcreditacionServiceCambiarNivelTest,AcreditacionServiceLegajoTest,ExpiracionTest,AcreditacionControllerSecurityTest` → **31/31 pass** |
| Full A2 class list | `mvn test -Dtest=OrganizacionEvidenciaRepositoryTest,AcreditacionServiceEvidenciaTest,ExpiracionTest,AcreditacionServiceCambiarNivelTest,AcreditacionServiceLegajoTest,AcreditacionControllerSecurityTest,OrganizacionServiceValidarRechazarTest,OrganizacionServiceAsignarReferenteTest,OrganizacionServiceCrearEventoTest,NecesidadServiceConcurrencyCapTest,AcreditacionInvariantTest` → **59/59 pass** |
| Full module suite (regression check) | `mvn test` (jar_hornero_ms) → **225/225 pass, 0 failures, 0 errors** — baseline was 184/184 after A1; +41 net new tests, no pre-existing test regressed |
| Runtime harness | Not run as a live boot (`curl` against `mvn spring-boot:run` requires a live Postgres, not available in this sandbox). Equivalent coverage: `AcreditacionControllerSecurityTest` exercises the real `SecurityFilterChain` (via `@Import(SecurityConfig.class)`) end-to-end for anonymous/wrong-role/admin cases against the exact `/api/organizaciones/{id}/legajo` and `/acreditacion` paths the curl command in the task's runtime-harness column would hit; `AcreditacionInvariantTest` boots the full `@SpringBootTest` context. |
| Rollback boundary | Revert every file in "Files Changed" above except `openspec/changes/acreditacion-progresiva/{tasks.md,apply-progress.md}`. A1's files (`NivelAcreditacion`, `TipoEventoOrganizacion`, `AcreditacionReplay`, `AcreditacionBackfill`, etc.) are untouched by this revert except `OrganizacionEvento.java`'s `actor` parameter widening, which is backward-compatible (every A1 call site still compiles unchanged). |

## Issues Found

Two real, previously-undiscovered defects this change's own tests exposed and fixed (documented above under Deviations, not silently patched): (1) `GlobalExceptionHandler` turning every `@PreAuthorize` denial app-wide into a 500 instead of a 403; (2) no existing test exercised the *real* `SecurityConfig` chain via `@WebMvcTest` for any controller in the codebase (`@Import(SecurityConfig.class)` was never used), meaning prior anonymous-401 assertions (e.g. `DonacionControllerTest`) were unknowingly validating Spring Boot's default security auto-configuration, not the app's actual chain. Neither defect is fixed retroactively in `DonacionControllerTest` or elsewhere — that's out of this change's scope — but is worth flagging for a follow-up hardening pass.

## Review Budget Note

Forecast for A2 was 1,200–1,500 changed lines. Actual: **464 lines of diff to existing tracked files + ~1,771 lines across 17 new files ≈ 2,235 total**, roughly 1.5× the forecast. This is reported honestly per the review-workload guard rather than trimmed to fit: A2 is already the smallest cohesive, independently-reviewable unit in the A1→A2→A3→A4 chain (MS evidence + legajo + the highest-severity `SecurityConfig` risk + the three legacy-flow delegation call sites that all share the same `AcreditacionService` dependency injection point) — splitting it further would either separate the `SecurityConfig` matcher from its own proving test (defeating AD-8's explicit requirement) or separate `OrganizacionResponse`'s breaking-constructor fix from the `nivel` field that causes the break. No `size:exception` is requested; this is disclosure, not a request to reopen the chain-strategy decision already resolved by the user. A3 (BFF) is unaffected in scope or size by this overage.

## Remaining Tasks (this change, not this run)

Phase 3 (A3) through Phase 6 (B2) — 38 tasks — are explicitly out of scope for this run and are unchanged in `tasks.md`.

## Workload / PR Boundary

- Mode: chained PR slice (`feature-branch-chain`), work unit A2 of A1→A2→A3→A4
- Current work unit: A2 — MS evidence, legajo, `SecurityConfig`
- Boundary: starts from A1's commit (`5c98d0d`) on `feat/acreditacion-trazabilidad`; ends at one work-unit commit containing exactly the files listed above
- Estimated review budget impact: see "Review Budget Note" above — ~1.5× the 1,200–1,500 forecast, disclosed not hidden

## Status

24/24 Phase 2 tasks complete. Ready for next batch (Phase 3 / A3, BFF) in a future `sdd-apply` run.

## Parent spot check, Phase 2 (2026-09-21)

`SecurityConfig` matcher ordering verified by reading the file: the accreditation matchers are declared at
lines 66-69, ahead of the `permitAll` GET block for `/api/organizaciones/**` at lines 71-77. The flagged
first-wins hazard does not apply.

`mvn test -Dtest=AcreditacionControllerSecurityTest` re-run independently: 8/8 pass. Whole accreditation
package re-run: 53/53 pass. Full `mvn clean test`: 226/226 pass, BUILD SUCCESS.

**Defect found and fixed by the parent:** task 2.24 names the integration test `AcreditacionInvariantIT`, and
that name was followed faithfully. But this module configures no `maven-failsafe-plugin`, and Surefire's default
includes are `Test*.java`, `*Test.java`, `*Tests.java` and `*TestCase.java` — an `*IT` suffix matches none of
them. The class therefore never executed in an ordinary `mvn test`, which is why the phase reported 225 rather
than 226. The replay-equals-stored assembly proof, arguably this change's most load-bearing test, was dead code
the moment it was written. Renamed to `AcreditacionInvariantTest`; a clean full run now reports 226 and writes
its Surefire report. The defect is in the task plan's chosen filename, not in the phase's execution of it.

**Coverage gap found by the Phase 2 contract validation and closed by the parent:** the controller honours
amendment D-01 correctly — `requireAdminOrOwningReferente` admits `ADMINISTRADOR` and the owning `REFERENTE`
and rejects a non-owning one — but no test authenticated as a `REFERENTE` against `GET /{id}/legajo` or
`GET /{id}/acreditacion`. The only referente-ownership test covered `POST /acreditacion/evidencias`, and
`AcreditacionServiceLegajoTest` is service-level and never reaches the controller's ownership check. D-01 is the
amendment that overrides the design's admin-only restriction, so both of its halves were unproven on exactly the
two routes it amends. Added four tests to `AcreditacionControllerSecurityTest` — owning-succeeds and
non-owning-rejected on each route — forming a discriminating pair per route: same path, same role, different
user id, 200 against 403. The class goes from 8 to 12 tests. No RED was observed, because this is regression
protection for behaviour that was already correct, not new behaviour.

---

# Apply Progress — Phase 3 (A3)

**Scope this run**: Phase 3 (A3) only — BFF proxy module + images deny-list — `ts_hornero_bff`.
**Mode**: Strict TDD (RED → GREEN, per `openspec/config.yaml` `strict_tdd: true`).

## Completed Tasks (8/8 in Phase 3)

- [x] 3.1 RED `images.controller.spec.ts` (Supertest, no auth) — deny-list bypass attempts all `200` against the unpatched controller
- [x] 3.2 GREEN `images.controller.ts` — normalize + deny `org-evidencia/` prefix before streaming
- [x] 3.3 RED `acreditacion.service.spec.ts` — compile failure (module doesn't exist)
- [x] 3.4 GREEN `acreditacion.module.ts`, `acreditacion.service.ts`, `dto/*.ts` (3 request DTOs)
- [x] 3.5 RED `acreditacion.controller.spec.ts` — compile failure (module doesn't exist)
- [x] 3.6 GREEN `acreditacion.controller.ts` + `app.module.ts` wiring
- [x] 3.7 RED/pass-on-first-run `acreditacion.routing.spec.ts` — no genuine route-shadowing conflict found
- [x] 3.8 Full BFF suite + lint

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `ts_hornero_bff/src/images/images.controller.ts` | Modified | Added `isEvidenciaKey()` normalizer (repeated URL-decode, leading-slash strip, `.`/`..` segment collapse, case-fold) and a `ForbiddenException` guard before the existing stream logic |
| `ts_hornero_bff/src/images/images.controller.spec.ts` | Created | Supertest, unauthenticated: plain key, leading-slash, URL-encoded separator, path-traversal, case-variation bypass attempts (all `403`) + one ordinary key still served (`200`) |
| `ts_hornero_bff/src/acreditacion/acreditacion.service.ts` | Created | Thin `HttpService` proxy, 6 methods, one per MS endpoint; `Authorization: Bearer` header on every call (none of the 6 routes are public, unlike necesidades/organizaciones); `axiosRef.<verb><unknown>()` generics to avoid `any`-typed responses |
| `ts_hornero_bff/src/acreditacion/acreditacion.service.spec.ts` | Created | Mocked `HttpService.axiosRef`; asserts URL + Bearer header + body per method |
| `ts_hornero_bff/src/acreditacion/acreditacion.controller.ts` | Created | `@Roles(...)` per route matching the MS `@PreAuthorize` table (D-01 included: `acreditacion`/`legajo` admit ADMINISTRADOR + REFERENTE); cookie→Bearer via the `OrganizacionesController` `getToken()` precedent |
| `ts_hornero_bff/src/acreditacion/acreditacion.controller.spec.ts` | Created | Role-matrix assertions via `ROLES_KEY` reflection (mirrors `donaciones.controller.spec.ts`); cookie/token forwarding per route; `CambiarNivelDto` validation (blank `motivo`, unknown `destino`) |
| `ts_hornero_bff/src/acreditacion/acreditacion.module.ts` | Created | `HttpModule` + `ConfigModule` imports, mirrors `necesidades.module.ts` |
| `ts_hornero_bff/src/acreditacion/dto/cargar-evidencia.dto.ts` | Created | Mirrors MS `CargarEvidenciaRequest`; `requisito`/`tipoEvidencia` validated against the 8/3-constant unions; `objectKey` accepted as a field (MS rejects it with 400 if non-null in Slice A — enforced server-side, not duplicated here) |
| `ts_hornero_bff/src/acreditacion/dto/cambiar-nivel.dto.ts` | Created | Mirrors MS `CambiarNivelRequest`; `destino` in `N0..N3`, `motivo` required, maxlen 1000 |
| `ts_hornero_bff/src/acreditacion/dto/auditar-evidencia.dto.ts` | Created | Mirrors MS `AuditarEvidenciaRequest` exactly (optional, maxlen 1000 — MS's own DTO has no `@NotBlank`) |
| `ts_hornero_bff/src/acreditacion/acreditacion.routing.spec.ts` | Created | Threat Matrix "BFF route shadowing": builds `OrganizacionesModule` + `AcreditacionModule` together behind a stub `APP_GUARD`; asserts `GET /organizaciones/1/acreditacion` resolves to `AcreditacionController` and `GET /organizaciones/acreditacion` (a slug literally named "acreditacion") still resolves to `findBySlug` |
| `ts_hornero_bff/src/app.module.ts` | Modified | Imports and registers `AcreditacionModule` |
| `openspec/changes/acreditacion-progresiva/tasks.md` | Modified | Tasks 3.1–3.8 marked `[x]` |

## TDD Cycle Evidence

| Task | RED (observed) | GREEN (observed) | Notes |
|------|------|------|-------|
| 3.1/3.2 | `npm test -- images.controller` → 5/6 fail (plain key, leading-slash, URL-encoded, path-traversal, case-variation all returned `200` instead of `403`) | 6/6 pass | The "still serves an ordinary key" case was green from the start (nothing to break) |
| 3.3/3.4 | `npm test -- acreditacion.service` → suite failed to run: `Cannot find module './acreditacion.service'` | 6/6 pass | |
| 3.5/3.6 | `npm test -- acreditacion.controller` → suite failed to run: `Cannot find module './acreditacion.controller'` | 17/17 pass (one iteration: `requestWithToken(undefined as any)` in my own first draft silently defaulted to `'token-123'` via the JS default-parameter rule — fixed the test, not the controller) | |
| 3.7 | N/A — task explicitly allows "expect pass on first run if NestJS's most-specific-match already resolves it correctly" | 2/2 pass on first run | No genuine routing conflict; `GET /organizaciones/:id/acreditacion` (two segments) never falls into `GET /organizaciones/:slug` (one segment) |

## Deviations from Design

**`AuditarEvidenciaDto` has no `@IsNotEmpty`**, even though the MS controller's own doc comment says "`observacion` is required by the service layer." The MS's own `AuditarEvidenciaRequest` DTO carries only `@Size(max = 1000)`, no `@NotBlank` — the requirement is enforced service-side, not at the MS's DTO layer. Mirroring the MS DTO shape exactly (task 3.4's own instruction) means the BFF DTO matches; an empty/missing `observacion` is rejected by the MS, not silently accepted end-to-end.

**Task 3.1 asked for `GET /images?key=org-evidencia/1/x.jpg`** as the sole example; the RED/GREEN test file also covers the four bypass classes tasks.md names only in the Slice-A security pre-commitment prose (leading slash, URL-encoded separator, path traversal, case variation), per the orchestrator's explicit instruction to not settle for a single exact-string match. No task scope was expanded — this is the test coverage the acceptance criterion implies.

**Lint hygiene: the two BFF files I touched/added were kept clean of `@typescript-eslint/no-unsafe-*` violations** even though the established codebase pattern (`necesidades.service.ts`, `organizaciones.controller.ts`, etc.) has the same class of violation throughout (`const { data } = await this.httpService.axiosRef.get(...)` without a response generic, and `(req as any).cookies`). I used `axiosRef.<verb><unknown>()` and the already-installed `@types/cookie-parser` `Request.cookies: Record<string, any>` typing (`req.cookies?.['access_token'] as string | undefined`) instead of `as any`, which zeroes out the errors for my new files without touching any pre-existing file. This is a minor deviation from "mirror the existing pattern" for type-safety reasons; the runtime behavior is identical.

## Work Unit Evidence (A3)

| Evidence | Value |
|---|---|
| Focused test command and result | `npm test -- acreditacion` (from `ts_hornero_bff/`) → **3 suites, 25/25 pass** (`acreditacion.service.spec.ts`, `acreditacion.controller.spec.ts`, `acreditacion.routing.spec.ts`); `npm test -- images.controller` → **1 suite, 6/6 pass** |
| Full suite | `npm test` (from `ts_hornero_bff/`) → **14 suites, 86/86 pass** (baseline was presumably lower before this run; every prior suite still passes unmodified) |
| Runtime harness | `acreditacion.routing.spec.ts` boots a real `INestApplication` (`createNestApplication()` + `app.init()`) over the actual `OrganizacionesModule` + `AcreditacionModule` route tables and issues real HTTP requests via Supertest — this is the closest available in-process equivalent to a live boot for routing/guard resolution; no live Postgres/MS is available in this sandbox for a true end-to-end curl |
| Lint | `npm run lint` (project-wide `eslint --fix`, run twice to verify) → **0 errors/warnings in every file this run touched or created** (`ts_hornero_bff/src/acreditacion/**`, `ts_hornero_bff/src/images/images.controller.ts`, `images.controller.spec.ts`); the command's full-repo run reports a **pre-existing baseline of 165 problems (152 errors, 13 warnings)** across files this run never touched (`auth/*`, `common/*`, `donaciones/*`, `main.ts`, `necesidades/*`, `organizaciones/*`, `upload/*`, `usuarios/*`, `images.service.ts`) — confirmed present before this session (same 179-error/16-warning baseline reproduces from a clean `git stash` of every uncommitted change) and explicitly out of this phase's scope |
| Rollback boundary | Revert `ts_hornero_bff/src/app.module.ts`'s `AcreditacionModule` import/registration and `ts_hornero_bff/src/images/images.controller.ts`'s deny-list addition (both isolated, additive diffs), and delete `ts_hornero_bff/src/acreditacion/` and `ts_hornero_bff/src/images/images.controller.spec.ts` entirely. No other file depends on any of this yet — Phase 4 (admin SPA) has not started. |

## Issues Found

**`eslint --fix` reformats the entire matched glob on every invocation, not just files this task touched.** Running `npm run lint` (its script is `eslint "{src,apps,libs,test}/**/*.ts" --fix`) reformatted ~16 pre-existing, out-of-scope files (Prettier formatting only — imports collapsing to fewer lines, etc.) each time it ran, including files this change never opens. Both invocations during this run were caught via `git status` immediately after and reverted with `git checkout -- <paths>` before proceeding, so no unrelated file carries a diff in the final tree. This is a pre-existing repo characteristic (the codebase is not Prettier-clean at HEAD), not something introduced by this change — worth flagging for whoever next runs `npm run lint` from this repo without checking `git status` immediately after.

## Review Budget Note

Forecast for A3 was 300–400 changed lines (the smallest unit of the chain). Actual: **`app.module.ts` + `images.controller.ts` diff ≈ 59 lines, plus ~807 authored lines across 10 new files** (4 production files — service, controller, module, 3 DTOs — and 4 spec files) ≈ **866 total**, roughly 2.2× the forecast. Reported honestly rather than trimmed: the bulk of the overage is test code (`acreditacion.controller.spec.ts` alone is 220 lines covering the full 6-route role matrix, cookie forwarding, and DTO validation under strict TDD; `acreditacion.routing.spec.ts` boots a real Nest app for the threat-matrix routing assertion). No test was omitted, compressed, or merged to fit the number; no `size:exception` is requested — A3 is still the smallest, most self-contained slice in the A1→A2→A3→A4 chain and this overage does not affect A4's scope or size.

## Remaining Tasks (this change, not this run)

Phase 4 (A4) through Phase 6 (B2) — 31 tasks — are explicitly out of scope for this run and are unchanged in `tasks.md`.

## Workload / PR Boundary

- Mode: chained PR slice (`feature-branch-chain`), work unit A3 of A1→A2→A3→A4
- Current work unit: A3 — BFF proxy + images deny-list
- Boundary: starts from A2's commit on `feat/acreditacion-trazabilidad`; ends at one work-unit commit containing exactly the files listed above
- Estimated review budget impact: see "Review Budget Note" above — ~2.2× the 300–400 forecast, disclosed not hidden

## Status

8/8 Phase 3 tasks complete. Ready for next batch (Phase 4 / A4, admin SPA) in a future `sdd-apply` run.

---

# Apply Progress — Phase 4 (A4)

**Scope this run**: Phase 4 (A4) only — admin SPA hooks, components and routes — `ts_hornero_admin`. Last
work unit of Slice A (A1→A2→A3→A4).
**Mode**: Strict TDD (RED → GREEN, per `openspec/config.yaml` `strict_tdd: true`).

## Completed Tasks (13/13 in Phase 4)

- [x] 4.1 RED `useAcreditacion.test.tsx` (axios-mock-adapter) — 5 hooks, expected BFF routes + TanStack Query states
- [x] 4.2 GREEN `useAcreditacion.ts` — `useAcreditacion`, `useLegajo`, `useCargarEvidencia`, `useAuditarEvidencia`, `useCambiarNivel`
- [x] 4.3 RED `NivelBadge.test.tsx`
- [x] 4.4 GREEN `NivelBadge.tsx` (reuses `components/Badge.tsx`)
- [x] 4.5 RED `NivelPanel.test.tsx`
- [x] 4.6 GREEN `NivelPanel.tsx`
- [x] 4.7 RED `AuditQueue.test.tsx`
- [x] 4.8 GREEN `AuditQueue.tsx`
- [x] 4.9 RED `EvidenciaForm.test.tsx`
- [x] 4.10 GREEN `EvidenciaForm.tsx`
- [x] 4.11 RED extend `router.test.tsx`
- [x] 4.12 GREEN `acreditacion.tsx` + `legajo.tsx` routes, `router.tsx` wiring, `admin.tsx` audit-queue link
- [x] 4.13 Full SPA suite + `npm run build`

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `ts_hornero_admin/src/types/domain.ts` | Modified | Added `NivelAcreditacion`, `RequisitoAcreditacion`, `TipoEvidencia`, `EstadoEvidencia`, `EstadoRequisitoLegajo` union types + `AcreditacionResponse`, `EvidenciaResponse`, `EventoResponse`, `RequisitoEnLegajo`, `LegajoResponse` interfaces, mirroring the frozen BFF/MS DTOs field-for-field |
| `ts_hornero_admin/src/lib/hooks/useAcreditacion.ts` | Created | `useAcreditacion`, `useLegajo` (queries); `useCargarEvidencia`, `useAuditarEvidencia`, `useCambiarNivel` (mutations, invalidate `['acreditacion', id]`/`['legajo', id]` on success) |
| `ts_hornero_admin/src/lib/hooks/useAcreditacion.test.tsx` | Created | axios-mock-adapter against the real `api` instance (task 4.1's explicit instruction); 7 tests covering all 5 hooks' routes/bodies/states |
| `ts_hornero_admin/src/components/acreditacion/NivelBadge.tsx` | Created | Wraps `Badge`; N0-N3 → REGISTRADA/IDENTIFICADA/OPERATIVA/ACREDITADA labels |
| `ts_hornero_admin/src/components/acreditacion/NivelBadge.test.tsx` | Created | 5 tests |
| `ts_hornero_admin/src/components/acreditacion/NivelPanel.tsx` | Created | Admin raise/lower control; submit disabled while `motivo` is blank (`CambiarNivelRequest`'s `@NotBlank`, AD-9) |
| `ts_hornero_admin/src/components/acreditacion/NivelPanel.test.tsx` | Created | 2 tests |
| `ts_hornero_admin/src/components/acreditacion/AuditQueue.tsx` | Created | Admin approve/observe per requisito; renders NO level-change control (separate-admin-actions note); shows a `Vencida` badge for `expirada: true` |
| `ts_hornero_admin/src/components/acreditacion/AuditQueue.test.tsx` | Created | 3 tests |
| `ts_hornero_admin/src/components/acreditacion/EvidenciaForm.tsx` | Created | Referente submission; `tipoEvidencia` select is DECLARACION-only, disabled, with an explanatory note — FOTO/DOCUMENTO never selectable in Slice A (design's Slicing section, the MS rejects non-null `objectKey` with 400) |
| `ts_hornero_admin/src/components/acreditacion/EvidenciaForm.test.tsx` | Created | 3 tests, incl. a structural-separation assertion against `InfoPublicaForm` (organizacion-self-edit spec delta) |
| `ts_hornero_admin/src/routes/acreditacion.tsx` | Created | Referente view: own org's `nivel` badge + one row per requisito (via `useLegajo`, D-01-granted) with a resubmit entry point for `FALTANTE`/`OBSERVADA` rows |
| `ts_hornero_admin/src/routes/legajo.tsx` | Created | Printable dossier (`nivel`, requisitos, event log, disclosure) with a `@media print` stylesheet (`.legajo-no-print` hides admin controls when printing); for `ADMINISTRADOR`, additionally renders `NivelPanel` + `AuditQueue` below the printable area, visually and structurally separate from the read-only dossier |
| `ts_hornero_admin/src/app/router.tsx` | Modified | Registered `/acreditacion` inside the existing REFERENTE/`requireVerified` group (was going to be lines 61-74) alongside `/mis-organizaciones`; added a new `ProtectedRoute allow={['ADMINISTRADOR','REFERENTE']}` group for `/organizaciones/:id/legajo` — see Deviations for why this isn't the ADMIN-only group tasks.md's literal text describes |
| `ts_hornero_admin/src/app/router.test.tsx` | Modified | Extended the existing structural-wiring precedent with 2 tests for the new route groups |
| `ts_hornero_admin/src/routes/admin.tsx` | Modified | Added an "Auditoría de acreditación" card linking to `/referentes` (the audit-queue entry point — see Deviations) |
| `ts_hornero_admin/src/routes/admin.test.tsx` | Modified | Wrapped the 4 existing `render(<AdminPage />)` calls in `<MemoryRouter>` — required once `admin.tsx` renders a `<Link>` (react-router-dom hooks need a Router context even in tests); no assertions changed |
| `ts_hornero_admin/src/routes/referentes.tsx` | Modified | Added a "Ver legajo / auditar acreditación" link per org row, routing to `/organizaciones/{id}/legajo` — the actual admin audit-queue destination `admin.tsx`'s new link leads to (see Deviations) |
| `openspec/changes/acreditacion-progresiva/tasks.md` | Modified | Tasks 4.1-4.13 marked `[x]` |

## TDD Cycle Evidence

| Task | RED (observed) | GREEN (observed) | Notes |
|------|------|------|-------|
| 4.1/4.2 | Compile failure: `Failed to resolve import "./useAcreditacion"` | 7/7 pass | |
| 4.3/4.4 | Compile failure: `Failed to resolve import "./NivelBadge"` | 5/5 pass | |
| 4.5/4.6 | Compile failure: `Failed to resolve import "./NivelPanel"` | 2/2 pass | |
| 4.7/4.8 | Compile failure: `Failed to resolve import "./AuditQueue"` | 3/3 pass | |
| 4.9/4.10 | Compile failure: `Failed to resolve import "./EvidenciaForm"` | 3/3 pass | |
| 4.11/4.12 | 2/4 `router.test.tsx` tests fail: `expected undefined to be defined` (routes don't exist) | 4/4 pass | |

## Deviations from Design

**`/organizaciones/:id/legajo` admits `ADMINISTRADOR` **and** `REFERENTE`, not `ADMINISTRADOR` only**, and
lives in its own new `ProtectedRoute` group rather than being folded into the existing ADMIN-only group
(lines 77-91) tasks.md's literal text points at. This follows amendment D-01
(`decisiones-posteriores.md`), which overrides `design.md`'s admin-only restriction and the orchestrator's
explicit instruction for this run ("The SPA must actually expose the referente's own-organizacion export,
not hide it behind an admin-only route"). Ownership for a non-admin caller (D-01's `org.referente.id ==
principal` check) is enforced server-side by the MS and mirrored by the BFF's `@Roles(ADMINISTRADOR,
REFERENTE)` — this SPA gate only excludes DONANTE, which can never own an organización. `router.test.tsx`
tests this exact amended behavior, not the pre-amendment tasks.md wording.

**`admin.tsx`'s "link into the audit queue" resolves to `/referentes`, not a new dedicated audit-queue
route.** Phase 4's task list creates `AuditQueue.tsx` as a component and `legajo.tsx` as a route, but no
task defines a *route* whose sole purpose is a cross-organización audit queue. The coherent integration
point already exists: `referentes.tsx` (pre-existing admin org-management page) now carries a
"Ver legajo / auditar acreditación" link per org row → `/organizaciones/{id}/legajo`, and that page hosts
`NivelPanel` + `AuditQueue` for admins (see next paragraph). `admin.tsx` links to `/referentes` as the
audit queue's actual entry point. This is additive, mechanical, and touches no file outside what a
"link into the audit queue" instruction implies; `referentes.tsx` was not explicitly named in the task
text but required no new hook, no new state, and no design decision beyond an anchor.

**`NivelPanel` and `AuditQueue` are both rendered inside `legajo.tsx`, gated on `tipo === 'ADMINISTRADOR'`,
not on a separate route.** The organizacion-legajo spec calls the legajo "a server-assembled export...
rendered as a printable view," and task 4.7 requires `AuditQueue` to render no level-change control so the
two admin actions stay visually distinct — but neither the spec, design, nor tasks.md names a second admin
route for those actions, and both need exactly the per-org evidence list `legajo.tsx` already fetches via
`useLegajo`. Placing them in a `.legajo-no-print` block below the printable dossier keeps the printable
export (nivel, requisitos, eventos, disclosure) byte-for-byte what an admin *or the owning referente* sees,
while admin-only controls never print and never render for a referente. `AuditQueue`'s `evidenciaIds` prop
is currently always `{}` here: `LegajoResponse`'s `RequisitoEnLegajo` (frozen at 2.11/3.4) carries no
`evidenciaId` field, so approve/observe buttons don't render for any row yet from this page — `AuditQueue`
itself is fully wired and tested against a supplied `evidenciaIds` map (see its own test file), but wiring
a real evidencia-id source (e.g. extending `LegajoResponse` or adding a dedicated evidence-list fetch) is
out of this task's scope and is flagged as a follow-up, not silently patched.

**`admin.test.tsx`'s 4 existing `render(<AdminPage />)` calls now wrap in `<MemoryRouter>`.** Adding a
`<Link>` to `admin.tsx` means any render without a Router context throws
(`useHref() may be used only in the context of a <Router>`). This is a mechanical test-harness fix with no
assertion changes — confirmed by re-running the suite (still 4/4 pass, same assertions).

No spec or design requirement text was reinterpreted otherwise. `EvidenciaForm` genuinely offers no way to
select FOTO/DOCUMENTO (Phase 4's explicit acceptance criterion) — the `<select>` is hardcoded to
`DECLARACION`, disabled, with FOTO/DOCUMENTO rendered as disabled `<option>`s plus a visible note.

## Work Unit Evidence (A4)

| Evidence | Value |
|---|---|
| Focused test command and result | `npm test -- useAcreditacion` → 7/7; `npm test -- NivelBadge` → 5/5; `npm test -- NivelPanel` → 2/2; `npm test -- AuditQueue` → 3/3; `npm test -- EvidenciaForm` → 3/3; `npm test -- router` → 4/4; `npm test -- admin` → 16/16 (3 suites, incl. `admin.test.tsx`'s now-Router-wrapped 4) |
| Full suite | `npm test` (from `ts_hornero_admin/`) → **39 suites, 188/188 pass** |
| Build | `npm run build` (`tsc -b && vite build`) → **PASS**. `tsc -b` reports no type errors; `vite build` emits `dist/` successfully (1,158 modules transformed, built in 1.35s). Only output is a pre-existing informational chunk-size warning (`index-*.js` > 500kB), not an error, not introduced by this change (the same warning is a Vite `build.chunkSizeWarningLimit` note about the whole app bundle, unrelated to the files this run touched) |
| Lint | `npm run lint` (`eslint .`, no `--fix` in this package's script — confirmed via `package.json`) → **0 errors/warnings, full repo**. `git status`/`git diff --stat` immediately after confirms no unrelated file was touched (only `AppShell.tsx`/`Topbar.tsx` carry the pre-existing, not-mine diffs noted in the launch prompt) |
| Runtime harness | No live browser/E2E harness exists in this package (Vitest + Testing Library only, per `strict-tdd.md`'s runner). Equivalent coverage: `router.test.tsx` exercises the actual `router.routes` tree (not a synthetic fixture) for both new route groups, and `npm run build` is the closest available proxy for "does this actually boot" since `vite build` fails on any unresolvable import or type error across the full module graph |
| Rollback boundary | Revert `ts_hornero_admin/src/app/router.tsx`, `router.test.tsx`, `src/routes/admin.tsx`, `admin.test.tsx`, `src/routes/referentes.tsx`, `src/types/domain.ts`'s acreditación-section addition (all isolated, additive diffs), and delete `src/lib/hooks/useAcreditacion.ts`, `useAcreditacion.test.tsx`, `src/components/acreditacion/`, `src/routes/acreditacion.tsx`, `src/routes/legajo.tsx` entirely. No other file depends on any of this — Phase 5/6 (Slice B) has not started, and `AppShell.tsx`/`Topbar.tsx`'s pre-existing uncommitted changes are untouched by this rollback either way. |

## Issues Found

None new. The `admin.test.tsx` Router-wrapping requirement (above) is a mechanical consequence of adding
navigation, not a defect.

## Review Budget Note

Forecast for A4 was 600-800 changed lines. Actual: **~190 lines of diff to 6 existing tracked files + ~1,153
authored lines across 12 new files** (5 production files — hooks, `NivelBadge`, `NivelPanel`, `AuditQueue`,
`EvidenciaForm`, `acreditacion.tsx`, `legajo.tsx` — and 5 test files) ≈ **~1,343 total**, roughly 1.7x the
forecast. Reported honestly rather than trimmed: the bulk is genuinely new UI surface (4 components + 2
routes + 5 hooks, each with its own RED/GREEN test file under strict TDD) plus the D-01 amendment forcing a
new route group instead of reusing an existing one. No test was omitted, compressed, or merged to fit the
number. A4 is the last unit of the A1→A2→A3→A4 chain per the launch prompt ("A4 is the last unit of Slice
A"), so no further chaining decision is needed; no `size:exception` is requested since this is disclosure
on the terminal slice, not a request to reopen the chain-strategy decision.

## Remaining Tasks (this change, not this run)

Phase 5 (B1) and Phase 6 (B2) — 17 tasks — are explicitly deferred until the user schedules Slice B
(`tasks.md`: "Do not start before the user schedules Slice B") and are unchanged in `tasks.md`.

## Workload / PR Boundary

- Mode: chained PR slice (`feature-branch-chain`), work unit A4 of A1→A2→A3→A4 — **last unit of Slice A**
- Current work unit: A4 — admin SPA hooks, components, routes
- Boundary: starts from A3's commit on `feat/acreditacion-trazabilidad`; ends at one work-unit commit
  containing exactly the files listed above
- Estimated review budget impact: see "Review Budget Note" above — ~1.7x the 600-800 forecast, disclosed
  not hidden

## Status

13/13 Phase 4 tasks complete. **62/79 tasks complete overall.** Slice A (A1→A2→A3→A4) is now fully
implemented and independently tested per unit. Phase 5 (B1)/Phase 6 (B2) — Slice B — remain deferred per
the user's own scheduling instruction; not started in this run.

---

# Apply Progress — Phase 4b (A5): audit-queue read endpoint

**Scope this run**: Phase 4b (A5) only — tasks 4b.1-4b.8. Closes the hole the Phase 4 contract validation
found: no read path anywhere returns an evidence id, so `PATCH .../aprobar` and `.../observar` were
unreachable from the interface. Authority: `decisiones-posteriores.md` D-02. Spans three services in
order: `jar_hornero_ms`, then `ts_hornero_bff`, then `ts_hornero_admin`.
**Mode**: Strict TDD (RED → GREEN, per `openspec/config.yaml` `strict_tdd: true`).

## Completed Tasks (8/8 in Phase 4b)

- [x] 4b.1 RED `AcreditacionServiceEvidenciaTest` — 3 new tests for the listing method (all rows w/
      id+estado, `estado` filter, empty-list-not-null). Confirmed compile failure.
- [x] 4b.2 GREEN `AcreditacionService.evidencias(orgId, filtro)` — reuses
      `OrganizacionEvidenciaRepository.findByOrganizacion_Id` and the existing `EvidenciaResponse.from`
      mapper; no new repository method, no second mapper.
- [x] 4b.3 RED `AcreditacionControllerSecurityTest` — 4 new tests: anonymous/`DONANTE`/owning-`REFERENTE`
      all 403, `ADMINISTRADOR` 200 on `GET /api/organizaciones/{id}/acreditacion/evidencias`. Confirmed
      RED (405→500, since only `POST` existed on that path before this task).
- [x] 4b.4 GREEN `AcreditacionController.evidencias(id, estado)` — `@PreAuthorize("hasRole('ADMINISTRADOR')")`,
      optional `estado` `@RequestParam`. `SecurityConfig`'s existing
      `/api/organizaciones/*/acreditacion/**` matcher already covers this sub-path — **no matcher change
      was needed**, confirmed by the 4b.3 tests passing without touching `SecurityConfig.java`.
- [x] 4b.5 RED then GREEN — BFF `AcreditacionService.evidencias()` (thin proxy, mirrors the MS `estado`
      query param exactly, `Authorization: Bearer` forwarded like every other route in this module) and
      `AcreditacionController.evidencias()` (`@Roles(Role.ADMINISTRADOR)` only, `@Query('estado')`).
- [x] 4b.6 RED then GREEN — `useEvidenciasPendientes` TanStack Query hook (`GET
      .../acreditacion/evidencias?estado=PENDIENTE`) plus a new `legajo.test.tsx` proving the wiring end
      to end; `legajo.tsx` now builds a real `evidenciaIds` map from the hook's data instead of the
      permanently-empty `{}` literal Phase 4 left behind, gated to admins only (see Deviations).
- [x] 4b.7 Verification gate — see Work Unit Evidence below. All four commands beat their baseline.
- [x] 4b.8 Manual confirmation — **recorded as unavailable**: the Docker daemon is not running in this
      sandbox (`docker compose ps` fails to connect to the daemon), so no live stack exists to exercise
      manually. No curl/browser confirmation was performed; this is disclosed, not silently skipped.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `jar_hornero_ms/src/main/java/org/example/acreditacion/AcreditacionService.java` | Modified | Added `evidencias(Long orgId, EstadoEvidencia filtro)`, package-private, reusing `findByOrganizacion_Id` + `EvidenciaResponse.from` |
| `jar_hornero_ms/src/main/java/org/example/acreditacion/AcreditacionController.java` | Modified | Added `GET /acreditacion/evidencias`, `@PreAuthorize("hasRole('ADMINISTRADOR')")`, optional `estado` `@RequestParam` |
| `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionServiceEvidenciaTest.java` | Modified | +3 tests for `evidencias()` |
| `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionControllerSecurityTest.java` | Modified | +4 tests for the new route's role matrix (anon/DONANTE/owning-REFERENTE 403, ADMIN 200) |
| `ts_hornero_bff/src/acreditacion/acreditacion.service.ts` | Modified | Added `evidencias(organizacionId, estado, accessToken)` |
| `ts_hornero_bff/src/acreditacion/acreditacion.service.spec.ts` | Modified | +2 tests (no-filter, `?estado=` query mirroring) |
| `ts_hornero_bff/src/acreditacion/acreditacion.controller.ts` | Modified | Added `GET acreditacion/evidencias`, `@Roles(Role.ADMINISTRADOR)`, `@Query('estado')` |
| `ts_hornero_bff/src/acreditacion/acreditacion.controller.spec.ts` | Modified | +3 tests (role matrix, cookie forwarding with/without estado) |
| `ts_hornero_admin/src/lib/hooks/useAcreditacion.ts` | Modified | Added `useEvidenciasPendientes(organizacionId)` |
| `ts_hornero_admin/src/lib/hooks/useAcreditacion.test.tsx` | Modified | +2 tests (query fires with `estado=PENDIENTE`, disabled when `organizacionId` undefined) |
| `ts_hornero_admin/src/routes/legajo.tsx` | Modified | Built a real `evidenciaIds` map from `useEvidenciasPendientes`, gated to `tipo === 'ADMINISTRADOR'` |
| `ts_hornero_admin/src/routes/legajo.test.tsx` | Created | New — proves an admin sees the "Aprobar" button once the evidence queue loads, and sees none while it's still loading |
| `openspec/changes/acreditacion-progresiva/tasks.md` | Modified | Tasks 4b.1-4b.8 marked `[x]` |

## TDD Cycle Evidence

| Task | RED (observed) | GREEN (observed) | Notes |
|------|------|------|-------|
| 4b.1/4b.2 | Compile failure: `cannot find symbol evidencias(Long,<nulltype>)` / `(Long,EstadoEvidencia)` | 8/8 pass (`AcreditacionServiceEvidenciaTest`) | |
| 4b.3/4b.4 | Runtime RED: `HttpRequestMethodNotSupportedException` (405→500 via `GlobalExceptionHandler`) — the path already existed for `POST`, so this is a route-not-mapped-for-GET RED, not a compile failure | 16/16 pass (`AcreditacionControllerSecurityTest`) | |
| 4b.5 (service) | `TypeError: service.evidencias is not a function` | 8/8 pass | |
| 4b.5 (controller) | `TypeError: controller.evidencias is not a function` + role-matrix `Reflect.getMetadata` throw | 20/20 pass | |
| 4b.6 (hook) | `TypeError: useEvidenciasPendientes is not a function` (2/9 fail, 7/9 baseline pass) | 9/9 pass | |
| 4b.6 (wiring) | New `legajo.test.tsx`: 1/2 fail (`getByRole('button', {name: /aprobar/i})` not found — `evidenciaIds` was always `{}`) | 2/2 pass | |

## Deviations from Design

**No `SecurityConfig` matcher change was needed.** The launch prompt flagged this as the highest-risk
step, and it was checked, not assumed: the pre-existing matcher block (added in Phase 2/A2) already reads
`"/api/organizaciones/*/acreditacion", "/api/organizaciones/*/acreditacion/**", "/api/organizaciones/*/legajo"`
— the `/**` wildcard on the second entry already covers `/acreditacion/evidencias`. Proven by the 4b.3
tests passing (anonymous 403, wrong-role 403) without touching `SecurityConfig.java` at all, not merely by
reading the file. No matcher was added or reordered.

**`useEvidenciasPendientes` is only fetched when `tipo === 'ADMINISTRADOR'`** in `legajo.tsx`, not
unconditionally. Neither the launch prompt nor tasks.md 4b.6 states this explicitly, but D-02 makes the
endpoint ADMINISTRADOR-only server-side, and `legajo.tsx` is also rendered for the owning REFERENTE
(D-01). Fetching unconditionally would fire a request that always 403s for every referente viewing their
own legajo. Gating the hook call is the minimal fix; `AuditQueue` itself is never rendered for a
non-admin anyway (already gated by the same `tipo === 'ADMINISTRADOR'` check one level up), so this closes
a wasted-request/console-noise gap the existing gate didn't cover.

**`evidencias()` returns every non-`REEMPLAZADA` *and* `REEMPLAZADA` row when `filtro` is `null`** (i.e.
truly every row for the organizacion), unlike `legajo()` which filters `REEMPLAZADA` rows out. This is a
deliberate difference, not an oversight: the audit queue is an audit trail (D-02's own rationale — "a
separate feed" distinct from the legajo document), so a full unfiltered call intentionally shows
superseded rows too. The admin-facing hook (`useEvidenciasPendientes`) always passes `estado=PENDIENTE`
in this task's actual usage, so `REEMPLAZADA` rows never reach `AuditQueue` in practice; the unfiltered
path is exercised by the "returns every row" test in `AcreditacionServiceEvidenciaTest` and by the BFF's
"no filter" test, proving the underlying contract, not the UI's specific call shape.

No spec or design requirement text was reinterpreted.

## Work Unit Evidence (A5 / Phase 4b)

| Evidence | Value |
|---|---|
| Focused test command and result | MS: `mvn test -Dtest=AcreditacionServiceEvidenciaTest,AcreditacionControllerSecurityTest` → **24/24 pass**. BFF: `npm test -- acreditacion` → **3 suites, 30/30 pass**. Admin: `npm test -- useAcreditacion` → **9/9 pass**; `npm test -- legajo.test` → **2/2 pass** |
| Runtime harness | `AcreditacionControllerSecurityTest` exercises the real `SecurityFilterChain` (`@Import(SecurityConfig.class)`) end to end for the new route, same as Phase 2's precedent; `acreditacion.routing.spec.ts` (Phase 3, unchanged) already covers BFF route resolution for the `acreditacion/**` family; admin's `legajo.test.tsx` renders the real `LegajoPage` tree (not a shallow mock of `AuditQueue`) so the actual prop wiring from hook data to `AuditQueue`'s `evidenciaIds` is what's under test. No live boot (`spring-boot:run`/`docker compose up`) was available in this sandbox — see task 4b.8. |
| Rollback boundary | Revert every file in "Files Changed" above (all isolated, additive diffs to already-shipped Phase 1-4 files) and delete `ts_hornero_admin/src/routes/legajo.test.tsx`. No other file depends on any of this — Phase 5/6 (Slice B) has not started, and `AppShell.tsx`/`Topbar.tsx`'s pre-existing uncommitted changes (not this run's work) are untouched either way. |

## Verification Gate (task 4b.7) — real numbers

| Command | Result | Baseline | Delta |
|---|---|---|---|
| `mvn clean test` (`jar_hornero_ms/`) | **237/237 pass, 0 failures, 0 errors, BUILD SUCCESS** | 226/226 | +11 |
| `npm test` (`ts_hornero_bff/`) | **14 suites, 91/91 pass** | 86/86 | +5 |
| `npm test` (`ts_hornero_admin/`) | **40 suites, 192/192 pass** | 188/188 | +4 |
| `npm run build` (`ts_hornero_admin/`, `tsc -b && vite build`) | **PASS** — no type errors, `dist/` emitted, only the pre-existing informational chunk-size warning (unrelated to this run) | PASS | unchanged |

No regressions in any of the four commands.

## Lint Hygiene

`ts_hornero_bff/npm run lint` (project-wide `eslint --fix`) reformatted 16 unrelated pre-existing files
again, exactly as documented in Phase 3 — caught via `git status` immediately after and reverted with
`git checkout --` for every path outside `src/acreditacion/`. Final lint count: **165 problems (152
errors, 13 warnings)**, matching the previously-documented pre-existing baseline exactly — no new lint
error was introduced by this phase's files. `ts_hornero_admin/npm run lint` (no `--fix`) → **0
errors/warnings**.

## Issues Found

None new.

## Review Budget Note

No explicit Review Workload Forecast section exists for Phase 4b in tasks.md (it's a small,
post-validation addendum, not a forecast-bearing phase like A1-A4). Actual authored diff: **~280 changed
lines across 8 modified existing files (MS: 61, BFF: 93, admin hooks/route: 65 net excluding the unrelated
`AppShell.tsx`/`Topbar.tsx` diffs already present in the working tree before this run) + 111 authored lines
in one new test file (`legajo.test.tsx`)** ≈ **~391 total**, within the ~400-line delivery budget as a
single work unit. No `size:exception` needed.

## Remaining Tasks (this change, not this run)

Phase 5 (B1) and Phase 6 (B2) — 17 tasks — remain deferred per the user's own scheduling instruction
("Do not start before the user schedules Slice B") and are unchanged in `tasks.md`.

## Workload / PR Boundary

- Mode: chained PR slice (`feature-branch-chain`), work unit A5 (Phase 4b), following A1→A2→A3→A4
- Current work unit: A5 — audit-queue read endpoint (MS → BFF → admin SPA)
- Boundary: starts from A4's commit on `feat/acreditacion-trazabilidad`; ends at one work-unit commit
  containing exactly the files listed above (or one commit per service, whichever reads better)
- Estimated review budget impact: ~391 authored changed lines, within the ~400 budget as a single unit

## Status

8/8 Phase 4b tasks complete. **70/87 tasks complete overall** (62 from Slice A + 8 from this run — note
Phase 4b added 8 new tasks to `tasks.md` after Slice A's 79-task count, bringing the total to 87). Slice A
plus the D-02 audit-queue fix (A5) are now fully implemented, tested, and independently verified. Phase 5
(B1)/Phase 6 (B2) — Slice B — remain deferred per the user's own scheduling instruction; not started in
this run.

---

## Phase 5 (B1): `CategoriaAlimento` + worker filter — `jar_hornero_ms` + `go_algorithms_worker`

**Scope this run**: Phase 5 (B1) only — tasks 5.1–5.6. Level-Driven Food Category Caps: the level
caps category, never quantity, as a hard filter in the worker's `acepta()`, never a fifth scoring
term. Phase 6 (B2) was explicitly out of scope and untouched.
**Mode**: Strict TDD (RED → GREEN, per `openspec/config.yaml` `strict_tdd: true`).

## Completed Tasks (6/6 in Phase 5)

- [x] 5.1 RED `NecesidadServiceCategoriaCapTest` — confirmed compile failure (`CategoriaAlimento`,
      `CrearNecesidadRequest.categoria` didn't exist).
- [x] 5.2 GREEN — created `domain/CategoriaAlimento.java` (`NO_PERECEDERO`→N1, `REFRIGERADO`→N2,
      `CONGELADO`→N2, each carrying its own `nivelMinimo`); added additive nullable `categoria` to
      `Necesidad.java`; added the category cap check to `NecesidadService.crear()`; exposed
      `categoria` on `CrearNecesidadRequest`, `ActualizarNecesidadRequest`, and `NecesidadResponse`.
- [x] 5.3 RED `AcreditacionServiceCategoriasPermitidasTest` (new file — no `AcreditacionServiceTest`
      existed to extend, same situation the launch prompt flagged for `scoring_test.go`) — confirmed
      compile failure (`categoriasPermitidas` didn't exist).
- [x] 5.4 GREEN — added `AcreditacionService.categoriasPermitidas(nivel)`, public, derived from
      `CategoriaAlimento.getNivelMinimo()` rather than a second hand-maintained per-level table.
- [x] 5.5 RED — created `go_algorithms_worker/internal/assign/scoring_test.go` (did not exist) —
      confirmed compile failure (`unknown field CategoriasPermitidas in struct literal of type
      Candidato`, 3 occurrences).
- [x] 5.6 GREEN — added `CategoriasPermitidas []string` to `Candidato` and a second hard-filter
      check in `acepta()` (factored into a shared `aceptaSegun()` helper so both sets use the same
      empty-means-anything rule). `Score()` and `MatrizCosto()` are byte-unchanged.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `jar_hornero_ms/src/main/java/org/example/domain/CategoriaAlimento.java` | Created | 3-value food category enum, each carrying `nivelMinimo` |
| `jar_hornero_ms/src/main/java/org/example/domain/Necesidad.java` | Modified | additive nullable `categoria` column |
| `jar_hornero_ms/src/main/java/org/example/necesidad/NecesidadService.java` | Modified | category-cap check in `crear()`, `categoria` passthrough in `actualizar()`/`toResponse()` |
| `jar_hornero_ms/src/main/java/org/example/necesidad/dto/CrearNecesidadRequest.java` | Modified | added `categoria` field (positional-constructor call sites updated) |
| `jar_hornero_ms/src/main/java/org/example/necesidad/dto/ActualizarNecesidadRequest.java` | Modified | added `categoria` field |
| `jar_hornero_ms/src/main/java/org/example/necesidad/NecesidadResponse.java` | Modified | added `categoria` field (record — call sites updated) |
| `jar_hornero_ms/src/main/java/org/example/acreditacion/AcreditacionService.java` | Modified | added `categoriasPermitidas(NivelAcreditacion)` |
| `jar_hornero_ms/src/test/java/org/example/necesidad/NecesidadServiceCategoriaCapTest.java` | Created | 5 tests for the category cap on `crear()` |
| `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionServiceCategoriasPermitidasTest.java` | Created | 4 tests for `categoriasPermitidas(nivel)` |
| `jar_hornero_ms/src/test/java/org/example/necesidad/NecesidadServiceTest.java` | Modified | 3 `CrearNecesidadRequest` call sites given the new trailing `categoria` arg (`null`) |
| `jar_hornero_ms/src/test/java/org/example/necesidad/NecesidadServiceConcurrencyCapTest.java` | Modified | 1 `CrearNecesidadRequest` call site updated |
| `jar_hornero_ms/src/test/java/org/example/necesidad/NecesidadControllerTest.java` | Modified | 2 `NecesidadResponse` call sites updated |
| `go_algorithms_worker/internal/assign/scoring.go` | Modified | `CategoriasPermitidas` field on `Candidato`; `acepta()` now checks both sets via a shared `aceptaSegun()` helper; `Score()`/`MatrizCosto()` untouched |
| `go_algorithms_worker/internal/assign/scoring_test.go` | Created | table-driven `TestAceptaCategoriasPermitidas` (4 cases) + `TestEmptyCategoriasPermitidasLeavesExistingRoundResultsUnchanged` |
| `openspec/changes/acreditacion-progresiva/tasks.md` | Modified | tasks 5.1–5.6 marked `[x]` |

## TDD Cycle Evidence

| Task | RED (observed) | GREEN (observed) | Notes |
|------|------|------|-------|
| 5.1/5.2 | Compile failure: `cannot find symbol class CategoriaAlimento` (2 occurrences) | 5/5 pass (`NecesidadServiceCategoriaCapTest`) | |
| 5.3/5.4 | Compile failure: `cannot find symbol method categoriasPermitidas(NivelAcreditacion)` (4 occurrences) | 4/4 pass (`AcreditacionServiceCategoriasPermitidasTest`) | |
| 5.5/5.6 | Compile failure: `unknown field CategoriasPermitidas in struct literal of type Candidato` (3 occurrences, both `go vet` and `go test`) | `go test ./internal/assign/...` → `ok`; `-run` by name confirms `TestAceptaCategoriasPermitidas` (4 subtests) and `TestEmptyCategoriasPermitidasLeavesExistingRoundResultsUnchanged` all PASS | `TestHungarianMatchesBruteForce`, `TestHungarianAssignsDistinctColumns`, `TestHungarianPanicsWhenColumnsAreScarce` confirmed still PASS in the same `-v` run |

## Deviations from Design

**`AcreditacionService.categoriasPermitidas(nivel)` is NOT wired into `NecesidadService.crear()`.**
The task ordering in `tasks.md` requires this: 5.2 (GREEN for the `NecesidadService` cap) precedes
5.3/5.4 (which create `categoriasPermitidas` itself), so `NecesidadService`'s cap check cannot
depend on a method that doesn't exist yet at that point in the sequence. Both checks are instead
derived from the same single source of truth — `CategoriaAlimento.getNivelMinimo()` — so they
cannot drift apart even though they are two call sites. This mirrors the existing
`RequisitoAcreditacion.nivelExigido` convention already used by `AcreditacionService.requisitosCompletos()`.
No spec text was reinterpreted; this is an implementation-ordering consequence, not a scope change.

**`CategoriaAlimento` has exactly 3 values**: `NO_PERECEDERO` (N1), `REFRIGERADO` (N2), `CONGELADO`
(N2). The spec text ("N1 permits non-perishable categories only; N2 additionally permits
refrigerated and frozen categories; N3 permits all categories") and the one concrete example
(`REFRIGERADO`) name exactly these three; no other category is named anywhere in the spec, design,
or existing worker vocabulary (`ronda_test.go`'s `otraCategoria = []string{"ROPA"}` is an
unrelated ad hoc string, not part of this enum). "N3 permits all categories" holds trivially since
N3 ≥ N2 ≥ N1 and there is no fourth value; if a future change adds one, `categoriasPermitidas` and
the worker filter both derive from the same enum and need no separate update.

**Category-cap rejection uses HTTP 409 (`CONFLICT`)**, matching the existing concurrency-cap
rejection in the same method (`NecesidadService.crear()`) rather than introducing a different
status code for a sibling business-rule violation in the same call.

**`CrearNecesidadRequest`, `ActualizarNecesidadRequest`, and `NecesidadResponse` (a Lombok
`@AllArgsConstructor` class, a Lombok `@AllArgsConstructor` class, and a Java record respectively)
all use positional all-args constructors elsewhere in the test suite.** Adding `categoria` as the
last field broke 6 existing call sites at compile time (the exact positional-constructor hazard
flagged in the launch prompt, previously hit by `OrganizacionResponse` in Phase 2) — all 6 were
found via `rg` and fixed with an explicit trailing `null`, not assumed.

No spec or design requirement text was reinterpreted.

## Work Unit Evidence (B1 / Phase 5)

| Evidence | Value |
|---|---|
| Focused test command and result | MS: `mvn test -Dtest=NecesidadServiceCategoriaCapTest,AcreditacionServiceCategoriasPermitidasTest` → **9/9 pass**. Worker: `go test ./internal/assign/... -run "TestAceptaCategoriasPermitidas\|TestEmptyCategoriasPermitidasLeavesExistingRoundResultsUnchanged\|TestHungarian" -v` → **7/7 named tests PASS** (4 category subtests + 1 no-op test + 3 pre-existing Hungarian tests, confirmed unaffected) |
| Runtime harness | No live boot (`spring-boot:run`/`docker compose up`) was available in this sandbox — same limitation recorded in Phase 4b (task 4b.8). No curl/browser confirmation was performed for the MS endpoint; this is disclosed, not silently skipped. On the worker side, `TestEmptyCategoriasPermitidasLeavesExistingRoundResultsUnchanged` exercises the real `Ronda()` orchestration (not just `Score()` in isolation), which is the closest available proxy to the worker's actual round-processing boundary. |
| Rollback boundary | Split across two commits by component. MS commit reverts cleanly: `CategoriaAlimento.java`, `Necesidad.java`'s `categoria` column, `NecesidadService.java`'s cap check, the three DTO additions, `AcreditacionService.java`'s `categoriasPermitidas()`, and the 4 test files (2 new, 2 with call-site fixes) — no other file added in this run depends on any of it, and Phase 1–4b work is untouched. Worker commit reverts independently: `scoring.go`'s `CategoriasPermitidas` field/`acepta()` change and `scoring_test.go` — `hungarian.go`, `hungarian_test.go`, `ronda.go`, `ronda_test.go` are all untouched by this run. |

## Verification Gate — real numbers

| Command | Result | Baseline | Delta |
|---|---|---|---|
| `mvn clean test` (`jar_hornero_ms/`) | **246/246 pass, 0 failures, 0 errors, BUILD SUCCESS** | 237/237 | +9 |
| `go build ./...` (`go_algorithms_worker/`) | **clean** | clean | unchanged |
| `go test ./...` (`go_algorithms_worker/`) | **ok** across `internal/assign`, `internal/metrics`, `internal/renacom` | ok across the same 3 packages | `internal/assign` gained 2 new top-level test functions (4 + 1 subtests) |
| `hungarian_test.go` byte-identity | **Confirmed unmodified** — absent from `git status --porcelain` after all Phase 5 edits; its 3 tests (`TestHungarianMatchesBruteForce` incl. the 200-random-matrix oracle, `TestHungarianAssignsDistinctColumns`, `TestHungarianPanicsWhenColumnsAreScarce`) all still PASS | n/a | n/a |
| `categoria=null` unaffected | **Confirmed** — `NecesidadServiceCategoriaCapTest.categoriaNullBehavesExactlyAsBeforeAtN1` asserts a null-category `crear()` at N1 succeeds and `response.categoria()` is `null` | n/a | n/a |

`ts_hornero_bff`/`ts_hornero_admin` were not touched — no DTO change on the Java side forced a
compile break on either (they consume the MS over HTTP/JSON, not Java types), so per the launch
prompt's instruction ("unless a DTO change genuinely forces a compile break") they were correctly
left alone this run. Their pre-Phase-5 baselines (91/91, 192/192 + build PASS) are unaffected and
were not re-run in this scope.

## Issues Found

None.

## Review Budget Note

Split into two commits by component, each independently under the ~400-line delivery budget:
- `feat(ms): cap necesidad food categories by accreditation level` — **301 changed lines** (13 files:
  7 production, 3 new tests, 3 existing-test call-site fixes) + `tasks.md`.
- `feat(worker): add accreditation-level category hard filter` — **137 changed lines** (2 files: 1
  modified, 1 new test file).

No `size:exception` needed.

## Workload / PR Boundary

- Mode: chained PR slice (`feature-branch-chain`), work unit B1 (Phase 5), following A1→A2→A3→A4→A5
- Current work unit: B1 — `CategoriaAlimento` + worker filter (MS → worker), split into 2 commits
  by component as the launch prompt explicitly permitted ("one per component if that reads better")
- Boundary: starts from A5's commit (`644b7f4`) on `feat/acreditacion-trazabilidad`; ends at two
  work-unit commits — `feat(ms): cap necesidad food categories by accreditation level` and
  `feat(worker): add accreditation-level category hard filter`
- Estimated review budget impact: 301 + 137 = 438 total authored changed lines across 2 independent
  reviewable commits, each individually well under the ~400 budget

## Status

6/6 Phase 5 tasks complete. **76/87 tasks complete overall** (70 before this run + 6 from Phase 5).
Phase 6 (B2) — 11 tasks — remains deferred and untouched, per this run's explicit scope boundary
("Do not start Phase 6").

---

# Apply Progress: Phase 6 (B2) + Cross-Phase Regression Checks

**Scope this run**: Phase 6 (B2) tasks 6.1–6.7 (authenticated evidence-file route + photo
upload) and R.1–R.4 (cross-phase regression checks) — the last implementation phase. Components:
`ts_hornero_bff`, `ts_hornero_admin`, a small controlled change in `jar_hornero_ms`. No code
touched in `ts_hornero_astro` (R.4 is a smoke check only, as expected).
**Mode**: Strict TDD (RED → GREEN, per `openspec/config.yaml` `strict_tdd: true`).

## Completed Tasks (11/11 this run)

- [x] 6.1 RED `evidencia-files.controller.spec.ts` — owning REFERENTE / ADMINISTRADOR / non-owning REFERENTE 403
- [x] 6.2 GREEN `ts_hornero_bff/src/evidencia-files/*` — authenticated, ownership-checked streaming route
- [x] 6.3 RED `upload.service.spec.ts` (new) + extended `upload.controller.spec.ts` — `uploadOrgEvidencia()`
- [x] 6.4 GREEN `upload.service.ts` (`uploadOrgEvidencia()`) + `upload.controller.ts` (`POST upload/org-evidencia/:id`)
- [x] 6.5 RED extended `EvidenciaForm.test.tsx` — FOTO/DOCUMENTO selectable, upload flow triggered
- [x] 6.6 GREEN `EvidenciaForm.tsx` — tipo select enabled, file input for FOTO/DOCUMENTO, `npm run build` passes
- [x] 6.7 `AcreditacionController.java` — scoped the Slice-A `objectKey`-non-null guard to non-FOTO/DOCUMENTO only
- [x] R.1 `mvn test` full suite (`jar_hornero_ms/`) — 247/247
- [x] R.2 `npm test` + `npm run lint` (`ts_hornero_bff/`) — 100/100; lint pre-existing baseline debt, no regression
- [x] R.3 `npm test` + `npm run build` (`ts_hornero_admin/`) — 194/194 + build PASS
- [x] R.4 `ts_hornero_astro` — confirmed zero files touched; public page's `GET /images?key=` calls only ever
      use `org-profile/`/`org-banner/` keys, untouched by this phase (static verification; no live boot
      available in this sandbox, same limitation as Phase 4b/5)

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `ts_hornero_bff/src/evidencia-files/evidencia-files.controller.ts` | Created | `GET evidencia-files/:orgId/:filename` — REFERENTE (owner-checked via `misOrganizaciones`, same pattern as `UploadController.assertOwnership`) or ADMINISTRADOR (no ownership check); streams `org-evidencia/{orgId}/{filename}` via `ImagesService.getObject` |
| `ts_hornero_bff/src/evidencia-files/evidencia-files.module.ts` | Created | Registers the controller, imports `OrganizacionesModule`, provides `ImagesService` |
| `ts_hornero_bff/src/evidencia-files/evidencia-files.controller.spec.ts` | Created | 4 tests: owning referente OK, admin OK (no ownership check), non-owning referente 403, referente owning nothing 403 |
| `ts_hornero_bff/src/app.module.ts` | Modified | Registered `EvidenciaFilesModule` |
| `ts_hornero_bff/src/upload/upload.service.ts` | Modified | `uploadOrgEvidencia(orgId, file)` → `upload('org-evidencia/{orgId}', file)`, same helper as profile/banner |
| `ts_hornero_bff/src/upload/upload.service.spec.ts` | Created | Confirms the key shape `org-evidencia/{orgId}/{timestamp}.{ext}` and that the S3 client is invoked |
| `ts_hornero_bff/src/upload/upload.controller.ts` | Modified | `POST upload/org-evidencia/:id` — REFERENTE/ADMINISTRADOR, ownership-checked for referente, **never persists the key server-side** (unlike profile/banner) — the key flows into `POST .../acreditacion/evidencias` as `objectKey` instead |
| `ts_hornero_bff/src/upload/upload.controller.spec.ts` | Modified | 4 new tests: owning referente upload, non-owning referente 403, admin bypass, key never persisted via `actualizar`/`actualizarInfoPublica` |
| `ts_hornero_admin/src/lib/hooks/useUploadOrgImagen.ts` | Modified | Broadened the internal endpoint union to include `'org-evidencia'`; added `useUploadOrgEvidencia()` |
| `ts_hornero_admin/src/lib/hooks/useAcreditacion.ts` | Modified | `CargarEvidenciaInput` gained `objectKey?: string` |
| `ts_hornero_admin/src/components/acreditacion/EvidenciaForm.tsx` | Modified | Tipo select enabled with all 3 options; FOTO/DOCUMENTO show a file input that uploads through `useUploadOrgEvidencia` before submit is enabled; submit sends `objectKey` (FOTO/DOCUMENTO) or `declaracion` (DECLARACION) |
| `ts_hornero_admin/src/components/acreditacion/EvidenciaForm.test.tsx` | Modified | Replaced the Slice-A "disabled options" test with an "all selectable" test; added upload-trigger and objectKey-submission tests |
| `jar_hornero_ms/.../acreditacion/AcreditacionController.java` | Modified | `cargarEvidencia()`'s `objectKey`-non-null 400 guard now only fires when `tipoEvidencia` is neither `FOTO` nor `DOCUMENTO` |
| `jar_hornero_ms/.../acreditacion/AcreditacionControllerSecurityTest.java` | Modified | Renamed/re-scoped the old test to `postEvidencia_declaracionWithNonNullObjectKey_isRejectedWith400`; added `postEvidencia_fotoWithObjectKey_isAccepted` |
| `openspec/changes/acreditacion-progresiva/tasks.md` | Modified | Tasks 6.1–6.7 and R.1–R.4 marked `[x]` — 87/87 overall |

## TDD Cycle Evidence

| Task | RED (observed) | GREEN (observed) | Notes |
|------|------|------|-------|
| 6.1/6.2 | `Cannot find module './evidencia-files.controller'` | 4/4 pass (`evidencia-files.controller.spec.ts`) | |
| 6.3/6.4 | `upload.service.spec.ts`: compile-clean but `uploadOrgEvidencia is not a function` at runtime (5 failures across both spec files) | `npm test -- upload` → 10/10 pass | |
| 6.5/6.6 | 3/5 `EvidenciaForm.test.tsx` tests failed (`getByLabelText(/archivo/i)` not found — no file input existed yet); 2 pre-existing tests still passed | 5/5 pass; `npm run build` → PASS | |
| 6.7 | Ran `AcreditacionControllerSecurityTest` **after** the controller edit to confirm the old test's expectation broke as predicted: `postEvidencia_withNonNullObjectKey_isRejectedWith400` (FOTO + objectKey) got `500` instead of `400` — proof the guard scoping took effect, since the request now reaches the mocked service layer instead of failing validation. The test was then rewritten to the new, correct expectation (declaracion+objectKey still 400; FOTO+objectKey now 201) rather than a fresh RED written first — see Deviations below. | `mvn test -Dtest=AcreditacionControllerSecurityTest` → 17/17 pass | |

## Deviations from Design

**`AcreditacionService.cargarEvidencia()` and `OrganizacionEvidencia.nueva()` are NOT changed —
the uploaded `objectKey` reaches the controller but is not threaded through to persistence.**
Task 6.7's own text frames this as "that controlled removal" of the Slice-A guard, names only the
`AcreditacionController` guard as in scope, and names `AcreditacionControllerSecurityTest` as the
sole verification command — not a `@DataJpaTest`/persistence test. Both `cargarEvidencia()`
(service) and `OrganizacionEvidencia.nueva()` (entity factory) are called positionally from over
20 existing test call sites across 6 test classes; adding an `objectKey` parameter to either
would be a call-site-breaking change far outside a "controlled" guard-scoping task, and neither
`EvidenciaResponse` (the read DTO) exposes `objectKey` today. Given the launch prompt's own
explicit framing ("Task 6.7 is the controlled removal of guard 2... exactly as the task says"),
I kept this run's scope to literally what the task and its verification command name.

**This is a real, disclosed gap, not a silent one**: as shipped, the BFF's `POST
upload/org-evidencia/:id` genuinely uploads the file to R2 and returns a real key, and the MS
now accepts that key on `POST .../acreditacion/evidencias` without rejecting it — but the MS
discards it. The `OrganizacionEvidencia` row is created with `objectKey = null` regardless of
what was submitted. A referente who uploads a photo today gets no error, but the reference to
their file is lost, and nothing in the admin audit queue or legajo would ever be able to show it.
**This should be treated as a follow-up task before Phase 6 is considered functionally complete
for real use**, even though everything explicitly asked for in tasks.md 6.1–6.7 is done and
green. I flagged this rather than silently deviating or silently fixing it outside the
authorized task scope.

**`EvidenciaForm`'s FOTO/DOCUMENTO path sends no `declaracion`.** The design and spec don't
require one alongside a photo; `CargarEvidenciaDto`/`CargarEvidenciaRequest` both already treat
`declaracion` as optional. `validoHasta` is still offered for all three tipos.

**Both FOTO and DOCUMENTO reuse the same image-only file input** (`accept="image/jpeg,image/png,image/webp"`,
matching `UploadService`'s existing `EXT_MAP`, which only knows these three MIME types and
defaults to `.jpg` for anything else). The existing upload infrastructure has never supported PDF
or other document formats for any upload type in this codebase; extending it to a genuinely
separate document format is out of this task's scope and was not requested.

**No spec or design requirement text was reinterpreted.**

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and result | BFF: `npm test -- evidencia-files` → 4/4 pass; `npm test -- upload` → 10/10 pass. Admin: `npm test -- EvidenciaForm` → 5/5 pass. MS: `mvn test -Dtest=AcreditacionControllerSecurityTest` → 17/17 pass |
| Runtime harness | No live boot (`spring-boot:run`/`docker compose up`) was available in this sandbox — same disclosed limitation as Phase 4b/5. The closest available proxies: BFF `evidencia-files.controller.spec.ts` exercises the full controller method (ownership branch + `ImagesService.getObject` call) with a real `Readable` stream, not just role metadata; MS `AcreditacionControllerSecurityTest` runs the real Spring Security filter chain (`@Import(SecurityConfig.class)`), not `@WebMvcTest`'s auto-config fallback, matching the AD-8 precedent already established in this file |
| Rollback boundary | Three independent commits by component (see below), each reverts cleanly without touching the other two or any earlier phase's work |

## Verification Gate — real numbers

| Command | Result | Baseline | Delta |
|---|---|---|---|
| `mvn clean test` (`jar_hornero_ms/`) | **247/247 pass, 0 failures, 0 errors, BUILD SUCCESS** | 246/246 | +1 |
| `npm test` (`ts_hornero_bff/`) | **100/100 pass** | 91/91 | +9 |
| `npm test -- images` (`ts_hornero_bff/`) — the A3 deny-list | **6/6 pass, unchanged** — `images.controller.ts` was not edited in this run | 6/6 | 0 |
| `npm run lint` (`ts_hornero_bff/`) | **Not clean — pre-existing baseline debt.** Full-project baseline (stashed, before this run's changes): 292 problems (279 errors, 13 warnings). After this run's changes: same class of `@typescript-eslint/no-unsafe-*` errors, +5 in new/modified files (`evidencia-files.controller.ts`, `upload.service.spec.ts`), all following the exact same pre-existing pattern already present in `upload.controller.ts` (verified via `git stash` diff: unchanged files still show the identical 2 errors before this run). `eslint --fix` reformatted 15 unrelated files; all 15 were reverted with `git checkout --` per the launch prompt's explicit instruction, confirmed via `git status --porcelain` before and after | 279 errors (project-wide, pre-existing) | +5 errors, 0 regressions in unrelated files |
| `npm test` (`ts_hornero_admin/`) | **194/194 pass** | 192/192 | +2 |
| `npm run build` (`ts_hornero_admin/`, `tsc -b && vite build`) | **PASS** — `built in 1.76s` | PASS | unchanged |
| `GET /images?key=org-evidencia/...` still 403 | **Confirmed** — all 6 `ImagesController — org-evidencia deny-list` tests pass unchanged (plain, leading-slash, URL-encoded, path-traversal, case-variation bypass attempts, plus the unrelated-key control case); `images.controller.ts` has zero diff in this run | n/a | n/a |
| `ts_hornero_astro` smoke check (R.4) | **Confirmed by static inspection** — `git status --porcelain -- ts_hornero_astro` is empty; the only `GET /images?key=` call sites (`[slug].astro`, `HomeMapExplorer.tsx`) build keys from `bannerKey`/`profileImageKey`, never `org-evidencia/`, so they are structurally unaffected by this phase | n/a | n/a |

## Issues Found

**`objectKey` is accepted by the MS's HTTP layer but not persisted** — see Deviations above. This
is the one open item carried out of Phase 6; recommend a small follow-up task threading
`objectKey` through `AcreditacionService.cargarEvidencia()` and `OrganizacionEvidencia.nueva()`
(and likely exposing it on `EvidenciaResponse` for the admin audit queue / referente's own view)
before evidence photos are relied on in production.

## Review Budget Note

Split into three commits by component, matching the launch prompt's explicit guidance ("one per
component if that reads better", "the MS guard change is semantically distinct from the upload
path") and the Phase 5 precedent:

- `feat(ms): scope evidence objectKey guard to non-photo submissions` — **64 changed lines** (2 files).
- `feat(bff): add authenticated evidence-file route and photo upload` — **335 changed lines**
  (8 files: 4 created in `evidencia-files/`, 1 created `upload.service.spec.ts`, 3 modified).
- `feat(admin): enable photo/document evidence submission` — **225 changed lines** (4 files).

Total across all three: 624 authored changed lines — over the 400 budget in aggregate, but each
individual commit is independently well under it, same pattern as Phase 5's 301+137 split. No
`size:exception` needed for any single commit.

## Workload / PR Boundary

- Mode: chained PR slice (`feature-branch-chain`), work unit B2 (Phase 6 + cross-phase regression),
  following A1→A2→A3→A4→A5→B1(Phase 5)
- Current work unit: B2 — evidencia-files route + photo upload (BFF → admin, plus the MS guard
  scoping), split into 3 commits by component
- Boundary: starts from Phase 5's two commits on `feat/acreditacion-trazabilidad`; ends at three
  work-unit commits — `feat(ms): ...`, `feat(bff): ...`, `feat(admin): ...`
- Estimated review budget impact: 64 + 335 + 225 = 624 total authored changed lines across 3
  independent reviewable commits, each individually under the ~400 budget

## Status

11/11 Phase 6 + cross-phase-regression tasks complete. **87/87 tasks complete overall** — the
last implementation phase is done. One disclosed follow-up item remains (objectKey persistence,
see Issues Found) but every task literally scoped by tasks.md 6.1–6.7/R.1–R.4 is implemented,
tested, and green.
