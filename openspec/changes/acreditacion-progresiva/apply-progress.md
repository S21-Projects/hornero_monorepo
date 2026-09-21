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
