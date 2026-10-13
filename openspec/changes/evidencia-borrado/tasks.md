# Tasks: Claim evidence deletion (evidencia-borrado, P2)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650-800 (prod code ~350, tests ~230, config/compose/admin ~50, docs ~100) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (phases 1+2: deletion core, anonymization + sweep) -> PR 2 (phases 3+4: wiring, admin labels, docs) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Note: each phase ends in its own work-unit commit regardless of the PR split. Phase 1 alone is
~400 lines; phases 1 and 2 together exceed the budget, so the realistic split is
PR 1 = phase 1, PR 2 = phase 2, PR 3 = phases 3+4 (or merge 2+3+4 if the user accepts ~400).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Port + adapters + anonymization event + listener (post-commit deletion, failure isolation) | PR 1 | `mvn test -Dtest='EvidenciaBorradoListenerTest,UsuarioAnonimizacionServiceTest'` (in `jar_hornero_ms`) | Task 4.1 (MinIO) | Revert unit-1 commit: removes `org.example.evidencia`, pom deps, event publish; anonymization behaves as before |
| 2 | Nightly orphan sweep + kill switch | PR 2 (base = PR 1 branch for feature-branch-chain) | `mvn test -Dtest=EvidenciaHuerfanaBarridoJobTest` | Task 4.1 (sweep with grace 0) | Revert unit-2 commit: removes job + repository query; unit 1 stays functional |
| 3 | Wiring (compose, YAML) + admin labels | PR 3 | `npm test -- domain-ui.actividad` + `npm run build` (in `ts_hornero_admin`) | `make up-local` boot check (task 4.1) | Revert unit-3 commit: S3 vars disappear, MS falls back to no-op; labels revert |
| 4 | Docs + P2 tracking update | PR 3 | N/A (docs only; structural readback) | N/A, no runtime behavior | Revert docs commit independently |

## Phase 1: Deletion core and anonymization hook (unit 1)

Strict TDD. All MS tests use the in-memory fake.

- [ ] 1.1 `jar_hornero_ms/pom.xml`: add `<aws.sdk.version>` (latest 2.x >= 2.30.0), import `software.amazon.awssdk:bom` in `dependencyManagement`; add `software.amazon.awssdk:s3` excluding `netty-nio-client` and `apache-client`, and `software.amazon.awssdk:url-connection-client`. Verify: `mvn dependency:tree` shows no Netty/Apache HTTP client (closes the open question).
- [ ] 1.2 Create `jar_hornero_ms/src/main/java/org/example/reclamo/ClaveEvidenciaReclamo.java` (`PREFIJO`, `PATRON`, `referenteId(key)`) and switch `jar_hornero_ms/src/main/java/org/example/reclamo/ReclamoService.java` to `ClaveEvidenciaReclamo.PATRON` (no behavior change). Verify: existing `ReclamoService` tests stay green.
- [ ] 1.3 Create `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaAlmacen.java` (port + `ObjetoAlmacenado` + `ResultadoBorrado` records) and `EvidenciaReclamoLiberadaEvento.java` (record, `List.copyOf`).
- [ ] 1.4 Create test fake `jar_hornero_ms/src/test/java/org/example/evidencia/EvidenciaAlmacenEnMemoria.java` (`Map<String, Instant>`, forced-failure flag, prefix guard like the real adapter).
- [ ] 1.5 Add `EVIDENCIA_RECLAMO_BORRADA` and `EVIDENCIA_HUERFANA_BORRADA` to `jar_hornero_ms/src/main/java/org/example/actividad/TipoActividad.java` (System housekeeping group).
- [ ] 1.6 RED: create `jar_hornero_ms/src/test/java/org/example/evidencia/EvidenciaBorradoListenerTest.java` with two tests (spec "Referenced and stray objects are deleted after commit", "Count-only record", "Storage error after commit"): (a) 2 captured + 1 stray key of user X deleted, user Y and `org-evidencia/` key untouched, one EXITO actividad via `registrarAislado` with count 3 and no key/path fragment in detalle; (b) store throws -> nothing propagates, one FALLO actividad. Executor `Runnable::run`, `ActividadService` mock with `Registro` captor. Run `mvn test -Dtest=EvidenciaBorradoListenerTest` and observe failure.
- [ ] 1.7 GREEN: create `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaBorradoListener.java` (`@TransactionalEventListener(AFTER_COMMIT)`, no `fallbackExecution`; list, filter by `referenteId == userId`, union with captured keys, `borrar`, actividad formats from the design table; swallow `TaskRejectedException`/`RuntimeException` on submit). Test passes.
- [ ] 1.8 RED: in `jar_hornero_ms/src/test/java/org/example/user/UsuarioAnonimizacionServiceTest.java` add one test with a mock `ApplicationEventPublisher`: anonymizing a `Referente` with claims publishes `EvidenciaReclamoLiberadaEvento` whose keys equal the evidence keys captured before clearing. Adapt the constructor/mocks as needed. Observe failure.
- [ ] 1.9 GREEN: modify `jar_hornero_ms/src/main/java/org/example/user/UsuarioAnonimizacionService.java` (inject `ApplicationEventPublisher`, copy keys before `ReclamoOrganizacion::anonimizar`, publish only for `Referente`); update the `anonimizar` Javadoc in `jar_hornero_ms/src/main/java/org/example/domain/ReclamoOrganizacion.java`. Test passes.
- [ ] 1.10 Create `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaAlmacenNoOp.java` and `EvidenciaAlmacenS3.java` (path style, region `auto`, `UrlConnectionHttpClient`, `WHEN_REQUIRED` checksums, `listObjectsV2Paginator`, 1000-key `DeleteObjects` batches with `quiet(true)`, `IllegalArgumentException` for keys outside `reclamo-evidencia/`, empty collection returns `VACIO`, `close()`). No unit test by design (verified manually in 4.1).
- [ ] 1.11 Create `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaAlmacenConfig.java`: factory `@Bean` (blank endpoint/bucket/key/secret -> no-op + one startup WARN; else S3 adapter) and `evidenciaExecutor` (core 1, max 1, queue 50, daemon, prefix `evidencia-`; same-thread when `app.evidencia.async=false`). Add `app.evidencia.*` block to `jar_hornero_ms/src/main/resources/application.yml` (property names per design) and `app.evidencia.async: false` to `jar_hornero_ms/src/test/resources/application.yml`.
- [ ] 1.12 Verify: full `mvn test` in `jar_hornero_ms` (boots with no S3 config via no-op; covers spec "S3 not configured" through the existing `UsuarioAnonimizacionIntegrationTest`); then confirm `AFTER_COMMIT` annotation present (rollback scenario relies on it, no dedicated test).
- [ ] 1.13 Commit (unit 1): `feat(evidencia): delete claim evidence objects after user anonymization`.

## Phase 2: Nightly orphan sweep (unit 2)

- [ ] 2.1 RED: create `jar_hornero_ms/src/test/java/org/example/evidencia/EvidenciaHuerfanaBarridoJobTest.java` with `Clock.fixed` and a repository mock: (a) old unreferenced key deleted while old referenced, recent unreferenced, non-pattern key under `reclamo-evidencia/`, and old unreferenced `org-evidencia/`/`org-banner/` keys stay, and summary actividad recorded (spec scenarios "Deletes only unreferenced and old keys", "Other prefixes ... never touched"); (b) 600 eligible with cap 500 -> exactly 500 deleted; (c) 0 eligible -> no actividad; (d) disabled -> no listing and no deletion (assert fake `listar` not called). Observe failure.
- [ ] 2.2 Add `findAllEvidenciaKeys()` (`select k from ReclamoOrganizacion r join r.evidenciaKeys k`) to `jar_hornero_ms/src/main/java/org/example/domain/ReclamoOrganizacionRepository.java`.
- [ ] 2.3 GREEN: create `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaHuerfanaBarridoJob.java` following `CoordenadasMinimizacionJob` (cron `${app.evidencia.barrido.cron:0 50 3 * * *}` zone `America/Argentina/Buenos_Aires`, `ApplicationReadyEvent` catch-up, injected `Clock`, no `@Transactional`; algorithm and `@Value` defaults per design; sort by age then key; WARN on failures; summary actividad only if deleted > 0). Run `mvn test -Dtest=EvidenciaHuerfanaBarridoJobTest`, then full `mvn test`.
- [ ] 2.4 Commit (unit 2): `feat(evidencia): add nightly sweep for orphaned claim evidence`.

## Phase 3: Wiring and admin labels (unit 3)

- [ ] 3.1 RED: add the two new types to `MS_TIPOS` in `ts_hornero_admin/src/lib/domain-ui.actividad.test.ts`; run `npm test -- domain-ui.actividad` in `ts_hornero_admin` and observe failure.
- [ ] 3.2 GREEN: add labels `'Evidencia de reclamos borrada'` and `'Evidencia huérfana borrada (automático)'` in `ts_hornero_admin/src/lib/domain-ui.ts`. Run `npm test` and `npm run build` (tsc -b catches what vitest does not).
- [ ] 3.3 Modify `docker-compose.yml`: add the `ms` environment block from the design (5 `AWS_*` lines with bff defaults, 4 `EVIDENCIA_BARRIDO_*` lines). Do not touch `.env*` files.
- [ ] 3.4 Update the Object storage section of `CLAUDE.md`: the MS now deletes claim evidence (`reclamo-evidencia/` only).
- [ ] 3.5 Commit (unit 3): `feat(evidencia): wire object storage into ms and label new actividad types`.

## Phase 4: Manual verification and docs (unit 4)

- [ ] 4.1 Manual S3 adapter check against local MinIO: `make up-local`; as a referente create a claim with evidence; confirm objects with `mc ls`; add one stray object under `reclamo-evidencia/{org}/{userId}/`; anonymize the user as ADMINISTRADOR; confirm all objects gone, other prefixes intact, and a count-only actividad in the log (no keys). Then restart `ms` with `EVIDENCIA_BARRIDO_GRACIA_DIAS=0` and an unreferenced uploaded object; confirm the startup sweep deletes only it. Confirm pagination/`DeleteObjects` checksum behavior works (no checksum errors in `ms` logs). Record observations in the commit body or the feature notes.
- [ ] 4.2 Run `make e2e` once against the running `make up-local` stack; record the result.
- [ ] 4.3 Update `docs/politica-datos-y-respaldo.md` §1.6: move the evidence item out of "out of scope", describe post-anonymization deletion and the nightly sweep (7-day grace, cap 500), add a retention row.
- [ ] 4.4 Update `docs/registro-actividades.md`: document `EVIDENCIA_RECLAMO_BORRADA` and `EVIDENCIA_HUERFANA_BORRADA` (system actor, counts only).
- [ ] 4.5 Update `docs/deploy-rpi-cloudflare.md`: restore note (set `EVIDENCIA_BARRIDO_ENABLED=false` before starting `ms` on a restored DB until reconciled; R2 tokens are per bucket so a separate MS token only separates revocation).
- [ ] 4.6 Update `docs/acciones-pendientes-equipo.md`: user action = add `EVIDENCIA_BARRIDO_*` vars to `.env.example` (agent does not edit it); team decision = retention of evidence for decided claims of non-anonymized users.
- [ ] 4.7 Update `odd/tasks/seguridad-calidad.md` P2: check it off with commit references and the verification evidence from 4.1 and 4.2.
- [ ] 4.8 Commit (unit 4): `docs(evidencia): document claim evidence deletion and close P2`.
