# Tasks: Acreditación Progresiva

Spec: `openspec/changes/acreditacion-progresiva/specs/` (6 files). Design: `openspec/changes/acreditacion-progresiva/design.md`.
`strict_tdd: true` (`openspec/config.yaml`). Every production task has a RED task before it, per component's own
test runner — there is no root aggregate command.

## Naming conflict to resolve before Phase 1 (spec wins)

`design.md`'s "Data Model" table and `specs/organizacion-evento-log/spec.md`'s "Event Taxonomy" requirement name
two constants differently: design says `EVIDENCIA_CARGADA`, `NIVEL_SUBIDO`, `NIVEL_BAJADO`; spec says
`EVIDENCIA_ADJUNTADA`, `NIVEL_ELEVADO`, `NIVEL_REDUCIDO`. The design document states at its top that "Requirement
wording is owned by `sdd-spec`; this document owns the mechanism" — spec constant names are therefore authoritative.
Task 1.4 below uses the spec's names (`EVIDENCIA_ADJUNTADA`, `NIVEL_ELEVADO`, `NIVEL_REDUCIDO`) and additionally
includes `MIGRACION_INICIAL` and `REGISTRO_RECHAZADO`, which the spec's taxonomy requirement says covers "at least"
the listed set — design's two backfill-only types are additive, not conflicting.

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Slice A ≈ 2,800–3,600 (A1 ≈ 700–900, A2 ≈ 1,200–1,500, A3 ≈ 300–400, A4 ≈ 600–800); Slice B ≈ 500–700, deferred |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (A1) → PR 2 (A2) → PR 3 (A3) → PR 4 (A4); Slice B is a separate later PR pair, not counted against this budget now |
| Delivery strategy | auto-chain (session preflight 2026-09-21) |
| Chain strategy | feature-branch-chain (resolved 2026-09-21) |

Decision needed before apply: Resolved 2026-09-21 — split into chained work units
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**Resolution (2026-09-21, user):** path 2 was chosen — split Slice A into four chained work units A1 -> A2 -> A3 -> A4, each an independently reviewable commit on the tracker branch `feat/acreditacion-trazabilidad`. No `size:exception` is recorded. Repository policy for this project forbids opening pull requests and pushing, so the chain is realised as stacked work-unit commits on the tracker branch; merging to `main` stays a later human decision. Commit messages follow Conventional Commits with no author or co-author trailer.

Original conflict, kept for the record:

**Conflict for the orchestrator to raise with the user before `sdd-apply`:** the cached delivery strategy is
`single-pr`, which per the review-workload guard requires an explicit `size:exception` before apply. The design
document independently states Slice A alone is well over the 400-line budget and names the same four work-unit
boundaries used below (A1–A4). Two honest paths exist and the user must pick one before implementation starts:

1. Accept `size:exception` for one oversized Slice-A PR (against the design's own recommendation), or
2. Switch delivery strategy to `stacked-to-main` or `feature-branch-chain` and ship PR 1 → PR 2 → PR 3 → PR 4 as
   below, each independently reviewable.

Slice B (Phase 5–6) is deferred past the thesis-document task per the user's sequencing decision and is not part of
this forecast's immediate risk — its own forecast should be redone when it is scheduled.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A1 | MS domain enums, event entity/repository, replay fold, backfill runner | PR 1 | `mvn test -Dtest=AcreditacionReplayTest,AcreditacionBackfillTest` | `mvn spring-boot:run` then boot log shows backfill pass over seeded rows | Revert `jar_hornero_ms/src/main/java/.../domain/{NivelAcreditacion,TipoEventoOrganizacion,OrganizacionEvento,OrganizacionEventoRepository}.java`, `acreditacion/AcreditacionReplay.java`, `config/AcreditacionBackfill.java`, and the `nivel` column addition on `Organizacion.java`; no other file depends on these yet |
| A2 | MS evidence entity, `AcreditacionService`, controller, DTOs, `SecurityConfig` matchers, legacy-flow delegation | PR 2 | `mvn test -Dtest=AcreditacionServiceTest,AcreditacionControllerSecurityTest` | `curl -i http://localhost:8081/api/organizaciones/1/legajo` with/without a bearer token, confirm 401/200 | Revert `acreditacion/` package additions, `config/SecurityConfig.java` matcher block, and the `OrganizacionService.java`/`OrganizacionResponse.java`/`NecesidadService.java` edits; A1 stays intact and unused by anything else |
| A3 | BFF proxy module + images deny-list | PR 3 | `npm test -- acreditacion` (from `ts_hornero_bff/`) | `curl -i --cookie "access_token=<jwt>" http://localhost:3001/organizaciones/1/acreditacion` | Revert `ts_hornero_bff/src/acreditacion/`, the `app.module.ts` import, and the `images.controller.ts` deny-list line; MS endpoints stay reachable directly for manual testing |
| A4 | Admin SPA hooks, components, routes | PR 4 | `npm test -- Acreditacion` then `npm run build` (from `ts_hornero_admin/`) | manual: log in as REFERENTE, submit a `DECLARACION`, log in as ADMINISTRADOR, approve it, raise the level, open `/organizaciones/:id/legajo`, print-preview | Revert `ts_hornero_admin/src/components/acreditacion/`, `routes/acreditacion.tsx`, `routes/legajo.tsx`, and the two route registrations in `app/router.tsx`/`routes/admin.tsx`; BFF/MS stay functional without a UI |
| B1 (deferred) | `CategoriaAlimento` + `Necesidad.categoria` + worker filter | PR 5 (after thesis task) | `mvn test -Dtest=NecesidadServiceTest` and `go test ./internal/assign/...` | manual: create a `necesidad` with `categoria=REFRIGERADO` from an N1 org, expect rejection | Revert `CategoriaAlimento.java`, `Necesidad.categoria`, worker `CategoriasPermitidas` field; A1–A4 unaffected (worker `scoring.go` change is additive and gated by empty-set no-op) |
| B2 (deferred) | Authenticated evidence-file route + photo upload | PR 6 (after thesis task) | `npm test -- evidencia-files` | manual: upload a photo as REFERENTE, fetch it as the owning REFERENTE and as ADMIN, confirm 403 for a non-owning REFERENTE | Revert `ts_hornero_bff/src/evidencia-files/`, `upload.service.ts`/`upload.controller.ts` additions, and `EvidenciaForm.tsx` photo-attach change; the Slice-A pre-commitment deny-list (A3) keeps blocking `org-evidencia/` reads if this PR is rolled back mid-flight |

---

## Phase 1 (A1): MS domain, event log, ladder, backfill — `jar_hornero_ms`

Ordered dependency: enums → entity/repository → replay → transition table → Organizacion column → backfill.

- [x] 1.1 Freeze `RequisitoAcreditacion`'s 8 constant names and verbatim source quotes from
      `specs/organizacion-acreditacion/spec.md` ("Requirement Catalogue" table) before writing any test that
      references them. No code change; this is a read-and-confirm gate so 1.4/1.9 don't reference wording that
      later changes underneath them.
- [x] 1.2 RED: create `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionReplayTest.java` —
      table-driven cases: empty list → `N0`; single `NIVEL_ELEVADO` event `N0→N1` → `N1`; a full
      `N0→N1→N2→N3→N2` sequence → `N2`; events with `nivelDespues = null` (e.g. `EVIDENCIA_ADJUNTADA`) are skipped
      in the fold. Run `mvn test -Dtest=AcreditacionReplayTest` — expect a compile failure (referenced types don't
      exist yet).
- [x] 1.3 GREEN: create `jar_hornero_ms/src/main/java/org/example/domain/NivelAcreditacion.java` (`N0, N1, N2, N3`
      with `REGISTRADA`/`IDENTIFICADA`/`OPERATIVA`/`ACREDITADA` display labels per
      `specs/organizacion-acreditacion/spec.md`) and `acreditacion/AcreditacionReplay.java` (pure static
      `reconstruir(List<OrganizacionEvento>) -> NivelAcreditacion`, no Spring, no repository — per AD-3). Run
      `mvn test -Dtest=AcreditacionReplayTest` — expect pass.
- [x] 1.4 Create the remaining domain enums (no RED needed — pure vocabulary, verified by 1.2/1.9 referencing
      them): `domain/RequisitoAcreditacion.java` (8 constants + `nivelExigido`, verbatim quotes per 1.1),
      `domain/TipoEventoOrganizacion.java` (`MIGRACION_INICIAL, ORGANIZACION_REGISTRADA, REGISTRO_RECHAZADO,
      EVIDENCIA_ADJUNTADA, EVIDENCIA_REEMPLAZADA, REQUISITO_APROBADO, REQUISITO_OBSERVADO, NIVEL_ELEVADO,
      NIVEL_REDUCIDO, REFERENTE_REASIGNADO` — spec names per the naming-conflict note above), `domain/
      TipoEvidencia.java` (`DECLARACION, FOTO, DOCUMENTO`), `domain/EstadoEvidencia.java` (`PENDIENTE, APROBADA,
      OBSERVADA, REEMPLAZADA`).
- [x] 1.5 RED: extend `AcreditacionReplayTest` (or a new `OrganizacionEventoRepositoryTest`) asserting
      `OrganizacionEventoRepository` exposes no `delete`/`deleteAll`/`saveAndFlush`/derived-update method — a
      reflection test over `Repository.class.getMethods()` plus the declared interface methods. Run `mvn test
      -Dtest=OrganizacionEventoRepositoryTest` — expect compile failure.
- [x] 1.6 GREEN: create `domain/OrganizacionEvento.java` (append-only entity: no `@Setter`, `@Getter` +
      `@NoArgsConstructor(access = PROTECTED)`, static factory `OrganizacionEvento.de(org, tipo, actor, motivo,
      antes, despues)`, `@Index(name = "idx_evento_org_ocurrido", columnList = "organizacion_id, ocurrido_en")` on
      `@Table`) and `domain/OrganizacionEventoRepository.java` (`extends Repository<OrganizacionEvento, Long>` —
      **not** `JpaRepository`; declares only `save`, `findByOrganizacion_IdOrderByOcurridoEnAscIdAsc`,
      `findByOrganizacion_IdAndTipoIn`, per AD-3). Run `mvn test -Dtest=OrganizacionEventoRepositoryTest` — expect
      pass.
- [x] 1.7 RED: create `config/CanonicalJsonConfigTest.java` asserting the `canonicalObjectMapper` bean serializes a
      map with out-of-order keys into alphabetically-sorted JSON text, and that two semantically-equal maps
      produce byte-identical output. Run `mvn test -Dtest=CanonicalJsonConfigTest` — expect compile failure.
- [x] 1.8 GREEN: create `config/CanonicalJsonConfig.java` — `@Bean canonicalObjectMapper` with
      `SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS` and `MapperFeature.SORT_PROPERTIES_ALPHABETICALLY` (AD-5).
      Run `mvn test -Dtest=CanonicalJsonConfigTest` — expect pass.
- [x] 1.9 RED: create `acreditacion/AcreditacionServiceTransitionTest.java` — `@ParameterizedTest` over every
      legal edge (`N0→N1`, `N1→N0`, `N1→N2`, `N2→N1`, `N2→N3`, `N3→N2`) asserting success, and every illegal edge
      including skips (`N0→N2`, `N0→N3`, `N1→N3`, `N2→N0`, `N3→N0`, `N3→N1`) asserting `ResponseStatusException`
      with `BAD_REQUEST` and message `"Invalid state transition: X -> Y"` (mirrors `DonacionService.java:36-46`,
      `245-251`, per AD-2). Run `mvn test -Dtest=AcreditacionServiceTransitionTest` — expect compile failure.
- [x] 1.10 GREEN: create `acreditacion/AcreditacionService.java` with `static final Map<NivelAcreditacion,
      Set<NivelAcreditacion>> TRANSICIONES_PERMITIDAS` (`EnumMap`/`EnumSet`) and private `validateTransition(
      NivelAcreditacion actual, NivelAcreditacion siguiente)` per AD-2's table. Do not yet add
      `cambiarNivel`/evidence methods — those depend on `OrganizacionEvidencia`, added in Phase 2. Run `mvn test
      -Dtest=AcreditacionServiceTransitionTest` — expect pass.
- [x] 1.11 RED: create `acreditacion/AcreditacionServiceProjectionTest.java` — direct calls to a package-private
      `proyectarEstadoLegacy(Organizacion)`: `N0` → `estado=PENDIENTE, validada=false`; `N1..N3` → `estado=
      APROBADA, validada=true`; an org already `RECHAZADA` stays `RECHAZADA` regardless of `nivel` (AD-6). Also
      assert `nivelActual(org)` null-coalesces to `N0`. Run `mvn test
      -Dtest=AcreditacionServiceProjectionTest` — expect compile failure (methods don't exist).
- [x] 1.12 GREEN: add `private void proyectarEstadoLegacy(Organizacion org)` and `private NivelAcreditacion
      nivelActual(Organizacion org)` to `AcreditacionService.java` exactly per AD-6's snippet. Run `mvn test
      -Dtest=AcreditacionServiceProjectionTest` — expect pass.
- [x] 1.13 RED: create `acreditacion/AcreditacionServiceAplicarTransicionTest.java` (`@DataJpaTest`) —
      `aplicarTransicion` writes `org.nivel`, calls `proyectarEstadoLegacy`, and appends exactly one
      `OrganizacionEvento` in the same call; a forced exception after the `nivel` write (e.g. throwing inside a
      test double before `eventoRepository.save`) leaves neither the level nor the event persisted when the
      surrounding `@Transactional` rolls back. Run `mvn test
      -Dtest=AcreditacionServiceAplicarTransicionTest` — expect compile failure.
- [x] 1.14 GREEN: add `private void aplicarTransicion(Organizacion org, NivelAcreditacion destino, Administrador
      actor, String motivo, TipoEventoOrganizacion tipo)` to `AcreditacionService.java`, the single writer of
      `nivel`, exactly per AD-3's snippet (`OrganizacionEventoRepository` injected). Run `mvn test
      -Dtest=AcreditacionServiceAplicarTransicionTest` — expect pass.
- [x] 1.15 **[breakage risk — replay invariant depends on this]** RED: create
      `acreditacion/AcreditacionBackfillTest.java` (`@SpringBootTest` + H2) — seed rows with `estado=APROBADA`,
      `PENDIENTE`, `RECHAZADA`, and `nivel=null`; run the `ApplicationRunner`; assert: `APROBADA`→`nivel=N1` +
      one `MIGRACION_INICIAL` event (`nivelAntes=N0, nivelDespues=N1`); `PENDIENTE`→`nivel=N0` + one
      `MIGRACION_INICIAL` event (`N0→N0`); `RECHAZADA`→`nivel=N0` + `MIGRACION_INICIAL` **and**
      `REGISTRO_RECHAZADO` events; running the runner a second time over the same rows appends **zero** new
      events and changes **zero** `nivel` values (guarded by `WHERE nivel IS NULL`). Run `mvn test
      -Dtest=AcreditacionBackfillTest` — expect compile failure.
- [x] 1.16 **[breakage risk]** GREEN: create `config/AcreditacionBackfill.java` — `@Component implements
      ApplicationRunner`, same lifecycle hook as `DataInitializer`, per AD-7's table. Every seeded row MUST write
      a `MIGRACION_INICIAL` genesis event, or task 1.2's replay-equals-stored invariant is false for every
      pre-existing row — this is the single highest-risk correctness gap the design calls out for this phase. Run
      `mvn test -Dtest=AcreditacionBackfillTest` — expect pass.
- [x] 1.17 Modify `domain/Organizacion.java`: add the `nivel` column per the exact snippet in design's "Data
      Model" section (`@Enumerated(EnumType.STRING)`, `nullable = true`, Java-defaulted `NivelAcreditacion.N0`,
      with the D8 comment referencing D4 at `Organizacion.java:67-70`). No RED needed — this is the additive
      column A1's other tests already assume exists; run the full A1 test class list once more (`mvn test
      -Dtest=AcreditacionReplayTest,OrganizacionEventoRepositoryTest,CanonicalJsonConfigTest,
      AcreditacionServiceTransitionTest,AcreditacionServiceProjectionTest,
      AcreditacionServiceAplicarTransicionTest,AcreditacionBackfillTest`) to confirm nothing regressed.

**Phase 1 acceptance criterion**: `mvn test` passes for every class listed above; `AcreditacionReplay.reconstruir`
matches stored `nivel` for the backfill-seeded rows; `OrganizacionEventoRepository` has no update/delete method.

---

## Phase 2 (A2): MS evidence, legajo, `SecurityConfig` — `jar_hornero_ms`

Depends on Phase 1 (`AcreditacionService`, `NivelAcreditacion`, `OrganizacionEvento*`). Ordered: evidence
entity/repository → evidence submit/audit → requisito-completeness gate on `cambiarNivel` → controller → DTOs →
`SecurityConfig` (breakage risk) → legacy-flow delegation → concurrency cap → legajo assembly.

- [ ] 2.1 RED: create `domain/OrganizacionEvidenciaRepositoryTest.java` (`@DataJpaTest`) asserting
      `findByOrganizacion_Id` and `findByOrganizacion_IdAndRequisitoAndEstadoNot` return expected rows and that no
      delete method exists on the repository interface (evidence rows are also never hard-deleted — only their
      `estado` field mutates). Run `mvn test -Dtest=OrganizacionEvidenciaRepositoryTest` — expect compile failure.
- [ ] 2.2 GREEN: create `domain/OrganizacionEvidencia.java` (only `estado`/`revisadoPor`/`revisadoEn`/
      `observacion` mutable; `objectKey`, `declaracion`, validity window never rewritten in place, per
      `specs/organizacion-evidencia/spec.md` "Replacement Never Overwrites History") and
      `domain/OrganizacionEvidenciaRepository.java` (save + the two finders above). Run `mvn test
      -Dtest=OrganizacionEvidenciaRepositoryTest` — expect pass.
- [ ] 2.3 RED: create `acreditacion/AcreditacionServiceEvidenciaTest.java` — submitting evidence for a requisito
      with an existing `APROBADA` row inserts a new `PENDIENTE` row, marks the prior row `REEMPLAZADA` (content
      unchanged), and appends `EVIDENCIA_ADJUNTADA` + `EVIDENCIA_REEMPLAZADA`; a referente attempting to set
      `estado=APROBADA` directly on their own submission is rejected (`specs/organizacion-evidencia/spec.md`,
      "Referente cannot self-approve"); an admin approving a `PENDIENTE` row sets `revisadoPor`/`revisadoEn` and
      appends `REQUISITO_APROBADO`; an admin observing with a reason sets `estado=OBSERVADA` and the reason lands
      on the accompanying event's `motivo`, not just the evidencia row. Run `mvn test
      -Dtest=AcreditacionServiceEvidenciaTest` — expect compile failure.
- [ ] 2.4 GREEN: add `cargarEvidencia(...)`, `aprobarEvidencia(...)`, `observarEvidencia(...)` to
      `AcreditacionService.java` per the "Evidence submission → audit" data-flow sequence in design (each its own
      `@Transactional` unit). Run `mvn test -Dtest=AcreditacionServiceEvidenciaTest` — expect pass.
- [ ] 2.5 RED: extend expiry-derivation coverage in `acreditacion/AcreditacionServiceEvidenciaTest.java` (or a
      sibling `ExpiracionTest`): `validoHasta=null` → `expirada=false`; `validoHasta` in the past → `expirada=
      true`; `validoHasta=today` → `expirada=false`; an `APROBADA`-but-expired evidencia does not change `nivel`
      on read and is not touched by any scheduled process (there is none — assert no `@Scheduled` method exists
      in the package). Run the class — expect the new assertions to fail (method not yet returning derived value
      where expected, or field not exposed).
- [ ] 2.6 GREEN: expose `expirada` as a derived-on-read value (computed in the DTO mapping step, not persisted)
      per AD-9/`specs/organizacion-evidencia/spec.md` "Record-and-Warn Expiry". Run the same test class — expect
      pass.
- [ ] 2.7 RED: create `acreditacion/AcreditacionServiceCambiarNivelTest.java` — raising to `N2` with every N1+N2
      requisito `APROBADA` and non-expired succeeds and appends `NIVEL_ELEVADO`; raising with one requisito still
      `PENDIENTE` → `409`, no `nivel` change, no event; raising with an `APROBADA` but `expirada=true` requisito →
      `409` (AD-9); lowering with a blank `motivo` → `400`; lowering with a non-blank `motivo` succeeds and
      appends `NIVEL_REDUCIDO` carrying that reason. Run `mvn test
      -Dtest=AcreditacionServiceCambiarNivelTest` — expect compile failure.
- [ ] 2.8 GREEN: add `cambiarNivel(orgId, destino, motivo, actor)` to `AcreditacionService.java` — calls
      `validateTransition`, then `requisitosCompletos(org, destino)` (every `RequisitoAcreditacion` with
      `nivelExigido <= destino` has a non-expired `APROBADA` evidencia) before `aplicarTransicion`, per AD-9. Run
      `mvn test -Dtest=AcreditacionServiceCambiarNivelTest` — expect pass.
- [ ] 2.9 RED: create `acreditacion/AcreditacionServiceLegajoTest.java` — assembling a legajo for an `N1` org
      lists all 8 `RequisitoAcreditacion` entries, with N2/N3-only requisitos showing `FALTANTE`; an
      `OBSERVADA` requisito shows `OBSERVADA` (not `PENDIENTE`/`FALTANTE`); `VIGENTE`/`VENCIDA` flags match
      `validoHasta` per requisito; the disclosure string is present and identical regardless of level; events
      appear in chronological order. Run `mvn test -Dtest=AcreditacionServiceLegajoTest` — expect compile
      failure.
- [ ] 2.10 GREEN: add `legajo(orgId) -> LegajoResponse` to `AcreditacionService.java` per the `LegajoAssembler`
      shape in design's "Legajo export" data flow and the `LegajoResponse`/`RequisitoEnLegajo` records in
      "Interfaces / Contracts". Run `mvn test -Dtest=AcreditacionServiceLegajoTest` — expect pass.
- [ ] 2.11 Create `acreditacion/dto/*.java`: `CargarEvidenciaRequest` (`objectKey` MUST be accepted as a field but
      **rejected with 400 if non-null in Slice A** — see task 2.14), `AuditarEvidenciaRequest`,
      `CambiarNivelRequest`, `AcreditacionResponse`, `EvidenciaResponse`, `EventoResponse`, `LegajoResponse`, per
      the exact record shapes in design's "DTO shapes" section. No RED — these are plain records exercised by the
      controller security test below.
- [ ] 2.12 RED: create `acreditacion/AcreditacionControllerSecurityTest.java` (`@WebMvcTest` +
      `spring-security-test`, full filter chain) — anonymous `GET /api/organizaciones/{id}/legajo` → `401`;
      DONANTE → `403`; ADMINISTRADOR → `200`; same three assertions for `GET /api/organizaciones/{id}/
      acreditacion`; a non-owning REFERENTE posting evidence → `403` (per the Threat Matrix's first three rows).
      Run `mvn test -Dtest=AcreditacionControllerSecurityTest` — expect **both** a compile failure (controller
      doesn't exist) **and**, once the controller exists without the matcher, a false-`200` on the anonymous case
      demonstrating the `permitAll` leak the design's AD-8 warns about.
- [ ] 2.13 **[breakage risk — highest severity in this change, per AD-8]** GREEN, in this exact order:
      1. Modify `config/SecurityConfig.java`: add
         `.requestMatchers(HttpMethod.GET, "/api/organizaciones/*/acreditacion",
         "/api/organizaciones/*/acreditacion/**", "/api/organizaciones/*/legajo").authenticated()`
         **declared before** the existing `permitAll()` block for `GET /api/organizaciones/**`
         (`SecurityConfig.java:50-56`), following the in-repo `/api/donaciones/activas` precedent at
         `SecurityConfig.java:42-48`. Spring evaluates matchers in declaration order — placement after
         `permitAll` would silently pass the security test's `401` assertion into a `200` leak invisible in code
         review unless the test itself checks matcher order, which 2.12 does.
      2. Create `acreditacion/AcreditacionController.java` with the six endpoints from design's "Interfaces /
         Contracts" table, each carrying `@PreAuthorize` as defense in depth (matcher order is the real
         authority; `@PreAuthorize` does not run before the filter chain grants access).
      Run `mvn test -Dtest=AcreditacionControllerSecurityTest` — expect pass, and confirm by temporarily reverting
      only the matcher-order change that the anonymous-`GET`-returns-401 assertion fails, then re-apply it.
- [ ] 2.14 RED: extend `AcreditacionControllerSecurityTest.java` (or a sibling validation test) — `POST
      .../evidencias` with `CargarEvidenciaRequest.objectKey` non-null → `400` (Slice A evidence-key-smuggling
      guard, Threat Matrix row 5). Run — expect compile failure/false pass depending on stub state.
- [ ] 2.15 GREEN: add the `objectKey`-non-null-rejects-400 validation to `AcreditacionController.java` (Bean
      Validation custom check or explicit guard in the handler). Run `mvn test
      -Dtest=AcreditacionControllerSecurityTest` — expect pass.
- [ ] 2.16 RED: create `organizacion/OrganizacionServiceValidarRechazarTest.java` (or extend the existing
      `OrganizacionServiceTest` if present) — `validar()` on a `PENDIENTE` org yields `nivel=N1` **and**
      `estado=APROBADA` **and** one event (back-compat regression); `findBySlugPublic` still 404s for `N0` and
      200s for `N1+`. Run — expect failure (current `validar()`/`rechazar()` don't touch `nivel`/events).
- [ ] 2.17 **[breakage risk — positional constructor]** GREEN, in this exact order:
      1. Modify `organizacion/dto/OrganizacionResponse.java`: add `nivel` as an additive field.
      2. Modify `organizacion/OrganizacionService.java`: update the positional constructor call at
         `OrganizacionService.java:334-358` to supply the new `nivel` argument — this call site breaks at compile
         time the moment `OrganizacionResponse` gains a field, and the failure is a compiler error, not a test
         failure, so it must be fixed in the same commit as 2.17.1, not deferred.
      3. Rewrite `validar()`/`rechazar()` (`OrganizacionService.java:85-122`) to delegate to
         `AcreditacionService.cambiarNivel`/an equivalent internal call so the two paths cannot disagree (AD-6).
      Run `mvn test -Dtest=OrganizacionServiceValidarRechazarTest` — expect pass; run `mvn compile` first to
      confirm the constructor call site compiles before running tests.
- [ ] 2.18 RED: extend `organizacion/OrganizacionServiceAsignarReferenteTest.java` (or create it) —
      `asignarReferente` appends `REFERENTE_REASIGNADO` and leaves `nivel`, `estado`, `validada` byte-identical
      before/after (per `specs/organizacion-evento-log/spec.md` "Reassignment Is a Logged Non-Accreditation
      Event" and the `referente-organizacion-assignment` delta's regression scenario). Run — expect failure.
- [ ] 2.19 GREEN: add exactly one line to `asignarReferente` (`OrganizacionService.java:148-182`) — the event
      append — leaving its existing 3-organizacion cap check and `null`-unassign branch unchanged. Run the same
      test — expect pass.
- [ ] 2.20 RED: create `organizacion/OrganizacionServiceCrearEventoTest.java` — `crear()`
      (`OrganizacionService.java:38-71`) appends `ORGANIZACION_REGISTRADA` with `nivelAntes=null,
      nivelDespues=N0` (per `specs/organizacion-evento-log/spec.md` "Registration emits its event"). Run —
      expect failure.
- [ ] 2.21 GREEN: add the event append to `crear()`. Run the same test — expect pass.
- [ ] 2.22 RED: create `necesidad/NecesidadServiceConcurrencyCapTest.java` — creating a necesidad beyond the
      level cap → `409`; at cap−1 → `201`; `N0` → `409` on the first attempt; closing a necesidad frees cap room;
      overriding the N2 cap via configuration takes effect with no code change (`specs/organizacion-acreditacion/
      spec.md` "Level-Driven Concurrency Caps"). Run `mvn test
      -Dtest=NecesidadServiceConcurrencyCapTest` — expect compile failure.
- [ ] 2.23 GREEN: add `long countByOrganizacion_IdAndEstadoIn(Long, Collection<EstadoNecesidad>)` to
      `domain/NecesidadRepository.java`; add the cap check to `NecesidadService.crear` (30-48); create
      `config/AcreditacionProperties.java` (`@Value("${app.acreditacion.cap-n1:3}")` etc., per the `app.otp.*`
      precedent at `OtpService.java:38-41`); add `app.acreditacion.cap-n0=0, cap-n1=3, cap-n2=6, cap-n3=12` to
      `resources/application.properties`. Run `mvn test -Dtest=NecesidadServiceConcurrencyCapTest` — expect pass.
- [ ] 2.24 **Integration**: create `acreditacion/AcreditacionInvariantIT.java` (`@SpringBootTest` + H2) —
      **the change's headline invariant**: drive an organizacion through a full `N0→N1→N2→N3→N2` sequence via
      the real service methods, then assert `AcreditacionReplay.reconstruir(eventoRepository.
      findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(org.getId())) == org.getNivel()`. Run `mvn test
      -Dtest=AcreditacionInvariantIT` — expect pass (RED state already covered by 1.2 + 2.7's GREEN steps; this
      task is the end-to-end assembly proof, not a new production change).

**Phase 2 acceptance criterion**: `mvn test` passes for every class above; the anonymous-`GET`-legajo-401 test
fails if the matcher-order change is reverted (verified once in 2.13); `OrganizacionServiceTest` (existing suite)
still passes unmodified outside the two touched methods.

---

## Phase 3 (A3): BFF proxy + images deny-list — `ts_hornero_bff`

Depends on Phase 2 (MS endpoints must exist to proxy against, though BFF tests mock `HttpService` so this can start
once Phase 2's DTO shapes are frozen).

- [ ] 3.1 RED: create `src/images/images.controller.spec.ts` (or extend existing) — Supertest:
      `GET /images?key=org-evidencia/1/x.jpg` → `403` (Slice A pre-commitment guard, Threat Matrix row 4). Run
      `npm test -- images.controller` — expect failure (current controller streams any key).
- [ ] 3.2 GREEN: modify `src/images/images.controller.ts` — reject any key beginning `org-evidencia/` with `403`
      before the existing stream logic. Run `npm test -- images.controller` — expect pass.
- [ ] 3.3 RED: create `src/acreditacion/acreditacion.service.spec.ts` — mocked `HttpService.axiosRef`: verifies
      the service forwards the `access_token` cookie as an `Authorization: Bearer` header to
      `${JAVA_MS_URL}/api/organizaciones/{id}/...`, mirroring the `NecesidadesService.crear` precedent. Run `npm
      test -- acreditacion.service` — expect compile failure (module doesn't exist).
- [ ] 3.4 GREEN: create `src/acreditacion/acreditacion.module.ts`, `acreditacion.service.ts` (thin `HttpService`
      proxy, no domain logic), and `dto/*.ts` (request DTOs with `class-validator`, mirroring the MS request
      shapes from 2.11). Run `npm test -- acreditacion.service` — expect pass.
- [ ] 3.5 RED: create `src/acreditacion/acreditacion.controller.spec.ts` — DTO validation rejects a blank
      `motivo` and an unknown `destino` on the `cambiarNivel` route; `@Roles(ADMINISTRADOR)` routes reject
      REFERENTE and DONANTE via `RolesGuard` (Threat Matrix "Role escalation" row, BFF layer). Run `npm test --
      acreditacion.controller` — expect compile failure.
- [ ] 3.6 GREEN: create `src/acreditacion/acreditacion.controller.ts` — `@Roles(...)` per route matching design's
      "Interfaces / Contracts" table, cookie→Bearer per the `OrganizacionesController` precedent
      (`organizaciones.controller.ts:29-33`). Modify `src/app.module.ts` to import `AcreditacionModule`. Run `npm
      test -- acreditacion.controller` — expect pass.
- [ ] 3.7 RED: create a BFF route-shadowing assertion (Threat Matrix "BFF route shadowing" row) — `GET
      /organizaciones/:slug` (`organizaciones.controller.ts:97-102`, single-segment) never intercepts the new
      two-segment `GET /organizaciones/:id/acreditacion` path. Run as an e2e/Supertest case — expect pass on
      first run if NestJS's most-specific-match already resolves it correctly; if it fails, this is a genuine
      routing conflict to fix before continuing, not a false RED to skip.
- [ ] 3.8 Run the full BFF suite: `npm test` from `ts_hornero_bff/`. Run `npm run lint`.

**Phase 3 acceptance criterion**: `npm test` passes; `npm run lint` passes; `GET /images?key=org-evidencia/...`
returns `403` with no auth header at all (unauthenticated request, per the spec's evidence-access requirement).

---

## Phase 4 (A4): Admin SPA — `ts_hornero_admin`

Depends on Phase 3 (hooks call the BFF routes). UI components can be scaffolded against a mocked `axios` before
Phase 3 lands, but final acceptance needs the real BFF contract frozen (DTOs from 2.11/3.4).

- [ ] 4.1 RED: create `src/lib/hooks/useAcreditacion.test.ts` (axios-mock-adapter) — `useAcreditacion`,
      `useCargarEvidencia`, `useAuditarEvidencia`, `useCambiarNivel`, `useLegajo` call the expected BFF routes and
      expose TanStack Query's loading/error/success states. Run `npm test -- useAcreditacion` — expect compile
      failure.
- [ ] 4.2 GREEN: create `src/lib/hooks/useAcreditacion.ts`. Run `npm test -- useAcreditacion` — expect pass.
- [ ] 4.3 RED: create `src/components/acreditacion/NivelBadge.test.tsx` — renders a distinguishable badge for
      each of `N0`–`N3`. Run `npm test -- NivelBadge` — expect compile failure.
- [ ] 4.4 GREEN: create `src/components/acreditacion/NivelBadge.tsx`, reusing `components/Badge.tsx`. Run `npm
      test -- NivelBadge` — expect pass.
- [ ] 4.5 RED: create `src/components/acreditacion/NivelPanel.test.tsx` — submit is disabled while `motivo` is
      blank; enabled once non-blank; calls `useCambiarNivel` with the typed `motivo` on submit. Run `npm test --
      NivelPanel` — expect compile failure.
- [ ] 4.6 GREEN: create `src/components/acreditacion/NivelPanel.tsx` (raise/lower with mandatory `motivo`). Run
      `npm test -- NivelPanel` — expect pass.
- [ ] 4.7 RED: create `src/components/acreditacion/AuditQueue.test.tsx` — shows an expiry warning when
      `expirada: true` on a listed evidencia, and explicitly does **not** render a level-change control inline
      (raising/lowering stays in `NivelPanel`, keeping approve-evidence and assert-level visually distinct per
      the design's data-flow note that they are separate admin actions). Run `npm test -- AuditQueue` — expect
      compile failure.
- [ ] 4.8 GREEN: create `src/components/acreditacion/AuditQueue.tsx` (admin approve/observe per requisito,
      expiry warning). Run `npm test -- AuditQueue` — expect pass.
- [ ] 4.9 RED: create `src/components/acreditacion/EvidenciaForm.test.tsx` — offers `DECLARACION` only in Slice A
      (`FOTO`/`DOCUMENTO` options are absent or disabled with an explanatory note); assert the component renders
      as a visually and structurally separate section from `components/org/InfoPublicaForm.tsx` when both are
      mounted together (per `specs/organizacion-self-edit/spec.md` delta, "The two flows are visually and
      structurally separate"). Run `npm test -- EvidenciaForm` — expect compile failure.
- [ ] 4.10 GREEN: create `src/components/acreditacion/EvidenciaForm.tsx` — referente submission, `DECLARACION`
      only (AD-4, Slicing section). Run `npm test -- EvidenciaForm` — expect pass.
- [ ] 4.11 RED: extend `src/app/router.test.tsx` (existing `ProtectedRoute` precedent) — the new `/acreditacion`
      route requires the `REFERENTE` role; the new `/organizaciones/:id/legajo` route requires `ADMINISTRADOR`;
      an unauthenticated or wrong-role user is redirected, not shown the route. Run `npm test -- router` —
      expect failure (routes don't exist).
- [ ] 4.12 GREEN: create `src/routes/acreditacion.tsx` (referente view) and `src/routes/legajo.tsx` (printable
      dossier + `@media print` stylesheet). Modify `src/app/router.tsx` to register both inside the existing
      `ProtectedRoute` groups (lines 61-91). Modify `src/routes/admin.tsx` to link into the audit queue. Run `npm
      test -- router` — expect pass.
- [ ] 4.13 Run the full SPA suite: `npm test` from `ts_hornero_admin/`. Then run `npm run build` (`tsc -b && vite
      build`) — vitest does not typecheck the full build graph, so this is a separate required check, not
      redundant with 4.1–4.12.

**Phase 4 acceptance criterion**: `npm test` passes; `npm run build` passes; `EvidenciaForm` offers no way to
select `FOTO`/`DOCUMENTO` in this phase's build.

---

## Phase 5 (B1, deferred until after the thesis-document task): `CategoriaAlimento` + worker filter

Do not start before the user schedules Slice B. Depends on Phase 2 (`AcreditacionService` exists to compute
`categoriasPermitidas(nivel)`).

- [ ] 5.1 RED: create `necesidad/NecesidadServiceCategoriaCapTest.java` — N1 rejects `REFRIGERADO`/`CONGELADO`
      categories; N2 accepts `REFRIGERADO`; N3 accepts all; `categoria=null` behaves exactly as today
      (`specs/organizacion-acreditacion/spec.md` "Level-Driven Food Category Caps"). Run `mvn test
      -Dtest=NecesidadServiceCategoriaCapTest` — expect compile failure.
- [ ] 5.2 GREEN: create `jar_hornero_ms/domain/CategoriaAlimento.java`; modify `domain/Necesidad.java` (additive
      nullable `categoria`, per the exact snippet in design's "Data Model — Slice B" section); modify
      `necesidad/NecesidadService.java` (category cap on `crear`); modify `necesidad/dto/*` to expose `categoria`.
      Run `mvn test -Dtest=NecesidadServiceCategoriaCapTest` — expect pass.
- [ ] 5.3 RED: extend `acreditacion/AcreditacionServiceTest.java` (or a new test) — `categoriasPermitidas(nivel)`
      returns the expected category set per level. Run — expect compile failure.
- [ ] 5.4 GREEN: modify `acreditacion/AcreditacionService.java` to add `categoriasPermitidas(nivel)`. Run — expect
      pass.
- [ ] 5.5 RED: extend `go_algorithms_worker/internal/assign/scoring_test.go` — empty `CategoriasPermitidas` is a
      no-op (existing round results unchanged); a category in `CategoriasAceptadas` but not in
      `CategoriasPermitidas` → `Score()` returns `false` → `Inf` in `MatrizCosto`; the existing 200-random-matrix
      Hungarian oracle still passes unchanged. Run `go test ./internal/assign/...` — expect compile failure
      (`CategoriasPermitidas` field doesn't exist).
- [ ] 5.6 GREEN: modify `go_algorithms_worker/internal/assign/scoring.go` — add `CategoriasPermitidas
      []string` to `Candidato` and require membership in both sets in `acepta()`, per AD-10's exact snippet.
      `Score()` and `MatrizCosto()` stay untouched. Run `go test ./internal/assign/...` — expect pass.

**Phase 5 acceptance criterion**: `mvn test` and `go test ./...` pass; `hungarian_test.go`'s 200-matrix oracle is
unmodified and still passes; an organizacion at any level may still publish a `categoria=null` necesidad
unaffected.

---

## Phase 6 (B2, deferred until after the thesis-document task): authenticated evidence-file route + photo upload

Depends on Phase 3 (A3's deny-list must exist before this phase opens the matching upload path — the design
requires the guard land before the upload path can, "in either merge order"). Depends on Phase 5 only for shared
scheduling, not code.

- [ ] 6.1 RED: create `src/evidencia-files/evidencia-files.controller.spec.ts` — owning REFERENTE can fetch their
      own evidence file; ADMINISTRADOR can fetch any organizacion's; a non-owning REFERENTE is denied `403`
      (`specs/organizacion-evidencia/spec.md` "Authenticated Evidence-File Access" scenarios). Run `npm test --
      evidencia-files` — expect compile failure.
- [ ] 6.2 GREEN: create `ts_hornero_bff/src/evidencia-files/*` — authenticated, ownership-checked streaming
      route. Run `npm test -- evidencia-files` — expect pass.
- [ ] 6.3 RED: extend `src/upload/upload.service.spec.ts` and `upload.controller.spec.ts` —
      `uploadOrgEvidencia()` writes under `org-evidencia/{orgId}/`; `POST upload/org-evidencia/:id` requires the
      owning REFERENTE or an ADMINISTRADOR. Run `npm test -- upload` — expect failure.
- [ ] 6.4 GREEN: modify `upload.service.ts` (`uploadOrgEvidencia()`) and `upload.controller.ts` (`POST
      upload/org-evidencia/:id`). Run `npm test -- upload` — expect pass.
- [ ] 6.5 RED: extend `EvidenciaForm.test.tsx` — `FOTO`/`DOCUMENTO` become selectable and trigger the upload flow.
      Run `npm test -- EvidenciaForm` — expect failure (still Slice-A-only in the codebase at this point).
- [ ] 6.6 GREEN: modify `ts_hornero_admin/src/components/acreditacion/EvidenciaForm.tsx` to enable photo attach.
      Run `npm test -- EvidenciaForm` — expect pass; run `npm run build`.
- [ ] 6.7 Modify `jar_hornero_ms/acreditacion/AcreditacionService.java` — accept `objectKey` in
      `CargarEvidenciaRequest` once the authenticated route exists (remove or scope the Slice-A `400`-if-non-null
      guard from task 2.15 to non-`FOTO`/`DOCUMENTO` submissions only, per the design's explicit note that the
      guard "costs three lines now and makes it impossible for Slice B's upload path to land before its access
      control, in either merge order" — this task is that controlled removal). Run `mvn test
      -Dtest=AcreditacionControllerSecurityTest` — expect pass, confirming `org-evidencia/` keys are still
      rejected by the A3 deny-list (task 3.2) even after this change.

**Phase 6 acceptance criterion**: `npm test` (BFF, SPA), `npm run build` (SPA), `mvn test` (MS) all pass;
`GET /images?key=org-evidencia/...` still returns `403` after this phase (the A3 guard is never weakened, only the
authenticated route becomes the supported access path).

---

## Cross-phase regression checks (run once at the end of Slice A, before requesting review)

- [ ] R.1 Run `mvn test` (full suite, not filtered) from `jar_hornero_ms/` — confirms no unrelated `Donacion`,
      `Auth`, or existing `Organizacion`/`Necesidad` test regressed.
- [ ] R.2 Run `npm test` and `npm run lint` (full) from `ts_hornero_bff/`.
- [ ] R.3 Run `npm test` and `npm run build` from `ts_hornero_admin/`.
- [ ] R.4 Manually verify `ts_hornero_astro` still renders an organizacion's public page unchanged (no code
      change expected there — this is a smoke check per "Explicitly NOT changed" in design).
