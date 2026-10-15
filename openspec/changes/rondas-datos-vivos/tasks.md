# Tasks: Rondas on Live Data (rondas-datos-vivos)

Strict TDD (RED -> GREEN), minimal tests per design. MS: `mvn test -Dtest=...` from `jar_hornero_ms`. Worker: `go test ./...` from `go_algorithms_worker`. Every PR ends in work-unit commits (Conventional Commits, no AI attribution). Never read `.env*`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~300-350; PR2a ~90; PR2b ~350 (+ generated asset, excluded); PR3 ~320-360. Total ~1060-1150 |
| 400-line budget risk | High (as a single change); Low-Medium per PR |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (MS live deficit) -> PR2a (worker serve w/o CSVs) -> PR2b (worker /v1/radio + asset) -> PR3 (MS radio client + hook + backfill) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (design proposes stacked-to-main) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Deploy-order risk: PR1 and PR2a MUST be deployed together. After PR1 alone, the old CSV worker may answer RADIO/CERCANO for candidates without a computed deficit; after PR2a alone the worker has no CSVs and every candidate would be NEUTRAL.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | V011 + PoblacionRadio, importer, live aggregate, Java formula, factory sends codigoRadio/deficit | PR1 (base main) | `mvn test -Dtest='VulnerabilidadCalculatorTest,PoblacionRadioRepositoryTest,EntradaRondaFactoryTest'` | `make up-local`, `make importar-poblacion` twice, run ronda, check deficitFuente PROVISTO | Revert PR1; table is additive, unused by old code |
| 2 | Worker serve without CSVs; image/compose drop CSVs | PR2a (base PR1 or main) | `go test ./...` | `docker compose up --build worker`, health OK, ronda answers | Revert PR2a; CLI untouched |
| 3 | Worker `POST /v1/radio` + radios asset + Dockerfile asset copy | PR2b (base PR2a) | `go test ./internal/radios/... ./internal/http/...` | `docker compose exec worker` POST /v1/radio | Revert PR2b; serve keeps working (503 RADIOS_NO_DISPONIBLES) |
| 4 | MS RadioCensalClient, crear/editar hook, hourly backfill | PR3 (base PR2b) | `mvn test -Dtest='HttpRadioCensalClientTest,OrganizacionServiceTest,RadioCensalBackfillJobTest'` | `make up-local`: create org with coords, see codigo_radio; backfill logs | Revert PR3; orgs keep null radio -> NEUTRAL |

## Phase 1: PR1 - MS live vulnerability (Unit 1)

- [ ] 1.1 Create `scripts/sql/V011__poblacion_radio.sql`: `CREATE TABLE IF NOT EXISTS poblacion_radio (codigo_radio varchar(9) PRIMARY KEY, habitantes integer NOT NULL CHECK (habitantes >= 0))` inside BEGIN/COMMIT (AD-1). Check `scripts/sql/README.md` for a script list and update it if present.
- [ ] 1.2 Create entity `PoblacionRadio` (`@Entity @Immutable`, table `poblacion_radio`) under `jar_hornero_ms/src/main/java/org/example/` (package alongside the organizacion/ronda code; H2 tests use create-drop).
- [ ] 1.3 RED: `jar_hornero_ms/src/test/java/.../VulnerabilidadCalculatorTest.java` - spec scenario "Deficit follows the formula" (pop 3000, 2 comedores, 1 necesidad, median 1000 -> 2.25) and an even-count median case. Also cover radio without population/zero comedores omitted. Run: `mvn test -Dtest=VulnerabilidadCalculatorTest` (fails).
- [ ] 1.4 GREEN: create pure `VulnerabilidadCalculator` (median with percentile_cont semantics, `v = hpc/median*(1+nec/com)`), mirroring `CumplimientoCalculator` style (AD-4). Empty input -> empty map.
- [ ] 1.5 RED: `PoblacionRadioRepositoryTest` (`@DataJpaTest`, H2) for `zonasConComedores`: excludes PENDIENTE/RECHAZADA/INACTIVA (spec "Excluded estados"), counts only ABIERTA/EN_PROGRESO necesidades not vencidas (same as `findMapa`), requires coords and codigo_radio, joins population with habitantes > 0. Run it (fails).
- [ ] 1.6 GREEN: create `PoblacionRadioRepository` with native query `zonasConComedores` (CTE nec per org -> com per radio JOIN poblacion_radio WHERE habitantes>0). Keep SQL portable to H2 (no percentile_cont in SQL).
- [ ] 1.7 RED: `EntradaRondaFactoryTest` 2 tests - org with radio+population -> candidate has codigoRadio, computed deficit, deficitFuente PROVISTO; org without radio or radio without population -> codigoRadio absent/present but deficit omitted (NEUTRAL by omission, AD-5). Path: existing factory test under `jar_hornero_ms/src/test/java/`.
- [ ] 1.8 GREEN: modify `EntradaRondaFactory` (find under `jar_hornero_ms/src/main/java/`) to call the repository + calculator once per ronda inside RondaService tx1 (AD-6), send `codigoRadio` when present and `deficit` only when computed; log WARN when `poblacion_radio` is empty. `RondaService` unchanged.
- [ ] 1.9 Create `scripts/mapa/importar-poblacion.sh` (BEGIN; temp staging ON COMMIT DROP; COPY FROM STDIN csv header; CSV body; TRUNCATE poblacion_radio; INSERT `lpad(codigo,9,'0')`, habitantes WHERE habitantes NOT NULL; COMMIT) and add `make importar-poblacion` to `Makefile` (depends on backup, pipes into `$(PSQL)`) (AD-3). Document the expected CSV path/columns in the script header.
- [ ] 1.10 Docs for PR1: `scripts/mapa/README.md` (importar-poblacion), `docs/mapa-vulnerabilidad.md` (live formula, NEUTRAL cases, estados), `docs/db-changes.md` (V011).
- [ ] 1.11 Verify PR1 on `make up-local`: `make migrate ENV_FILE=.env.local` (do not read the file), `make importar-poblacion` run twice (same count), run a ronda as ADMINISTRADOR, confirm `deficitFuente` PROVISTO for an imported org and NEUTRAL for one without radio. Run `mvn test` full MS suite.
- [ ] 1.12 Commits (suggested): `feat(ms): add poblacion_radio table and importer`; `feat(ms): compute live vulnerability for rondas`; `docs: document live ronda vulnerability`.

## Phase 2: PR2a - Worker serve without CSVs (Unit 2)

- [ ] 2.1 RED: Go test in `go_algorithms_worker` (serve wiring, e.g. `main_test.go` or the http package) - serve with empty `--data` starts and solves a ronda whose candidates carry `deficit`; candidate without deficit/codigoRadio gets NEUTRAL 1.0 in `deficitFuente` (spec "Serve starts and assigns without CSVs"). Run `go test ./...` (fails).
- [ ] 2.2 GREEN: change `serve` `--data` default to `""` and build `geo.NuevoResolvedor(nil, nil, 1.0)` when empty (AD-7); `metrics`/`assign` unchanged.
- [ ] 2.3 Verify spec "CLI subcommands still read CSVs": `go run . metrics --data data/renacom.csv` (or existing CLI test) still works; `go vet ./...`.
- [ ] 2.4 Edit `go_algorithms_worker/Dockerfile`: stop copying CSVs, remove `POBLACION_CSV`, exec-form ENTRYPOINT `serve --addr :8090` (the `--radios` flag is added in 3.x); edit `docker-compose.yml`: drop `POBLACION_CSV`, healthcheck `start_period: 30s`.
- [ ] 2.5 Verify: `docker compose build worker` on `make up-local`, worker healthy, trigger a ronda.
- [ ] 2.6 Commits: `feat(worker): serve without CSV data`; `build(worker): drop CSVs from image`.

## Phase 3: PR2b - Worker POST /v1/radio and polygon asset (Unit 3)

- [ ] 3.1 FIRST: write `scripts/mapa/radios.sql` (DuckDB: radio 2022 polygons -> `{"c":code,"g":GeoJSON}` NDJSON, `ST_SimplifyPreserveTopology` 0.0001 + `ST_ReducePrecision` 0.00001) and `make mapa-radios` target writing `go_algorithms_worker/data/radios-2022.ndjson.gz` (AD-8). Run it and MEASURE the gzipped size. Gate: commit if <= 10 MB; else rerun with tolerance 0.0002; else publish as GitHub Release asset and fetch in the Dockerfile with a pinned SHA-256 (requires the user's explicit decision before any publish). Record the measured size in the commit body and in 6.x docs.
- [ ] 3.2 RED: table-driven `go_algorithms_worker/internal/radios/radios_test.go` for `Buscar`: inside, inside a hole -> not found (or outer neighbour), MultiPolygon, tie -> lowest code, near-miss within 25 m, outside -> not found. Use a tiny inline NDJSON fixture. Run `go test ./internal/radios/...` (fails).
- [ ] 3.3 GREEN: create `go_algorithms_worker/internal/radios/` - streaming NDJSON(.gz) loader, even-odd ray casting over all rings, 0.05 deg grid `map[int64][]int32` with "grandes" list for bbox > 400 cells, nearest-edge fallback 25 m (AD-9).
- [ ] 3.4 RED: handler tests for `POST /v1/radio` in the worker http package: 200 `{codigoRadio}`, 400 ENTRADA_INVALIDA (bad JSON / out-of-range lat/lng), 404 RADIO_NO_ENCONTRADO, 503 RADIOS_NO_DISPONIBLES (nil index), 405 other methods; 4 KiB body cap (AD-10).
- [ ] 3.5 GREEN: add the handler and route; add `--radios` flag to `serve` (missing/failed asset logs a WARN and never blocks serve, index nil -> 503).
- [ ] 3.6 Dockerfile: copy only the radios asset (or fetch-with-SHA if the gate chose a Release asset), add `--radios` to the exec-form entrypoint. `go test ./...` and `go vet ./...`.
- [ ] 3.7 Verify: `docker compose up --build -d worker`; `docker compose exec worker` POST `/v1/radio` with an Argentine coordinate -> 9-digit code, with (0,0) -> 404; observe RAM (~16-32 MB expected).
- [ ] 3.8 Docs: worker README (new endpoint, `--radios`, asset regeneration with `make mapa-radios`), `scripts/mapa/README.md` (radios.sql).
- [ ] 3.9 Commits: `feat(worker): add radios index with point-in-polygon lookup`; `feat(worker): expose POST /v1/radio`; `build(worker): ship radios asset`; `docs(worker): document radio lookup`. Mark the generated asset as excluded from the review count.

## Phase 4: PR3 - MS radio resolution on create/edit and backfill (Unit 4)

- [ ] 4.1 RED: `HttpRadioCensalClientTest` with `MockRestServiceServer`: 200 -> `Optional.of(code)`, 404 -> empty, 500/timeout -> empty, never throws (AD-11). Under `jar_hornero_ms/src/test/java/.../organizacion/radio/`.
- [ ] 4.2 GREEN: create package `org.example.organizacion.radio` in `jar_hornero_ms/src/main/java/`: `RadioCensalClient` (`Optional<String> resolver(lat, lng)`), `HttpRadioCensalClient` (connect 1s, read 2s), `NoConfiguradoRadioCensalClient`, `RadioCensalConfig` on `app.worker.url` (pattern of `AsignadorConfig`).
- [ ] 4.3 RED: `OrganizacionServiceTest` additions - crear with both coords resolves and saves radio; worker down/empty -> saved with null radio ("Worker down does not block saving"); editar with changed lat/lng refreshes (or nulls) radio ("Edit to new coordinates refreshes"); editar with unchanged coords does not call the client (AD-12).
- [ ] 4.4 GREEN: modify `OrganizacionService` (`crear`, `editar`) to resolve synchronously before save, only when coords are set/changed; failure -> `codigo_radio` null, never blocks.
- [ ] 4.5 RED: `RadioCensalBackfillJobTest` 1-2 tests - fills only orgs with coords and null radio, leaves existing radios untouched; a failing resolution leaves the org null and continues ("Backfill fills only missing radios").
- [ ] 4.6 GREEN: create `RadioCensalBackfillJob` (`@Scheduled` cron default `0 15 * * * *`, enabled flag property, max 500 per run, per-row `TransactionTemplate`, skips optimistic-lock conflicts) (AD-13). Add properties with defaults to `jar_hornero_ms/src/main/resources/application.properties`.
- [ ] 4.7 Verify on `make up-local`: create an org with coordinates via BFF -> `codigo_radio` set; stop worker -> create succeeds with null; restart, wait/trigger backfill run (property temporarily set to a short cron through env, not committed) -> filled. Full `mvn test`.
- [ ] 4.8 Docs: `docs/mapa-vulnerabilidad.md` (resolution on create/edit, backfill), `docs/db-changes.md` (no schema change, note), `docs/acciones-pendientes-equipo.md` (Pi deploy steps: `make migrate` for V011, `make importar-poblacion`, deploy PR1 + PR2a together, then PR2b, then PR3; backfill runs hourly).
- [ ] 4.9 Commits: `feat(ms): add radio censal client`; `feat(ms): resolve radio on organizacion create and edit`; `feat(ms): backfill missing radios hourly`; `docs: add Pi deploy steps for live rondas`.

## Phase 5: Final verification

- [ ] 5.1 After the last PR is on the target branch, with `make up-local` running: `make e2e` once. Fix only regressions caused by this change.
- [ ] 5.2 Per-service sanity: `mvn test` (MS), `go test ./... && go vet ./...` (worker). Report observed results honestly in the apply report.
