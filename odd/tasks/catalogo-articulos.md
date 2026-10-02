# Feature: catalogo-articulos

## Objective

Replace the current free-text `donación`/`necesidad` goods description with a DB-backed catalog
of `articulo`s (name, `CategoriaAlimento`, `unidad`, `activo`). Donaciones hold N lines
(`articulo` + `cantidad`); necesidades select requested `articulo`s (no quantities). Both
entities' `categoria` is *derived* from their lines/selections instead of being hand-picked.
The ronda solver gains an articulo-level hard filter on top of the existing categoria filter.

## Why

Found via e2e: a rice pool donation (`NO_PERECEDERO`) was matched to a necesidad for "Útiles
escolares" because legacy necesidades have `categoria = null` and the worker treats an empty
`categoriasAceptadas` as "accepts anything". Free-text goods descriptions give the solver no
reliable signal about what is actually being offered/requested. A structured catalog fixes the
matching signal at its source and lets `categoria` become a derived fact instead of a
hand-entered one that drifts from reality.

## Decisions (final — do not re-litigate; source: Engram #723, topic `odd/catalogo-articulos/decisions`)

1. Current stored data is NOT real → clean it: seeds must give every necesidad a
   categoria/articulos; local DB reset; Pi DB cleanup is a **USER ACTION** (destructive, backup
   first).
2. Ronda rule: a pool donation goes only to necesidades of compatible category/articulos;
   necesidades without category/articulos are excluded from rondas; categoria is required
   (derived) on every necesidad going forward.
3. Item catalog (`articulos`): stored in DB, seeded with an initial fixed list (each with
   `categoria` + `unidad`), editable by `ADMINISTRADOR` only (create, edit, deactivate — never
   hard delete).
4. A donación holds N lines of `articulo` + `cantidad` (unit comes from the articulo: kg,
   paquetes, litros, unidades). Applies to both modalidades (DIRECTA and FONDO_COMUN).
5. Mixed categories in one donación: the donación's `categoria` is the most demanding of its
   lines' categorias (`REFRIGERADO`/`CONGELADO` → N2, via `CategoriaAlimento.nivelMinimo`
   ordering).
6. Necesidades also use the catalog: the org selects requested `articulo`s (no quantities);
   `categoria` is derived from them; the solver only matches a donación to necesidades
   requesting at least one of its articulos.
7. Free-text `observaciones` is kept as an optional notes field (not replaced).

## Scope

**In scope**
- MS: new `Articulo` entity + repository + admin CRUD (create/edit/deactivate, no hard delete);
  `DonacionLinea` (articulo + cantidad, owned by `Donacion`); `NecesidadArticulo` (selected
  articulo, owned by `Necesidad`, no quantity); derivation of `Donacion.categoria` and
  `Necesidad.categoria` from lines/selections; `EntradaRondaFactory`/ronda candidate-selection
  changes to carry articulo ids and exclude necesidades with no articulos.
- Worker (`go_algorithms_worker`): additive wire field(s) for articulo ids on `DonacionV1`/
  `CandidatoV1`, and a hard-filter check in `scoring.go` (donación's articulo set ∩ candidate's
  requested articulo set ≠ ∅), kept alongside the existing categoria filter.
- BFF: new `articulos` module (public GET, admin-only write), DTO changes on
  `donaciones`/`necesidades` modules to carry lines/selections.
- Admin SPA: new catalog management screen (ADMINISTRADOR), donation form line-editor
  (`nueva-donacion.tsx`), necesidad create/edit form articulo picker, donation/necesidad detail
  screens showing lines.
- Seeds: `DataInitializer` (MS) seeds the articulo catalog + necesidades/donaciones with real
  lines; `scripts/seed.ts` extended so its referentes' necesidades carry articulos too (it
  currently seeds only users+orgs, not necesidades/donaciones — see C9).
- Local DB reset procedure; Pi DB cleanup documented as a **USER ACTION**, not executed by the
  agent.
- Docs: `docs/db-changes.md` entry for the new tables (additive, `ddl-auto=update` can create
  them; no destructive hand-written SQL needed since nothing existing is dropped — old
  `descripcion`/raw `categoria` input columns are kept, not altered, for backward read
  compatibility during rollout — see Constraints).
- Thesis doc touch-up noting the catalog addition (small, deferred to the last work unit).

**Out of scope**
- Hard-deleting existing `descripcion` text fields on Donacion/Necesidad (kept; still shown as
  free text alongside the structured lines — no decision asked for their removal).
- Changing `ModalidadDonacion`, `EstadoDonacion`/`EstadoNecesidad` vocabularies.
- Changing the Hungarian solver's scoring weights/algorithm beyond the new hard filter.
- Inventory/stock tracking of articulos (this is a catalog of *kinds* of goods, not stock levels).
- `ts_hornero_app` (deprecated, never touched).
- Any Pi-side database mutation — that is explicitly a USER ACTION.

## Constraints

- **Strict TDD** (`openspec/config.yaml` → `strict_tdd: true`): RED (failing test) →
  implementation → GREEN → REFACTOR, for every task below, in every touched service. Test
  runners per service:
  - `jar_hornero_ms`: `mvn test` / `mvn test -Dtest=ClassName` / `mvn test -Dtest=ClassName#method`
  - `ts_hornero_bff`: `npm test` / `npm test -- <spec-name>`
  - `ts_hornero_admin`: `npm test` (Vitest)
  - `go_algorithms_worker`: `go test ./...`
- Keep the three JWT enforcement layers in sync for the new `articulos` admin-write endpoints
  (MS `SecurityConfig` + `@PreAuthorize`, BFF `RolesGuard`/`@Roles`, admin SPA `ProtectedRoute`).
- `spring.jpa.hibernate.ddl-auto=update` can create new tables/columns safely; it cannot narrow
  or rename. Every new column this feature adds must be additive/nullable-at-first or on a new
  table, per `scripts/sql/README.md` conventions — no hand-written migration should be needed for
  this feature since nothing existing is dropped or renamed.
- Work-unit commits only, on branch `feat/tesis-followups` (current branch, not `main`), one
  Conventional Commit per deliverable work unit below. No push.
- Keep ~≤500 changed lines per work unit (planning heuristic, not a hard cap — see
  `odd/tasks` convention; split further only if a unit naturally grows past that while staying
  coherent).
- Spanish domain terms (`articulo`, `donación`, `necesidad`, `categoria`, `unidad`) stay Spanish;
  code/comments/docs in English (per `CLAUDE.md` and `openspec/config.yaml` rules).
- Worker contract stays v1-additive (AD-14 in existing worker docs): new fields are
  `omitempty`/pointer-optional, no breaking change, no `/v2/ronda`.

## Open technical questions (non-blocking, flag during implementation)

None are blocking — all 7 product decisions are closed. One judgment call left to the
implementer, noted here so it isn't silently decided mid-task: whether `DonacionLinea`/
`NecesidadArticulo` are JPA `@ElementCollection`s (simpler, no own id/repository) or full child
`@Entity`s with their own id (more consistent with existing `@OneToMany` patterns like
`Necesidad.donaciones`, easier to extend later e.g. per-line notes). **Recommendation**: use full
child entities — the codebase's existing convention is entity associations, not element
collections, and `cantidad` validation (`> 0`) is easier to express per-row with Bean Validation
on a DTO list than on an embeddable. This is called out in C1/C3, not re-asked as a product
question since it is purely a technical pattern choice within closed scope.

## Checklist

Work units are ordered by dependency: domain/catalog first, then donación/necesidad lines, then
worker, then ronda wiring, then BFF, then admin UI, then seeds/reset, then docs.

### Work unit A — MS: Articulo catalog entity + admin CRUD

- [x] **C1** — DONE 2026-10-01: `ArticuloRepositoryTest` RED→GREEN (3/3). Add `Articulo` entity (`nombre`, `categoria: CategoriaAlimento`,
  `unidad: UnidadArticulo` enum [`KG`,`PAQUETE`,`LITRO`,`UNIDAD`], `activo: boolean default true`)
  + `ArticuloRepository`.
  - Files: `jar_hornero_ms/src/main/java/org/example/domain/Articulo.java` (new),
    `jar_hornero_ms/src/main/java/org/example/domain/UnidadArticulo.java` (new),
    `jar_hornero_ms/src/main/java/org/example/domain/ArticuloRepository.java` (new).
  - Tests first: `jar_hornero_ms/src/test/java/org/example/domain/ArticuloRepositoryTest.java`
    (save/find, `findByActivoTrue`).
  - Verify: `mvn test -Dtest=ArticuloRepositoryTest`
  - Route: inline (1 new entity + 1 enum + 1 repository interface, mechanical, no design
    ambiguity).
  - Est. ~80 lines.

- [x] **C2** — DONE 2026-10-01: `ArticuloServiceTest` (6/6) + `ArticuloControllerSecurityTest` (9/9) RED→GREEN. `ArticuloService` + DTOs (`CrearArticuloRequest`, `ActualizarArticuloRequest`,
  `ArticuloResponse`) + `ArticuloController`: `GET /api/articulos` (public, `activo=true` by
  default, admin can pass `?incluirInactivos=true`), `POST /api/articulos` (ADMINISTRADOR),
  `PUT /api/articulos/{id}` (ADMINISTRADOR, edits nombre/categoria/unidad),
  `PATCH /api/articulos/{id}/desactivar` (ADMINISTRADOR, soft delete — sets `activo=false`,
  never a hard delete per decision 3).
  - Files: `jar_hornero_ms/src/main/java/org/example/articulo/` (new package: `ArticuloService.java`,
    `ArticuloController.java`, `dto/CrearArticuloRequest.java`, `dto/ActualizarArticuloRequest.java`,
    `ArticuloResponse.java`).
  - Tests first: `ArticuloServiceTest.java` (create/update/deactivate, deactivate never deletes
    row, deactivated articulo excluded from default listing), `ArticuloControllerSecurityTest.java`
    (anon GET allowed, anon POST/PUT/PATCH 403, REFERENTE/DONANTE POST 403, ADMINISTRADOR POST
    201).
  - Verify: `mvn test -Dtest=ArticuloServiceTest,ArticuloControllerSecurityTest`
  - Route: delegated direct (writer touches 5+ non-trivial files: service, controller, 3 DTOs,
    plus their tests).
  - Est. ~350 lines.

- [x] **C3** — DONE 2026-10-01: covered by `ArticuloControllerSecurityTest` matcher-ordering cases, GREEN. Wire `SecurityConfig`: public GET `/api/articulos/**`, everything else on that root
  needs `ADMINISTRADOR` (mirror the `/api/rondas/**` admin-only matcher pattern already there).
  - Files: `jar_hornero_ms/src/main/java/org/example/config/SecurityConfig.java`.
  - Tests first: extend `ArticuloControllerSecurityTest` (already covers this; this task is the
    matcher wiring that makes it pass) — write the matcher-ordering test case before adding the
    matcher if not already covered by C2's test.
  - Verify: `mvn test -Dtest=ArticuloControllerSecurityTest`
  - Route: inline (single file, mechanical, pattern already established by existing matchers).
  - Est. ~15 lines.

- [x] **A-seed** (not a numbered task in this doc; done ahead of C14 at the orchestrator's explicit
  request for work unit A): `DataInitializer.seedArticulos()` idempotently seeds a 13-item catalog
  covering all 3 `CategoriaAlimento` values, called before `seedNecesidades()`/`seedDonaciones()`.
  `DataInitializerArticuloSeedTest` RED→GREEN (2/2). `seedNecesidades()`/`seedDonaciones()`
  themselves are untouched — still C14's job (work unit I, out of this pass's scope).

### Work unit B — MS: Donación lines + categoria derivation

- [x] **C4** — DONE 2026-10-01: `CategoriaAlimentoTest` (4/4) + `DonacionLineaTest` (2/2) +
  `DonacionRepositoryTest` (12/12, no regression) RED→GREEN. Add `DonacionLinea` child entity (`articulo: Articulo`, `cantidad: BigDecimal`, owned
  `@ManyToOne` back to `Donacion`, `@OneToMany(cascade=ALL, orphanRemoval=true)` on `Donacion`).
  Remove nothing from `Donacion` (keep `observaciones` as optional notes per decision 7).
  Derive `Donacion.categoria` as the most-demanding categoria across its lines (decision 5) —
  expose via a `getCategoriaDerivada()` method or compute-and-store on save; keep the existing
  `categoria` column but populate it from lines instead of accepting it directly in
  `CreateDonacionRequest` for the FONDO_COMUN case (still required there per existing
  `DonacionService.crear` validation — now required to be *consistent with* the lines, not
  independently supplied).
  - Files: `jar_hornero_ms/src/main/java/org/example/domain/DonacionLinea.java` (new),
    `jar_hornero_ms/src/main/java/org/example/domain/Donacion.java` (add `List<DonacionLinea>`),
    `jar_hornero_ms/src/main/java/org/example/domain/CategoriaAlimento.java` (add a
    `static CategoriaAlimento masExigente(Collection<CategoriaAlimento>)` helper ordered by
    `nivelMinimo`).
  - Tests first: `CategoriaAlimentoTest.java` (`masExigente` picks N2 over N1, empty throws),
    `DonacionLineaTest.java`/extend `DonacionRepositoryTest.java` (cascade save/orphan removal).
  - Verify: `mvn test -Dtest=CategoriaAlimentoTest,DonacionRepositoryTest`
  - Route: delegated direct (3 files, cascades through an existing entity with existing tests to
    not break — needs careful review of `DonacionResponseTest`'s record-component assertions).
  - Est. ~180 lines.

- [x] **C5** — DONE 2026-10-01: `DonacionServiceTest` (57/57) + `DonacionResponseTest` (4/4) +
  `DonacionControllerTest` (7/7) RED→GREEN. Judgment call made (flagged in doc's "Open technical
  questions"): the client-supplied `categoria` field was **dropped entirely** from
  `CreateDonacionRequest` (not kept as an optional cross-check) — `categoria` is now always
  derived from `lineas` for both modalidades, so there is no code path left where a client value
  could contradict the lines. `DonacionResponse`/`DonacionActivaResponse` gained `lineas` as their
  new last record component (all 3 call sites across main+test updated). Update `CreateDonacionRequest`/`DonacionService.crear` to accept
  `List<LineaRequest>` (articulo id + cantidad, `cantidad > 0` via `@Positive`), build
  `DonacionLinea`s, derive `categoria` from them (replacing the current direct `categoria` input
  field — keep the field on the DTO only for the FONDO_COMUN pickup-matching validation path if
  still needed, otherwise drop it in favor of derivation). Update `DonacionResponse`/
  `DonacionActivaResponse` to include the lines (articulo nombre/unidad/cantidad) — this is a
  record signature change, touches every call site that constructs them.
  - Files: `jar_hornero_ms/src/main/java/org/example/donacion/dto/CreateDonacionRequest.java`,
    `DonacionService.java`, `DonacionResponse.java`, `DonacionActivaResponse.java`, plus any
    mapper that builds those records.
  - Tests first: extend `DonacionServiceTest.java` (crear with lines derives correct categoria;
    rejects empty lines list; rejects a line with an inactive articulo), update
    `DonacionResponseTest.java`'s hand-constructed records to the new signature (RED first since
    the constructor call won't compile / test will fail).
  - Verify: `mvn test -Dtest=DonacionServiceTest,DonacionResponseTest`
  - Route: delegated direct (DTO + service + 2 response records + their tests = 5+ files).
  - Est. ~400 lines.

- [x] **C6** — DONE 2026-10-01: `NecesidadServiceTest` (20/20, +6 new), `NecesidadServiceCategoriaCapTest`
  (5/5, rewritten to derive from articulos), `NecesidadServiceConcurrencyCapTest` (5/5),
  `NecesidadControllerTest` (4/4), `DonacionServiceTest` (61/61, +2 new DIRECTA-compatibility
  tests) GREEN; full MS suite 476/476. Added `NecesidadArticulo` child entity, derived
  `Necesidad.categoria` via `CategoriaAlimento.masExigente`, closed the C5 DIRECTA-compatibility
  gap in `DonacionService.crear` (rejects with `ARTICULO_INCOMPATIBLE` when no offered línea
  matches a requested articulo). `CrearNecesidadRequest.articuloIds` requires `@NotEmpty`;
  `ActualizarNecesidadRequest.articuloIds` null = unchanged, non-null must be non-empty.
  `NecesidadResponse` gained a new `articulos` (id/nombre/unidad/categoria) last component, via
  new `NecesidadArticuloResponse` record. `AcreditacionServiceCategoriasPermitidasTest` unaffected
  (doesn't touch `CrearNecesidadRequest`). Files touched: `domain/NecesidadArticulo.java` (new),
  `necesidad/NecesidadArticuloResponse.java` (new), `domain/Necesidad.java`,
  `necesidad/dto/CrearNecesidadRequest.java`, `necesidad/dto/ActualizarNecesidadRequest.java`,
  `necesidad/NecesidadService.java`, `necesidad/NecesidadResponse.java`,
  `donacion/DonacionService.java` (DIRECTA gap), plus the 5 test files listed above. ~428 changed
  lines. Route taken: delegated direct, done inline in this single-worker pass (no sub-delegation
  — scope was already fully understood from C1-C5's established pattern).

### Work unit C — Worker: articulo-level hard filter

- [x] **C7** — DONE 2026-10-01: `TestAceptaArticulos` (5/5 table cases) RED→GREEN in
  `scoring_test.go`, `TestADonacionesMapeaArticuloIds`/`TestADonacionesArticuloIdsAusenteMapeaNil`/
  `TestACandidatosMapeaArticuloIds` RED→GREEN in `ronda_v1_test.go`. Full worker suite green
  (`go test ./...`, `go vet ./...`, `gofmt -l .` clean). Golden fixture
  `testdata/ronda-v1/request.json` updated with overlapping `articuloIds` on both sides (response
  unchanged — proves additive, score-neutral when sets overlap); `contract/ronda-v1.md` documents
  the filter. ~155 changed lines across `scoring.go`, `scoring_test.go`, `ronda_v1.go`,
  `ronda_v1_test.go`, `request.json`, `ronda-v1.md`. Route: done inline in this single-worker pass.
  Add `ArticuloIds []int64` (or similar) to `DonacionV1`/`CandidatoV1` wire structs
  (additive, `omitempty`), map onto `assign.Donacion`/`assign.Candidato` (new
  `ArticuloIds`/`ArticulosSolicitados` fields), and add a hard filter in `scoring.go`'s
  `ScoreConDesglose`/`acepta`: when both sides declare articulo ids, require a non-empty
  intersection (mirrors the existing `acepta`/`aceptaSegun` "empty means accepts anything"
  shape, so a producer that hasn't been updated yet — i.e. mid-rollout — doesn't suddenly reject
  every pair).
  - Files: `go_algorithms_worker/internal/contrato/ronda_v1.go`,
    `go_algorithms_worker/internal/assign/scoring.go`.
  - Tests first (TDD, Go stdlib testing): extend
    `go_algorithms_worker/internal/assign/scoring_test.go` (donación/candidato with disjoint
    articulo sets → infeasible; overlapping → feasible; both empty → feasible, unchanged
    behavior), extend `go_algorithms_worker/internal/contrato/ronda_v1_test.go` for the new field
    round-tripping through `Validar`/`ADonaciones`/`ACandidatos`.
  - Verify: `go test ./...`
  - Route: delegated direct (2 non-trivial files with intertwined wire+scoring logic, needs care
    to preserve the existing categoria filter as a separate, still-active check).
  - Est. ~150 lines.

### Work unit D — MS: ronda input wiring + candidate exclusion

- [x] **C8** — DONE 2026-10-01: `EntradaRondaFactoryTest` (7/7, +2 new) and `RondaServiceTest`
  (15/15, +1 new `excludesNecesidadesSinArticulos`) RED→GREEN. `HttpAsignadorClientTest` (9/9)
  re-verified against the copied golden fixtures (`src/test/resources/contract/{request,
  response}.json`, copied verbatim from the worker's `testdata/ronda-v1/`). Full MS suite
  476/476. `RondaService.esCandidataElegible` now short-circuits on an empty `articulos` list
  before any other check. ~111 changed lines across `EntradaRondaFactory.java`,
  `RondaService.java`, `DonacionEntradaV1.java`, `CandidatoEntradaV1.java`,
  `EntradaRondaFactoryTest.java`, `RondaServiceTest.java`, `contract/request.json`. Route: done
  inline in this single-worker pass. `EntradaRondaFactory` sends each donación's/candidato's articulo ids (from
  `DonacionLinea`/`NecesidadArticulo`) in the `DonacionEntradaV1`/`CandidatoEntradaV1` worker DTOs
  (add the field there too, mirroring C7). `RondaService.esCandidataElegible` gains: a necesidad
  with zero `NecesidadArticulo`s is never eligible (decision 2 — "necesidades without articulos
  are excluded from rondas"), in addition to the existing checks (vencimiento, nivel, referente,
  coordinates).
  - Files: `jar_hornero_ms/src/main/java/org/example/asignacion/EntradaRondaFactory.java`,
    `jar_hornero_ms/src/main/java/org/example/asignacion/RondaService.java`,
    `jar_hornero_ms/src/main/java/org/example/asignacion/worker/dto/DonacionEntradaV1.java`,
    `.../CandidatoEntradaV1.java`.
  - Tests first: extend `EntradaRondaFactoryTest.java` (articulo ids present on both sides of the
    built entrada), extend `RondaServiceTest.java` (a necesidad with no articulos never appears
    in `candidatas`).
  - Verify: `mvn test -Dtest=EntradaRondaFactoryTest,RondaServiceTest`
  - Route: delegated direct (4 files, needs to not regress the existing eligibility/exclusion
    tests).
  - Est. ~150 lines.

### Work unit E — BFF: articulos module + donación/necesidad DTO passthrough

- [x] **C9** — DONE 2026-10-01: `articulos.service.spec.ts` (8/8) + `articulos.controller.spec.ts`
  (15/15) RED→GREEN for the new module; `crear-donacion.dto.spec.ts` (12/12, rewritten: dropped
  `categoria` cross-field tests, added `lineas` required/nested-validation tests) RED→GREEN;
  `crear-necesidad.dto.spec.ts` (4/4, new) + `actualizar-necesidad.dto.spec.ts` (4/4, new) RED→GREEN.
  Full BFF suite 184/184 passing, `npm run build` (tsc -b + nest build) green. New `articulos` BFF
  module (thin proxy to MS, mirrors existing module structure):
  `ArticulosController`/`ArticulosService`/DTOs, `GET /articulos` public (`@Public()`),
  `POST`/`PUT`/`PATCH` admin-only (`@Roles('ADMINISTRADOR')`). Update
  `donaciones`/`necesidades` BFF DTOs (`crear-donacion.dto.ts`, `crear-necesidad.dto.ts`,
  `actualizar-necesidad.dto.ts`) to carry lines/`articuloIds` instead of/alongside the removed
  direct `categoria` field, forwarding to the MS unchanged (BFF holds no domain logic).
  - Files: `ts_hornero_bff/src/articulos/` (new module, 4-5 files),
    `ts_hornero_bff/src/donaciones/dto/crear-donacion.dto.ts`,
    `ts_hornero_bff/src/necesidades/dto/crear-necesidad.dto.ts`,
    `ts_hornero_bff/src/necesidades/dto/actualizar-necesidad.dto.ts`,
    `ts_hornero_bff/src/app.module.ts` (register new module).
  - Tests first: `articulos.controller.spec.ts` (role guard on write verbs, public GET),
    `articulos.service.spec.ts` (proxies to MS URL correctly), update
    `crear-donacion.dto.spec.ts` and donaciones/necesidades service specs for the new line shape.
  - Verify: `npm test -- articulos` then `npm test` (full BFF suite, to catch DTO-shape
    regressions elsewhere).
  - Route: delegated direct (new module with 5+ files plus edits to 3 existing DTOs).
  - Est. ~350 lines.

### Work unit F — Admin SPA: catalog management screen

- [x] **C10** — DONE 2026-10-01: `useArticulos.test.tsx` (5/5) + `mapArticuloError.test.ts` (3/3) +
  `catalogo.test.tsx` (8/8) RED→GREEN. Full admin suite 361/361, `npm run build` (tsc -b + vite
  build) green, `eslint` clean on every touched file. Route is `/catalogo` (per orchestrator's
  explicit routing instruction) backed by `ts_hornero_admin/src/routes/catalogo.tsx` (not
  `catalogo-articulos.tsx` as originally named here — deliberate, not a drift); hooks are
  `useArticulos`/`useCrearArticulo`/`useEditarArticulo`/`useDesactivarArticulo` (edit named
  `useEditarArticulo`, not `useActualizarArticulo`, to match the Spanish verb used by the rest of
  this hook file's own docstrings). `types/domain.ts` gained `CategoriaAlimento`, `UnidadArticulo`,
  `Articulo`, `ArticuloInput` — kept as the one canonical catalog type set (not copied) for reuse
  by work units G/H's donación línea / necesidad articulo pickers. `lib/domain-ui.ts` gained
  `CATEGORIA_ALIMENTO` (badge config) and `UNIDAD_ARTICULO` (plain lowercase labels), same reuse
  intent. Screen: list via `PaginatedTable` (single static page — `GET /articulos` is unpaginated)
  with a categoría `<select>` filter, a "Mostrar inactivos" checkbox (toggles
  `useArticulos(true)`), a name search box, inline create form (toggled by "Nuevo artículo"),
  inline edit form per row via `renderRowDetail`/`expandedKeys`, and a two-click
  Desactivar→Confirmar pattern mirroring `routes/rondas.tsx`'s existing confirm convention (no
  shared `Modal` component exists in this codebase to reuse instead — confirmed during research).
  Inactive rows show the `ACTIVO` badge and render no actions (no reactivate endpoint on the MS
  side, per decision 3). Nav entry added to `AppShell.tsx`'s `ADMINISTRADOR` block (`Box` icon,
  already imported in that file) and the route registered in `router.tsx`'s existing
  `ADMINISTRADOR`-only `ProtectedRoute` block (no new gate needed). Files touched/created:
  `ts_hornero_admin/src/types/domain.ts`, `ts_hornero_admin/src/lib/domain-ui.ts`,
  `ts_hornero_admin/src/lib/hooks/useArticulos.ts` (new),
  `ts_hornero_admin/src/lib/hooks/useArticulos.test.tsx` (new),
  `ts_hornero_admin/src/lib/hooks/mapArticuloError.ts` (new),
  `ts_hornero_admin/src/lib/hooks/mapArticuloError.test.ts` (new),
  `ts_hornero_admin/src/routes/catalogo.tsx` (new),
  `ts_hornero_admin/src/routes/catalogo.test.tsx` (new), `ts_hornero_admin/src/app/router.tsx`,
  `ts_hornero_admin/src/app/AppShell.tsx`. ~715 changed lines (over the ~450 est. and the feature
  doc's ~500 heuristic — largest share is the two test files, which the heuristic explicitly
  doesn't penalize; no artificial splitting applied). Route taken: delegated direct, done inline
  in this single-worker pass (parent orchestrator already delegated the whole work unit; no
  further internal sub-delegation needed since the full scope was mapped by one exploration pass
  before writing). No commit made — HARD no-mutating-git-commands constraint for this pass; commit
  seams below are for the orchestrator's own commit step.

- **C10 (original task text, superseded by the DONE note above)** — New ADMINISTRADOR-only route `catalogo-articulos.tsx` (list + create + edit +
  deactivate), `useArticulos`/`useCrearArticulo`/`useActualizarArticulo`/`useDesactivarArticulo`
  TanStack Query hooks, nav entry gated by role (mirror existing `ProtectedRoute` role-gating
  pattern used for other admin-only screens).
  - Files: `ts_hornero_admin/src/routes/catalogo-articulos.tsx` (new),
    `ts_hornero_admin/src/lib/hooks/useArticulos.ts` (new, + create/update/deactivate hooks),
    `ts_hornero_admin/src/app/routes.tsx` or router config (register route),
    `ts_hornero_admin/src/app/ProtectedRoute.tsx` usage site for the new route (role gate).
  - Tests first (Vitest + Testing Library): `catalogo-articulos.test.tsx` (lists articulos,
    create form validates cantidad/nombre, deactivate button calls the right hook and never
    shows a "delete" affordance per decision 3), hook tests under `__tests__/`.
  - Verify: `npm test` (Vitest, scoped: `npm test -- catalogo-articulos`)
  - Route: delegated direct (new screen + 4 hooks + routing registration = 6+ files).
  - Est. ~450 lines.

### Work unit G — Admin SPA: donation form line-editor

- [x] **C11** — DONE 2026-10-01: already landed in the prior session (not this pass) — `nueva-donacion.tsx`/`LineaArticuloEditor`/`useCrearDonacion` committed before this resume began.

- **C11 (original task text)** — Replace/augment `nueva-donacion.tsx`'s single free-text flow with a repeatable
  articulo-line editor (select articulo from `useArticulos`, enter `cantidad`, add/remove rows;
  `categoria` is now a read-only derived display, not a field the donante picks — remove the
  manual `categoria` `<select>` currently there for FONDO_COMUN). Update `useCrearDonacion` to
  send the lines payload.
  - Files: `ts_hornero_admin/src/routes/nueva-donacion.tsx`,
    `ts_hornero_admin/src/lib/hooks/useCrearDonacion.ts`.
  - Tests first: extend `nueva-donacion.test.tsx` (add/remove line rows, categoria derived and
    displayed not editable, submit payload shape matches new DTO).
  - Verify: `npm test -- nueva-donacion`
  - Route: delegated direct (2 files, but `nueva-donacion.tsx` is 260 lines with nontrivial
    existing modalidad-branching logic — treat as a non-trivial rewrite, not mechanical).
  - Est. ~300 lines.

- [x] **C12** — DONE 2026-10-01: `necesidad-detalle.test.tsx` (5/5, RED→GREEN, DIRECTA flow
  using `LineaArticuloEditor` restricted to the necesidad's requested articulos, friendly
  `mapDonacionError` message on `ARTICULO_INCOMPATIBLE`); new `formatLineas` helper
  (`lib/format.ts`, `lib/format.test.ts`, 4/4 RED→GREEN) renders a compact "5 kg Arroz, 6
  paquetes Fideos" summary, wired into `mis-donaciones.tsx`, `donacion-detalle.tsx`,
  `control-donaciones.tsx` (new "Artículos" column) and `dashboard.tsx`'s referente
  accionable/entrega rows — each with a new RED→GREEN test case. Full admin suite 396/396,
  `npm run build` green, `tsc -b` clean (the two pre-existing failures in `necesidad-detalle.tsx`
  and `needs.tsx` are gone). Files: `routes/necesidad-detalle.tsx` (+header badge list of
  requested articulos), `routes/necesidad-detalle.test.tsx`, `routes/mis-donaciones.tsx`,
  `routes/mis-donaciones.test.tsx`, `routes/donacion-detalle.tsx`, `routes/donacion-detalle.test.tsx`,
  `routes/control-donaciones.tsx`, `routes/control-donaciones.test.tsx`, `routes/dashboard.tsx`,
  `routes/dashboard.test.tsx`, `lib/format.ts`, `lib/format.test.ts`.

- **C12 (original task text)** — Update `donacion-detalle.tsx` and `mis-donaciones.tsx` to render the donación's lines
  (articulo nombre + cantidad + unidad) instead of/alongside free-text `observaciones`.
  - Files: `ts_hornero_admin/src/routes/donacion-detalle.tsx`,
    `ts_hornero_admin/src/routes/mis-donaciones.tsx`.
  - Tests first: extend `donacion-detalle.test.tsx`, `mis-donaciones.test.tsx` (lines render).
  - Verify: `npm test -- donacion-detalle mis-donaciones`
  - Route: inline (2 files, display-only change, already-understood after C11's DTO shape is
    settled) — escalate to delegated if the diff grows past ~150 lines once started.
  - Est. ~120 lines.

### Work unit H — Admin SPA: necesidad create/edit articulo picker

- [x] **C13** — DONE 2026-10-01: new `ArticuloPicker` component (`components/necesidad/`,
  `ArticuloPicker.test.tsx` 5/5 RED→GREEN) — checkbox multi-select grouped by categoría with a
  derived-categoría badge (same `masExigente` rule as the donación línea editor) — wired into
  `needs.tsx`'s `CreateForm`/`EditForm` (confirmed exact location: `needs.tsx` is both the
  referente's necesidad list and its in-page create/edit flow, no separate route). Requires ≥1
  articulo before submit (`needs.test.tsx`, 2/2 RED→GREEN: rejects empty selection with a field
  error, submits `articuloIds`). Requested articulos now also shown: `needs.tsx`'s list rows,
  `necesidad-detalle.tsx`'s header (badge list), and `explorar.tsx`'s donante-facing browse cards
  (new `explorar.test.tsx`, 1/1 RED→GREEN). `useCrearNecesidad`/`useActualizarNecesidad` needed
  no changes — their `CrearNecesidadInput`/`ActualizarNecesidadInput` types already carried
  `articuloIds` from work unit E (C9). Files: `components/necesidad/ArticuloPicker.tsx` (new),
  `components/necesidad/ArticuloPicker.test.tsx` (new), `routes/needs.tsx`, `routes/needs.test.tsx`
  (new), `routes/necesidad-detalle.tsx`, `routes/explorar.tsx`, `routes/explorar.test.tsx` (new).
  Astro: `ts_hornero_astro/src/lib/types.ts` gained `NecesidadArticulo`/`Necesidad.articulos`;
  `components/islands/NeedsBoard.tsx` and `pages/org/[slug].astro` render requested articulos as
  pills — verified via `npm run build` (green, no test runner in this service).

- **C13 (original task text)** — Add an articulo multi-select to the necesidad create/edit flow (find the
  create/edit form — likely inline in `necesidad-detalle.tsx` or a dedicated route reachable from
  it; confirm exact file via `useCrearNecesidad`/`useActualizarNecesidad` call sites during this
  task), replacing the current free-text-only + no-categoria-input flow with: pick N articulos
  from `useArticulos`, `categoria` shown as derived/read-only.
  - Files: `ts_hornero_admin/src/routes/necesidad-detalle.tsx` (confirm exact create/edit form
    location at task start — this file currently only *displays* `descripcion`; the create/edit
    form may be a different route or a modal reached from `mis-organizaciones`/org detail —
    delegate a quick 1-file-scope check if ambiguous, do not guess),
    `ts_hornero_admin/src/lib/hooks/useCrearNecesidad.ts`,
    `ts_hornero_admin/src/lib/hooks/useActualizarNecesidad.ts`.
  - Tests first: extend/add the relevant `*.test.tsx` (articulo picker requires ≥1 selection,
    categoria shown derived, submit payload carries `articuloIds`).
  - Verify: `npm test -- necesidad`
  - Route: delegated direct (exact file count TBD pending the location check above; treat as
    delegated given the DTO-shape dependency on C9).
  - Est. ~350 lines.

### Work unit I — Seeds + local DB reset

- **C14** — `DataInitializer` (MS): add `seedArticulos()` (the initial fixed catalog — reuse/
  extend the existing "name, category, unidad" list implied by decision 3; a reasonable starter
  set: arroz/fideos/aceite/harina → `NO_PERECEDERO`; leche/yogur/queso → `REFRIGERADO`;
  carne/verduras congeladas → `CONGELADO`), called before `seedNecesidades()`/`seedDonaciones()`.
  Update `seedNecesidades()` to attach 1-3 articulos to every necesidad (deriving categoria, no
  more manual categoria-less necesidades) and `seedDonaciones()` to attach 1-2
  `DonacionLinea`s to every donación (deriving categoria, no more bare `observaciones`-only
  donaciones).
  - Files: `jar_hornero_ms/src/main/java/org/example/config/DataInitializer.java`.
  - Tests first: if an existing seed-smoke test exists, extend it; otherwise add a focused
    `DataInitializerArticuloSeedTest.java` asserting every seeded necesidad has ≥1 articulo and
    every seeded donación has ≥1 línea (run against the H2 integration profile, mirroring
    existing MS integration test setup).
  - Verify: `mvn test -Dtest=DataInitializerArticuloSeedTest` (or the equivalent extended test);
    then `mvn spring-boot:run` against a fresh local Postgres to eyeball the seed.
  - Route: delegated direct (one file, but large/mechanical-looking edit that actually touches
    every necesidad/donación literal in the file — ~190 lines already there, touching most of
    it — treat as non-trivial, not mechanical).
  - Est. ~250 lines changed.

- **C15** — `scripts/seed.ts`: it currently seeds only referentes + orgs (no necesidades/
  donaciones at all — confirmed by reading the full file). Decision says seeds "must produce
  necesidades with articulos" — since this script has no necesidad-seeding phase today, either
  (a) add a minimal phase 3 that creates 1-2 necesidades per seeded org via
  `POST /necesidades` with `articuloIds`, or (b) document that `scripts/seed.ts`'s scope is
  users/orgs only and the necesidad/donación seed is `DataInitializer`'s job (C14) — **resolve
  this by reading `scripts/seed.ts`'s full remaining content (phase 2/admin section, not yet
  read) before deciding**; if it does nothing with necesidades, prefer (b) and note it explicitly
  in this document's Progress section rather than inventing new scope. If a necesidad-seeding
  phase is added, it needs `GET /articulos` first to resolve ids by name.
  - Files: `scripts/seed.ts`.
  - Tests first: none exist for this script today (it's an ad-hoc runner, not under a test
    runner) — verify manually via `make seed` against a running local stack instead.
  - Verify: `make up-local && make seed` (manual, observe console output + spot-check via
    `GET /necesidades` that seeded necesidades carry articulos, only if phase 3 is added).
  - Route: inline if outcome is (b) (doc note only), delegated if outcome is (a) (new fetch
    logic + id resolution, non-trivial).
  - Est. ~0-120 lines (depends on (a) vs (b)).

- **C16** — **USER ACTION — local DB reset.** After C1-C15 land, the local Postgres volume holds
  pre-catalog data (necesidades/donaciones without lines, per decision 1 "not real, clean it").
  Document and run: `make down` (stops containers; add `-v` manually or via
  `docker compose down -v` to drop the Postgres volume), then `make up` or `make up-local` to
  recreate the schema fresh via `ddl-auto=update` + `DataInitializer`'s new seed. This is a
  destructive local action — confirm with the user before running `docker compose down -v`
  (it is not implied by ordinary ODD implementation authorization).
  - Files: none (operational step); if a convenience is added, a one-line note in
    `docs/deploy-rpi-cloudflare.md` or a new `docs/db-changes.md` entry per C17.
  - Verify: `make up-local && make seed` then manual spot-check (`GET /necesidades`,
    `GET /articulos`) that every necesidad has articulos.
  - Route: inline (operational command, user-confirmed).
  - Est. 0 lines (unless a doc note is added, then ~10 lines, folded into C17).

- **C17** — **USER ACTION — Pi DB cleanup.** Per decision 1, production (Raspberry Pi) DB
  cleanup is explicitly the user's own action, never performed by the agent. Deliverable for this
  task is documentation only: add a short, clearly-labeled section to
  `docs/deploy-rpi-cloudflare.md` (or `docs/db-changes.md`, whichever already holds the
  destructive-change runbook convention per `scripts/sql/README.md`'s "Record it" step) giving
  the exact backup-then-reset commands for the Pi operator to run themselves once the new schema
  ships — `pg_dump` backup first (same command as `scripts/sql/README.md`'s run procedure),
  then either a clean reseed or a manual cleanup of pre-catalog rows, operator's choice.
  - Files: `docs/db-changes.md` (preferred — matches existing hand-written-SQL convention) or
    `docs/deploy-rpi-cloudflare.md`.
  - Verify: none (doc-only); readback the written section for accuracy against
    `scripts/sql/README.md`'s backup command.
  - Route: inline (one doc file, mechanical once the backup command is copied from the existing
    convention).
  - Est. ~40 lines.

### Work unit J — Thesis doc touch-up

- **C18** — Add a short section to the thesis handoff doc (per memory
  `tesis-ingenieria-handoff` — read `docs/tesis/handoff.md` first) noting the catalog addition:
  what changed, why (the matching-bug root cause), and which of the 3 pillars it touches.
  - Files: `docs/tesis/handoff.md` or the relevant typed subfolder doc it points to (confirm
    exact file via `docs/tesis/handoff.md` at task start).
  - Verify: none (doc-only); readback.
  - Route: inline (one doc file, small addition).
  - Est. ~30 lines.

## Acceptance Criteria

- `ADMINISTRADOR` can create, edit, and deactivate an `articulo` via the admin SPA; deactivation
  never hard-deletes the row (verified by a repository-level test asserting the row still
  exists after deactivate).
- A new donación (either modalidad) requires ≥1 line (articulo + cantidad); its `categoria` is
  always the most demanding of its lines' categorias, never hand-entered.
- A new necesidad requires ≥1 selected articulo; its `categoria` is always derived from them,
  never hand-entered.
- The ronda solver never matches a donación to a necesidad that shares no articulo with it
  (new Go test proves disjoint sets are infeasible); a necesidad with zero articulos never
  appears among ronda candidates (new Java test proves this).
- `DataInitializer`'s seeded necesidades and donaciones all carry ≥1 articulo/línea after reset
  (manual spot-check via `GET /necesidades`, `GET /donaciones` against a freshly reset local DB).
- All per-service test suites pass: `mvn test` (jar_hornero_ms), `npm test` (ts_hornero_bff),
  `npm test` (ts_hornero_admin), `go test ./...` (go_algorithms_worker). `ts_hornero_admin`'s
  `npm run build` (tsc -b + vite build) succeeds — per the standing "verify build, not just
  tests" convention (Engram: `verify-frontend-build-not-just-tests`).
- Pi DB cleanup is documented as an explicit user-run runbook step, never executed by the agent.

## Progress

- 2026-10-01: Work units A (C1-C3 + idempotent catalog seed) and B (C4-C5 only — **C6 explicitly
  deferred** to a later pass per orchestrator scoping, not done in this pass) implemented in
  `jar_hornero_ms` under strict TDD. Full MS suite: 465/465 passing, 0 failures/errors. See
  "Key Learnings" in the implementation worker's report for the full file list, RED→GREEN
  evidence, and judgment calls (categoria field dropped from `CreateDonacionRequest`, DIRECTA
  articulo-compatibility check not implemented — blocked on C6/`NecesidadArticulo`). Necesidad is
  untouched; its `categoria` input path and lack of articulo selection are unchanged until C6.
- 2026-10-01: Document created after exploration (decisions read from Engram #723; code read:
  `CategoriaAlimento`, `Donacion`, `Necesidad`, their DTOs/responses, `EntradaRondaFactory`,
  `SecurityConfig`, worker `ronda_v1.go`/`scoring.go`, `RondaService.esCandidataElegible`,
  `NecesidadRepository`, `DataInitializer`, `scripts/seed.ts` (partial — phase 2/3 not fully
  read, see C15), admin `nueva-donacion.tsx`/`necesidad-detalle.tsx` line counts and
  categoria-related code, BFF `donaciones`/`necesidades` module file lists, `scripts/sql/README.md`,
  `openspec/config.yaml`). No source files modified. 18 tasks across 10 work units.
- TDD mode: **on** (`strict_tdd: true` in `openspec/config.yaml`), runners as listed above under
  Constraints. Source: project config, not inferred.
- Delivery strategy: not yet chosen — flag to user once the running changed-line count
  approaches ~400 after the first couple of work units (estimated total below already exceeds
  that, so a chain strategy (`ask-on-risk` default) will be needed before C9 or so).
- Next step: confirm with user whether to proceed task-by-task starting at C1, and resolve the
  C9/C13 file-location ambiguities (necesidad create/edit form location; scripts/seed.ts
  scope decision) at the start of their respective work units rather than guessing now.
- 2026-10-01: Work units B's deferred C6, plus C (worker articulo filter) and D (MS ronda wiring)
  implemented under strict TDD, in dependency order, no `git` mutation performed by this worker.
  Full suites: MS 476/476, worker `go test ./... && go vet ./... && gofmt -l .` all clean. ~694
  changed lines total (C6 ~428, C7 ~155, C8 ~111 — see each task's evidence note above). Closed
  the C5-flagged DIRECTA articulo-compatibility gap as part of C6 (new `ARTICULO_INCOMPATIBLE`
  400 in `DonacionService.crear`). DataInitializer's seeded necesidades still have zero articulos
  (C14, work unit I, untouched by design) — per decision 2 they are now correctly excluded from
  rondas by `RondaService.esCandidataElegible`, consistent with decision 1 ("current data is not
  real"); the local DB reset (C16) is still the user's own action, not yet run. Not yet done:
  work units E-J (BFF, admin SPA, seeds, docs) — API/DTO shape notes for those left in this
  session's final report.
- 2026-10-01: Work unit E (C9, BFF) implemented under strict TDD, no `git` mutation performed by
  this worker. New `articulos` module (`ts_hornero_bff/src/articulos/`: controller, service,
  module, 2 DTOs, 2 spec files) registered in `app.module.ts`; `CrearDonacionDto` lost its
  `categoria` cross-field constraint and gained a required `lineas: DonacionLineaDto[]`
  (`@ArrayMinSize(1)`, `@ValidateNested({ each: true })`, new `donacion-linea.dto.ts`);
  `CrearNecesidadDto` gained required `articuloIds: number[]` (`@ArrayNotEmpty`, `@IsInt({each:true})`);
  `ActualizarNecesidadDto` gained optional `articuloIds?: number[]` (same validators, `@IsOptional`
  wrapper — absent means unchanged, a provided list must be non-empty). No BFF error-passthrough
  code needed: the existing global `AxiosExceptionFilter` already relays MS error envelopes
  (status + body, e.g. `ARTICULO_INCOMPATIBLE`/`ARTICULO_INACTIVO`) unchanged. Full BFF suite
  184/184, `npm run build` green. ~617 changed lines (94 diff + 523 new files across 10 files —
  slightly over the ~500-line work-unit heuristic, not split further since it is one coherent
  module + its 3 dependent DTO updates). Not yet done: work units F-J (admin SPA, seeds, docs).
- 2026-10-01: Work unit G's remaining scope (C12) and work unit H (C13) implemented under strict
  TDD, no `git` mutation performed by this worker (resumed from an interrupted prior pass that
  had left `necesidad-detalle.tsx` partially edited and `tsc -b` failing in two places — both
  fixed as the first seam). Full admin suite 396/396, `npm run build` (tsc -b + vite build)
  green, `eslint` clean on every touched file; `ts_hornero_astro`'s `npm run build` green (no
  test runner there). See each task's evidence note above for the full file list. Not yet done:
  work units I-J (seeds, docs).

**Estimated total: ~18 tasks, 10 work units, ~3,480 changed lines** (sum of per-task estimates;
heuristic only, not a hard cap — several units will need the chosen delivery/chain strategy
before completion since the total is well above the ~400-line single-PR heuristic).
