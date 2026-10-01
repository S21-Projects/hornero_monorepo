# Design: Tesis Core Features

Engram mirror: `sdd/tesis-core-features/design`. Inputs: `proposal.md`, `explore.md`, `specs/*`,
Engram `sdd/tesis-core-features/decisions` (#707), `decisions-2` (#709) and `decisions-3` (#712).
Revision 2 (design gate correction): AD-10 accepted (decision 12); AD-12 redesigned so file access is
bound to an existing evidence row (decision 13); audit `nivel` filter, compliance treatment of
cancellations and the Nueva donación entry point fixed per decision 14. Where a spec text still
disagrees with a decision, the section "Spec alignment" at the end lists it.

Services touched: `jar_hornero_ms`, `ts_hornero_bff`, `ts_hornero_admin`, `go_algorithms_worker`
(becomes a live compose service), `docker-compose.yml`, `scripts/sql/` (new), docs.
`ts_hornero_astro` and `ts_hornero_app` are untouched.

## Technical Approach

Six work units, fifteen slices, delivered in the proposal's order. The design keeps each pillar on
the patterns the codebase already has instead of introducing new infrastructure:

- **Delivery code (slice 3)** is a second, donation-scoped copy of the `OtpService` lifecycle
  (BCrypt hash, TTL, attempts, throttle, invalidate-on-reissue) behind its own entity and endpoints.
  The two confirmation timestamps that already exist on `Donacion` stay the source of truth; the
  code only changes *how* a party earns its timestamp.
- **Fondo común (slice 5)** is modelled so that an assigned pool donation looks exactly like a direct
  donation: the ronda **writes the chosen `necesidad` onto the `Donacion`**. `necesidad` is `null`
  only while the donation waits in the pool. Every existing referente-side query, ownership check
  and `confirmarEntrega` path keeps working unchanged for assigned donations; the `Asignacion` row
  is the audit/explainability record, not a second pointer the code has to follow.
- **Worker transport** is an HTTP endpoint in a new, internal-only compose service. The same
  transport-independent contract function backs both the existing CLI and the HTTP handler.
- **Coverage deficit** is resolved *inside the worker* at ronda time, from the RENACOM dataset it
  already owns. The MS never learns about census radios.
- **No new `EstadoDonacion` value.** The "Asignación" progress step is a derived `fase`, which also
  avoids the known `donaciones_estado_check` trap (`docs/db-changes.md`).
- **One hand-written SQL script** (`necesidad_id DROP NOT NULL`), Flyway-compatible naming, run by
  hand on the Pi, with a runtime guard so a forgotten script degrades to a clear 503 instead of a
  500.

## Architecture Decisions

### AD-1: Worker ↔ MS transport — HTTP endpoint in an internal worker container

**Choice**: `go_algorithms_worker` gains a `serve` subcommand (stdlib `net/http`, no framework)
exposing `POST /v1/ronda` and `GET /healthz`. It runs as a new compose service `worker` on the
`hornero` network with **no host port**. The MS calls it through a `AsignadorClient` interface
implemented with Spring's `RestClient` (already used by `ResendClient`), connect timeout 2 s, read
timeout 30 s. The MS does **not** `depends_on` the worker: the MS boots and serves everything else
when the worker is down; only `POST /api/rondas` answers `503 WORKER_NO_DISPONIBLE`.

**Alternatives considered**:

| Option | Why rejected |
|---|---|
| B. MS execs a bundled Go binary (subprocess) | Couples two toolchains in the MS image (multi-stage Go + Maven build), puts process lifecycle, stdout/stderr parsing and timeouts in Java, and makes `mvn test` either depend on a built Go binary or mock `ProcessBuilder`. Also needs the RENACOM CSV copied into the MS image. |
| C. BFF calls or spawns the worker | Violates the documented layering: the BFF holds no domain logic, and the ronda needs MS-owned data (pool, candidates, history) and must persist `Asignacion` in the MS. |
| D. DB-mediated job (MS writes a request row, worker polls) | Needs a job status model, polling in the SPA, a Postgres driver in the worker and write access to the domain DB from a second process. All of that for an operation an admin triggers by hand and that completes in milliseconds. |
| E. File/queue handoff (shared volume or a broker) | A broker is a new always-on dependency on the Pi; a shared volume reintroduces polling and file-locking problems with no benefit over HTTP. |
| F. Port the solver to Java | Discards the tested solver and its brute-force oracle, and moves the geo/RENACOM ownership into the MS against the geo-metrics decision. |

**Rationale**: HTTP is the only option where each side is tested with its own native runner and no
cross-toolchain fixture: Go tests the handler with `httptest`, the MS tests the client with
`MockRestServiceServer` and the ronda service with a fake `AsignadorClient`. The cost on the Pi 5 is
one idle static Go binary (single-digit MB RSS), which is negligible next to the JVM and Postgres.
Keeping the worker as a long-lived process also lets it load RENACOM once at startup (needed by
AD-2) instead of on every call. The CLI (`algorithms assign --input`) is kept and calls the same
contract function, so the batch/offline usage documented in `main.go` still works.

### AD-2: Coverage deficit is resolved inside the worker at ronda time

**Choice**: the worker loads `data/renacom.csv` (baked into its image) and, optionally, a census
population CSV (`POBLACION_CSV` env, mounted when it exists) once at startup, and builds:

1. `deficitPorRadio map[codigoRadio]float64` via the existing `metrics.Agregar`;
2. a flat slice of precise RENACOM points (`Georreferenciacion <= 5`, i.e. not `PrecisionDudosa`).

For each candidate in a ronda request, the deficit is resolved in this order and the source is
reported back per assignment as `deficitFuente`:

| Order | Condition | Deficit used | `deficitFuente` |
|---|---|---|---|
| 1 | request carries `deficit` | that value | `PROVISTO` |
| 2 | request carries `codigoRadio` known to the table and its deficit > 0 | radio deficit | `RADIO` |
| 3 | nearest precise RENACOM point within `radioResolucionKm` (default 1.0 km) whose radio has deficit > 0 | that radio's deficit | `CERCANO` |
| 4 | otherwise | `1.0` (the median by definition) | `NEUTRAL` |

The MS sends neither `deficit` nor `codigoRadio` today (both optional in the contract); they exist so
a future producer (e.g. a persisted org radio) can override without a contract change.

**Alternatives considered**:
- *MS stores `codigoRadio`/`deficit` on `Organizacion`, fed by a scheduled `metrics` export.* Adds a
  table, a batch job, a write path from the worker (or a manual import) and still needs the same
  nearest-point resolution to assign each Hornero org a radio. Rejected for now; the contract's
  optional `codigoRadio`/`deficit` fields keep this door open.
- *PostGIS point-in-polygon in the MS.* Already rejected by the geo-metrics decision (no PostGIS on
  the Pi, `ddl-auto` cannot manage `geometry`).
- *Neutral deficit everywhere.* Honest but discards the thesis pillar; it is the fallback (row 4), not
  the design.

**Rationale**: the worker already owns the geo dataset and the metric definition; resolving there
keeps one owner. A linear nearest-neighbour scan over ~2,700 points × ~100 candidates is trivial, so
no spatial index is needed. **Known limitation, documented in the spec and the thesis**: until the
INDEC population CSV exists every radio has deficit 0, so every candidate resolves to `NEUTRAL` and
the deficit term is a constant (it does not distort ranking, it just contributes nothing). The
nearest-comedor radio is an approximation of the org's own radio; `deficitFuente` makes that
visible in the score breakdown.

### AD-3: An assigned pool donation carries its `necesidad`; `Asignacion` is the audit record

**Choice**: when a ronda assigns donation *D* to necesidad *N*, the MS sets `D.necesidad = N` (state
stays `OFRECIDA`) and inserts an `Asignacion` row (`estado = PROPUESTA`). Consequences:

- `necesidad` is `null` **only** for a `FONDO_COMUN` donation waiting in the pool (`fase = EN_FONDO`).
- Referente accept (`decidir ACEPTADA`) works unchanged; the vigente `Asignacion` → `ACEPTADA`.
- Referente reject on a `FONDO_COMUN` donation does **not** go to `RECHAZADA`: it is a *devolución
  al fondo* — `D.necesidad = null`, state stays `OFRECIDA`, `Asignacion` → `RECHAZADA`. The next
  ronda excludes that organizacion for that donation (`organizacionesExcluidas` in the contract).
- Donante cancel (`OFRECIDA → CANCELADA`, existing path) resolves a vigente `Asignacion` → `CANCELADA`.
- `FONDO_COMUN` donations cannot be deleted (`DELETE` → `409 USAR_CANCELACION`); cancelling keeps the
  ronda audit trail intact and avoids FK violations from `asignaciones`.

**Alternatives considered**: keep `necesidad` null forever and resolve the receiving
organizacion/referente through the latest `Asignacion` everywhere. Rejected: every org-scoped query
(`findByOrganizacion_Referente_Id`, `findByOrganizacionId`), `decidir`, `confirmarEntrega`, the
delivery code and `toResponse` would need a second resolution path, and the two could drift.

**Rationale**: a single source of truth for "which organizacion receives this donation" — the
`necesidad` — keeps slice 5b's null-safety surface to the pool-waiting case only. `Asignacion` still
stores `necesidad_id` and `organizacion_id` for history, because the donation's `necesidad` changes
on devolución.

**Gotcha pinned by a RED test**: `Necesidad.donaciones` is `@OneToMany(cascade = ALL, orphanRemoval =
true)`. The devolución MUST only null the owning side (`donacion.setNecesidad(null)`) and MUST NOT
remove the donation from `necesidad.getDonaciones()`, or Hibernate deletes the row.

### AD-4: No new `EstadoDonacion`; the progress step is a derived `fase`

**Choice**: `EstadoDonacion` is unchanged. The MS computes a read-only `fase` in `toResponse`:

| `modalidad` | `estado` | `necesidad` | `fase` | Progress step (SPA) |
|---|---|---|---|---|
| FONDO_COMUN | OFRECIDA | null | `EN_FONDO` | 1 Ofrecida |
| FONDO_COMUN | OFRECIDA | set | `ASIGNADA` | 2 Asignación |
| DIRECTA | OFRECIDA | set | `OFRECIDA` | 1 Ofrecida |
| any | ACEPTADA | set | `ACEPTADA` | 2 Asignación / Aceptada |
| any | EN_CAMINO | set | `EN_CAMINO` | 3 En camino |
| any | PENDIENTE_CONFIRMACION | set | `CONFIRMANDO` | 3 En camino (confirming) |
| any | ENTREGADA | set | `ENTREGADA` | 4 Entregada |
| any | RECHAZADA / CANCELADA | any | same as estado | terminal banner |

**Alternatives considered**: a new `EstadoDonacion.ASIGNADA`. Rejected: Hibernate created
`donaciones_estado_check` from the enum and `ddl-auto=update` never alters it, so a new value needs
a second hand-written script (precedent: `docs/db-changes.md` 2026-07-30); it also forks
`decidir`/`NO_TERMINALES`/`findActivas` logic for a distinction that data already expresses.

**Rationale**: zero schema risk, one place computes the phase, and the SPA never re-derives it.

### AD-5: One coordinated transition table, modalidad-aware

**Choice**: extract the static map into `org.example.donacion.TransicionesDonacion` with
`validar(ModalidadDonacion, EstadoDonacion desde, EstadoDonacion hacia)`. Slice 3a adds the delivery
entries; slice 5b adds the modalidad rule. Final table:

| From | To | Who / how | Modalidad |
|---|---|---|---|
| OFRECIDA | ACEPTADA | referente `decidir` | both (FONDO_COMUN only when `necesidad` set) |
| OFRECIDA | RECHAZADA | referente `decidir` | DIRECTA only |
| OFRECIDA | OFRECIDA (devolución) | referente `decidir RECHAZADA` | FONDO_COMUN only — not a state change, handled by `devolverAlFondo` |
| OFRECIDA | CANCELADA | donante | both |
| ACEPTADA | EN_CAMINO | donante | both |
| ACEPTADA | CANCELADA | donante | both |
| ACEPTADA | PENDIENTE_CONFIRMACION | first code verification (3a) | both |
| EN_CAMINO | PENDIENTE_CONFIRMACION | first code verification (3a) | both |
| EN_CAMINO | CANCELADA | donante | both |
| PENDIENTE_CONFIRMACION | ENTREGADA | second code verification (3a) | both |

`overrideEstado` (ADMINISTRADOR) stays outside the table exactly as today. `confirmarEntrega` (the
old button path) is migrated onto the table in 3a with identical behaviour and deleted in 3c.

**Receiving-referente resolution** becomes one null-safe helper,
`ParticipantesDonacion.parteDe(Donacion, Long actorId) → Optional<ParteDonacion>` (`DONANTE` |
`REFERENTE`), used by `decidir`, the delivery code and (until 3c) `confirmarEntrega`. A donation with
`necesidad == null` has no referente party, so every referente action on it is `403`, never an NPE.
This is the fix for `DonacionService.java:157`.

### AD-6: Delivery code — a donation-scoped copy of the OTP pattern

**Choice**: new package `org.example.donacion.entrega`:

- `CodigoEntrega` entity, table `codigos_entrega`: `id`, `donacion_id` (FK), `emisor_id`,
  `emisor_parte` (`DONANTE`|`REFERENTE`), `codigo_hash`, `expira_en`, `intentos`, `usado`,
  `creado_en`. Only the BCrypt hash is persisted.
- `CodigoEntregaThrottle`: same algorithm as `OtpThrottle` (sliding window + cooldown, in memory,
  `@Scheduled` sweep), keyed by `donacionId:emisorId`, config under `app.entrega.*`.
- `EntregaService`: `generar`, `verificar`, `estado`.
- `EntregaController` at `/api/donaciones/{id}/entrega`.

Config (`application.yml`):

```yaml
app:
  entrega:
    ttl-minutes: 10          # decision 11
    max-attempts: 5
    generar-max: 5
    generar-window-minutes: 15
    generar-cooldown-seconds: 30
```

Rules:
- `generar`: actor must be a party (`ParticipantesDonacion`); estado ∈ {ACEPTADA, EN_CAMINO,
  PENDIENTE_CONFIRMACION}; `409 YA_CONFIRMADO` if the counterpart already validated this party's
  code; throttle (`429 ESPERA_ANTES_DE_REENVIAR`); marks every unused code of this emisor for this
  donation `usado = true` (**immediate invalidation**, decision 3); returns the plaintext once.
- `verificar(codigo)`: loads the donation with `PESSIMISTIC_WRITE`; looks up the newest unused code
  issued by the **other** party; none → `400 CODIGO_INVALIDO`; expired → burn + `410
  CODIGO_EXPIRADO`; mismatch → `intentos++`, at `max-attempts` burn + `429 DEMASIADOS_INTENTOS`,
  else `400 CODIGO_INVALIDO`; match → burn, set the *verifier's* confirmation timestamp
  (`confirmadaDonanteEn` when the donante validated the referente's code, and vice versa), then
  transition via the table: first confirmation → `PENDIENTE_CONFIRMACION`, second → `ENTREGADA` +
  `fechaEntrega`. Re-verifying after one's own confirmation is an idempotent `200` with the current
  state (mirrors today's `confirmarEntrega`).
- The row lock is required: without it, two parties verifying at the same moment each read "the
  other has not confirmed" and the donation stays `PENDIENTE_CONFIRMACION` forever.

**QR payload**: `HORNERO-ENTREGA:{donacionId}:{codigo}` — still the same 6-digit OTP (decision 3),
wrapped so the scanner can reject a code from a different donation *before* spending an attempt. The
typed fallback accepts the bare 6 digits; the SPA parser accepts both forms.

**Brute-force bound**: 5 attempts per code × at most 5 codes per 15 min per emisor ⇒ ≤ 25 guesses per
15 min over a 10⁶ space, and only an authenticated counterpart of that specific donation can guess.

**Alternatives considered**: extract a generic `CodigoTemporalService` shared with `OtpService` now.
Rejected per proposal: the lifecycles differ (per email vs per donation+party, mail delivery vs
screen display, verifier ≠ issuer); extract only if a third consumer appears. Reusing the `OtpThrottle`
bean with a second qualifier was also rejected because it would force a `@Qualifier` change into
`OtpService`'s working injection for a 60-line class.

### AD-7: QR rendering and scanning in the admin SPA

**Choice**:
- **Render**: `qrcode.react` (`QRCodeSVG`) — React component, SVG output (renders in jsdom tests, no
  canvas), small.
- **Scan**: `qr-scanner` (nimiq) behind a local adapter `src/lib/qr/escanearQr.ts`
  (`iniciar(video, onPayload) → detener()`), loaded with a dynamic `import()` only when the user taps
  "Escanear código". It uses the native `BarcodeDetector` when present and falls back to its own
  worker-based decoder, covering iOS Safari where `BarcodeDetector` is missing.
- **Typed fallback always rendered** (not only on error): 6-digit input, `inputMode="numeric"`,
  `autoComplete="one-time-code"`.
- Camera needs a secure context: production is HTTPS through Cloudflare, local dev is
  `http://localhost` (treated as secure). Permission denied or no camera ⇒ the scan button shows the
  reason and the typed input stays usable.

**Alternatives considered**: `@zxing/browser` (heavier, no native fast path), `html5-qrcode` (bundles
its own UI, weak maintenance), `barcode-detector` ponyfill (standards API but ships a zxing-wasm
payload). **Verify at apply time** (versions, React 19 peer range, MIT license, last release); if
`qr-scanner` turns out unmaintained, swap to the `barcode-detector` ponyfill inside the same adapter —
no screen code changes. Tests mock the adapter module (`vi.mock`), never the camera.

### AD-8: Cross-org audit queue — dedicated root path, one JPQL query, offset pagination

**Choice**: `GET /api/auditoria/evidencias?tab=PENDIENTES|VENCIDAS&nivel=&requisito=&tipoEvidencia=&page=&size=&sort=`
in a new `AuditoriaController` (package `org.example.acreditacion`). Returns `PageData<EvidenciaEnColaResponse>`
through the existing `ApiResponse` envelope (`docs/pagination-rest-endpoints.md`).

- **Path**: deliberately **not** under `/api/organizaciones/**`, which has a `GET permitAll` matcher
  in `SecurityConfig`; a new root avoids relying on matcher ordering. Still, an explicit
  `.requestMatchers("/api/auditoria/**").hasRole("ADMINISTRADOR")` is added, plus `@PreAuthorize`.
- **Tabs**: `PENDIENTES` = `estado = PENDIENTE`. `VENCIDAS` = `estado = APROBADA AND validoHasta <
  :hoy` (the record-and-warn expiry, `OrganizacionEvidencia.isExpirada`), `REEMPLAZADA` excluded.
- **Filters**: `requisito` and `tipoEvidencia` are direct equality. `nivel` is resolved in Java to the
  set of `RequisitoAcreditacion` whose `nivelExigido == nivel`, then passed as `requisito IN
  :requisitos` (the query always receives a non-empty collection — all values when unfiltered — to
  avoid null-collection binding issues). **Decided (decision 14, matches spec
  `auditoria-cola-global`)**: `nivel` means the level the requisito requires
  (`RequisitoAcreditacion.nivelExigido`), not the organizacion's current level. The organizacion's
  own level is still shown per row (`organizacionNivel`) but is not a filter.
- **Query**: a `@Query` finder `buscarCola(...)` on `OrganizacionEvidenciaRepository` with `JOIN FETCH
  e.organizacion o` and an explicit `countQuery`, following `DonacionRepository.findActivas`. Default
  sort `cargadoEn ASC` (oldest first). It is a read, so the append-only reflection test
  (`OrganizacionEvidenciaRepositoryTest`, forbids `delete*`/`saveAndFlush`) stays green.
- **Response**: `EvidenciaEnColaResponse` = the `EvidenciaResponse` fields + `organizacionNombre`,
  `organizacionNivel`.

**Alternatives considered**: `JpaSpecificationExecutor` — rejected because it inherits
`delete(Specification)`, contradicting the repository's documented append-only contract. Client-side
filtering over the per-org endpoint — rejected by decision 5 (server pagination + filters).

### AD-9: Ronda orchestration, concurrency and idempotency

**Choice**: `RondaService.ejecutar(adminId)`:

1. `ReentrantLock.tryLock()` (the MS is a single instance on the Pi) → else `409 RONDA_EN_CURSO`.
2. Read transaction: pool = `modalidad = FONDO_COMUN AND estado = OFRECIDA AND necesidad IS NULL`;
   candidates = necesidades `ABIERTA|EN_PROGRESO`, not past `fechaVencimiento`, organizacion with
   `nivel >= N1`, a referente, and non-null coordinates; per-org `diasDesdeUltimaDonacion`, per-org
   compliance counts (6b), per-donation exclusions (rejected assignments). Build `EntradaRondaV1`.
3. Call the worker **outside** any transaction.
4. Write transaction: insert `Ronda`; for each returned assignment, lock the donation
   (`PESSIMISTIC_WRITE`), re-check it is still `OFRECIDA` with `necesidad IS NULL` and the necesidad
   still open; if so set `necesidad` and insert `Asignacion(PROPUESTA)`, else count it as
   `descartadas` (donante cancelled mid-call). Update ronda counters, `estado = COMPLETADA`.
5. Worker error/timeout/invalid response ⇒ persist `Ronda(estado = FALLIDA, error)` and answer `503
   WORKER_NO_DISPONIBLE` (or `502 RESPUESTA_WORKER_INVALIDA`); nothing is assigned.

Every run is persisted, including empty ones, so the thesis can show a complete audit trail. A
second click is harmless: already-assigned donations are no longer in the pool.

**MS-side hard filters (not delegated to the worker)**: N0 organizaciones are excluded in the
candidate query, because the worker treats an empty `categoriasPermitidas` as "uncapped" and
`AcreditacionService.categoriasPermitidas(N0)` is empty. RED test pins this.

**Input derivations (MS)**:
- `urgencia = max(base(prioridad), vencimiento)`, `base`: URGENTE 1.0, MEDIA 0.6, NORMAL 0.3;
  `vencimiento = clamp(1 − díasHastaVencimiento / 30, 0, 1)`, 0 when no `fechaVencimiento`. One
  class, `UrgenciaCalculator`; spec may tune constants.
- `diasDesdeUltimaDonacion`: days since the latest `fechaOferta` of any donation (direct **or**
  pool) to the org's necesidades not in `CANCELADA|RECHAZADA`; no history ⇒ `esperaMaximaDias` (90,
  saturates).
- `categoriasAceptadas = [necesidad.categoria]` when set, else empty (anything).
- `categoriasPermitidas = AcreditacionService.categoriasPermitidas(org.nivel)`.
- `diasEnFondo` per donation = days since `fechaOferta`; `organizacionesExcluidas` = orgs with a
  `RECHAZADA` asignación for that donation.

### AD-10: Donation wait honoured as a "cost of leaving unassigned" (decision 10)

**Choice**: decision 10 says the espera term should prioritise long-waiting pool donations, but the
current `espera` term is per *organizacion* (anti-starvation of comedores). Rather than overload it,
the solver gains a per-donation **unassignment penalty**: one dummy column per donation, cost
`PenalizacionNoAsignar × min(diasEnFondo / esperaMaximaDias, 1)` for its own row and `Inf` for the
others. Feasible pairs are still preferred (their cost is a negative score); under contention the
older donation wins the scarce necesidad. Default `penalizacionNoAsignar = 0.10`.

**Alternatives considered**: a sixth weighted term inside `Score` — rejected because a per-row
constant would inflate every pair's score and blur the per-pair breakdown shown to donantes; FIFO
pre-filtering of the pool — rejected, it discards the global optimum.

**Rationale**: the per-pair `desglose` stays exactly the published criteria; the penalty only
decides *who* gets assigned when there is not enough for everyone. With `penalizacionNoAsignar = 0`
the result equals today's solver (property-tested).

**Status: accepted (decision 12).** The user confirmed the per-donation unassignment penalty
(deterministic anti-starvation growing with wait time) is in scope. Its tests stay in slice 5a:
penalty 0 reproduces the old solver; under contention the older donation wins.

### AD-11: Compliance term (slice 6) — raw counts from the MS, rate and prior in the worker

**Choice**: the MS sends `cumplimiento: {entregadas, fallidas}` per candidate (6b). The worker (6a)
computes a smoothed rate:

```
p0   = Σentregadas / Σ(entregadas+fallidas) over candidates in this ronda  (0.5 if Σ = 0)
tasa = (entregadas + m·p0) / (entregadas + fallidas + m)                    m = 5 pseudo-observations
```

An organizacion without history scores `p0` — the platform average in this ronda — so it is neither
favoured nor penalised (the "neutral prior"). Candidates without the field (5c before 6b) also get
`p0`. `Pesos` gains `Cumplimiento`; `Pesos.Normalizados()` divides by the sum, so any configuration
sums to 1 and `Cumplimiento = 0` reproduces the four-term score exactly. Defaults: deficit 0.30,
urgencia 0.25, proximidad 0.17, espera 0.13, cumplimiento 0.15 (spec may tune). Accreditation stays
a hard filter in `acepta()`.

The classification of states lives in one MS method, `CumplimientoCalculator`:

| Donation estado | Counted as | Why |
|---|---|---|
| `ENTREGADA` | entregada | delivered |
| `RECHAZADA` | fallida | the organizacion's referente refused it (`decidir`, DIRECTA only) |
| `CANCELADA` | **not counted** (neither numerator nor denominator) | decision 14: donante-initiated cancellations do not count against the organizacion |
| any non-terminal | not counted | in flight |

Rationale for excluding every `CANCELADA`: in the AD-5 transition table every `→ CANCELADA` edge is
a donante action; the only other source is the rare ADMINISTRADOR `overrideEstado`, and donations
carry no transition history to tell the two apart. Excluding the whole state is the only
classification the data supports without adding an audit column; adding a `canceladaPor` column
was rejected because it would only apply to future rows and the thesis signal would still be
mixed. Pool devoluciones (`Asignacion.RECHAZADA` while the donation stays `OFRECIDA`) are not a
donation terminal state and are not counted either — the signal is computed from `donacion` rows
only, as the spec requires. The aggregate query therefore groups only
`estado IN (ENTREGADA, RECHAZADA)`.

### AD-12: Evidence-file access bound to an evidence row (MS authorizes); SPA reads via axios blobs

**Decision 13 (spec `organizacion-evidencia` wins)**: the route MUST reject a syntactically valid
`org-evidencia/{orgId}/{file}` key that has no `OrganizacionEvidencia` row with that `objectKey` for
that organizacion (404), for admins and owning referentes alike. Today
`ts_hornero_bff/src/evidencia-files/evidencia-files.controller.ts` (lines 45-59) only checks org
ownership via `misOrganizaciones` and streams any key under the prefix.

**Choice — the MS resolves and authorizes the key in one call.** New MS endpoint:

```
GET /api/organizaciones/{id}/acreditacion/evidencias/archivo?objectKey=org-evidencia/{id}/{filename}
  204  row exists for (organizacion.id = {id}, objectKey = key)        — caller may stream it
  400  EVIDENCIA_CLAVE_INVALIDA  key does not start with "org-evidencia/{id}/" or contains "/" or ".." after it
  403  caller is neither ADMINISTRADOR nor the owning REFERENTE (existing requireAdminOrOwningReferente)
  404  EVIDENCIA_NO_ENCONTRADA   no matching row (any estado, REEMPLAZADA included — legajo history)
```

- Lives in `AcreditacionController` (`@PreAuthorize("hasAnyRole('ADMINISTRADOR','REFERENTE')")` +
  `requireAdminOrOwningReferente(id)`), delegating to `AcreditacionService.existeArchivoEvidencia`.
- `OrganizacionEvidenciaRepository` gains `boolean existsByOrganizacion_IdAndObjectKey(Long, String)`.
  It is a read: the append-only reflection test (`OrganizacionEvidenciaRepositoryTest`, forbids
  `delete*`/`saveAndFlush`) stays green.
- `SecurityConfig` needs **no change**: `/api/organizaciones/*/acreditacion/**` is already
  `.authenticated()` and declared before the `GET /api/organizaciones/**` permitAll block.
- BFF `EvidenciaFilesController.serve` builds the key, calls
  `AcreditacionService.verificarArchivoEvidencia(orgId, key, token)` (Bearer from the cookie, as every
  write proxy does) **for every role**, maps MS `403 → ForbiddenException`, `404 → NotFoundException`,
  `400 → BadRequestException`, and only then calls `imagesService.getObject(key)`. The
  `misOrganizaciones` ownership check is **removed** from the BFF: the MS check is strictly stronger
  (ownership + row) and is the real authority per the three-layer model; the BFF keeps its
  `@Roles(REFERENTE, ADMINISTRADOR)` gate. `AcreditacionModule` exports `AcreditacionService`;
  `EvidenciaFilesModule` imports `AcreditacionModule` instead of `OrganizacionesModule`.

**Alternatives considered**:

| Option | Tradeoff | Verdict |
|---|---|---|
| A. New MS endpoint that authorizes + resolves the key (chosen) | One extra MS endpoint (~40 lines) and one indexed `exists` query; one BFF→MS round trip replaces today's `misOrganizaciones` round trip, so latency is unchanged; the MS stays the single authority for both ownership and row binding | Chosen |
| B. BFF calls the existing `GET /api/organizaciones/{id}/acreditacion/evidencias` list and searches `objectKey` | No MS change beyond exposing `objectKey`, but that endpoint is **ADMINISTRADOR-only** (D-02), so owning referentes would get 403 on their own files; widening it leaks the full review state to referentes; it also transfers the whole list per file view | Rejected |
| C. BFF keeps `misOrganizaciones` and adds the row check through B or A | Two MS round trips per file for referentes, and the ownership rule stays duplicated in two layers | Rejected |

**SPA side (unchanged decision)**: `useEvidenciaArchivo(evidencia)` fetches `/evidencia-files/{orgId}/{filename}` with the
shared axios instance (`responseType: 'blob'`), creates an object URL and revokes it on unmount.
`EvidenciaArchivo` renders `<img>` for `image/*` and an "Abrir documento" link for other types.
The path is derived from `objectKey` with a strict parser (`^org-evidencia/(\d+)/([^/]+)$`, orgId must
equal `evidencia.organizacionId`); anything else renders "Archivo no disponible".

**Prerequisite discovered**: `EvidenciaResponse` (MS) does **not** expose `objectKey` today; slice 2
adds it (additive field, BFF passes the body through untouched).

**SPA alternative considered**: `<img src="${VITE_BFF_URL}/evidencia-files/...">` relying on the
cookie. Rejected: it bypasses the 401 → refresh → retry interceptor, so any file viewed after 15
minutes breaks, and it cannot surface a 403/404 to the user. The hook maps both 403 and 404 to the
"Archivo no disponible" state.

### AD-13: Hand-written SQL scripts — location, naming, run procedure, runtime guard

**Choice**:
- Location `scripts/sql/`, naming `V{NNN}__{snake_description}.sql` (Flyway-compatible, so a future
  Flyway baseline can adopt the directory unchanged). First script:
  `scripts/sql/V001__donaciones_necesidad_id_nullable.sql`.
- Every script is idempotent and transactional:

  ```sql
  -- V001: allow fondo común donations without a necesidad (tesis-core-features slice 5b)
  BEGIN;
  ALTER TABLE donaciones ALTER COLUMN necesidad_id DROP NOT NULL;  -- no-op if already nullable
  COMMIT;
  ```

- `scripts/sql/README.md` documents the convention; each script also gets an entry in the existing
  `docs/db-changes.md` log (Reason / Before / Migration / After / Rollback / Applied to).
- **Run procedure on the Pi** (added to `docs/deploy-rpi-cloudflare.md` as a pre-deploy step for 5b),
  from the repo root, before `docker compose up --build -d`:

  ```bash
  docker compose exec -T postgres pg_dump -U "$DB_USERNAME" "$DB_NAME" | gzip > backup_$(date +%F).sql.gz
  docker compose exec -T postgres psql -U "$DB_USERNAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    < scripts/sql/V001__donaciones_necesidad_id_nullable.sql
  docker compose exec -T postgres psql -U "$DB_USERNAME" -d "$DB_NAME" -c '\d donaciones'
  ```

  Running it before the new MS is safe: the old code never writes `NULL`.
- **Runtime guard**: `EsquemaVerificador` (`ApplicationRunner`, PostgreSQL only — skipped on H2)
  reads `information_schema.columns.is_nullable` for `donaciones.necesidad_id` at boot. If still `NO`
  it logs an `ERROR` naming the script, and `crear(FONDO_COMUN)` answers `503 ESQUEMA_PENDIENTE`
  instead of failing with a constraint-violation 500. `DIRECTA` keeps working.
- New columns (`modalidad`, `categoria`, `latitud`, `longitud` on `donaciones`) and new tables
  (`codigos_entrega`, `rondas`, `asignaciones`) are left to `ddl-auto=update`, nullable per the D4
  convention (`modalidad` null ⇒ read as `DIRECTA`, coalesced in the entity getter/`toResponse`).

**Alternatives considered**: Flyway now (out of scope by decision 4); scripts under
`jar_hornero_ms/src/main/resources/db/` (would look auto-applied and end up on the classpath);
fail-fast at boot when the script is missing (turns a forgotten step into a full outage on the Pi).

### AD-14: Worker contract v1 is versioned, additive-only, and lives in its own package

**Choice**: wire DTOs and validation live in `go_algorithms_worker/internal/contrato` and map onto
the unchanged solver types in `internal/assign` after deficit resolution (`internal/geo`). Request
carries `"version": 1`; an unknown major ⇒ `400 VERSION_NO_SOPORTADA`. v1 evolves only by adding
optional fields (5a → 6a adds `cumplimiento`, `pesos.cumplimiento`); a breaking change is `/v2/ronda`.
Validation: body ≤ 1 MiB (`http.MaxBytesReader`), ≤ 500 donaciones and ≤ 500 candidatos, finite
coordinates within range, known `categoria` vocabulary strings pass through untouched. Golden
fixtures `go_algorithms_worker/testdata/ronda-v1/{request,response}.json` are copied to
`jar_hornero_ms/src/test/resources/contract/` and both test suites assert against them; the contract
doc `go_algorithms_worker/contract/ronda-v1.md` states that the two copies change together.

**Rationale**: keeping `assign.Candidato.Deficit` a plain `float64` avoids churning the solver and its
oracle tests; "absent vs zero" is a wire concern handled in `contrato`.

## Data Flow

### Ronda (slices 5a–5d, 6b)

```
Admin SPA            BFF                     MS RondaService                         worker
   | POST /rondas      |                          |                                     |
   |------------------>| @Roles(ADMINISTRADOR)    |                                     |
   |                   | POST /api/rondas ------->| tryLock (else 409 RONDA_EN_CURSO)   |
   |                   |  (Bearer from cookie)    | tx read: pool, candidatos, dias,    |
   |                   |                          |   cumplimiento, exclusiones         |
   |                   |                          |-- POST /v1/ronda (EntradaRondaV1) ->|
   |                   |                          |                                     | validar
   |                   |                          |                                     | resolver deficit
   |                   |                          |                                     |   (RENACOM en memoria)
   |                   |                          |                                     | assign.Ronda + desglose
   |                   |                          |<------------- SalidaRondaV1 --------|
   |                   |                          | tx write: Ronda; por asignación:     |
   |                   |                          |   lock donación, re-check,          |
   |                   |                          |   donacion.necesidad = N,           |
   |                   |                          |   Asignacion(PROPUESTA)             |
   |                   |<-- 201 RondaResponse ----| unlock                              |
   |<------------------|                          |                                     |
```

### Pool donation lifecycle

```
crear(FONDO_COMUN, categoria, lat/lng) -> OFRECIDA, necesidad=null   fase EN_FONDO
        | ronda asigna                          ^
        v                                       | referente rechaza (devolución):
OFRECIDA, necesidad=N  fase ASIGNADA -----------+  necesidad=null, Asignacion RECHAZADA,
        | referente acepta                         org excluida para esta donación
        v
ACEPTADA -> EN_CAMINO -> PENDIENTE_CONFIRMACION -> ENTREGADA   (idéntico a DIRECTA)
donante puede cancelar en EN_FONDO / ASIGNADA / ACEPTADA / EN_CAMINO
```

### Delivery code (slices 3a–3c)

```
Donante phone                    MS (EntregaService)                  Referente phone
  | POST .../entrega/codigo  ---->| invalidate previous, hash, TTL 10m |
  |<--- {codigo, expiraEn, qr} ---|                                    |
  |  shows QR + digits            |                                    |
  |                               |<-- POST .../entrega/verificar -----| scans donante QR
  |                               | lock donación; match donante code  |
  |                               | confirmadaReferenteEn = now        |
  |                               | -> PENDIENTE_CONFIRMACION          |
  |                               |<-- POST .../entrega/codigo --------| generates own code
  |                               |---- {codigo, expiraEn, qr} ------->| shows QR
  | scans referente QR            |                                    |
  | POST .../entrega/verificar -->| lock; match referente code         |
  |                               | confirmadaDonanteEn = now          |
  |                               | -> ENTREGADA, fechaEntrega         |
  | GET .../entrega (poll 3 s) -->|  both screens poll status until ENTREGADA
```

Order of the two exchanges is free; either party may go first.

## File Changes

Paths abbreviated: `ms/` = `jar_hornero_ms/src/main/java/org/example/`, `mst/` =
`jar_hornero_ms/src/test/java/org/example/`, `bff/` = `ts_hornero_bff/src/`, `adm/` =
`ts_hornero_admin/src/`, `wk/` = `go_algorithms_worker/`.

### Slice 1 — Bienvenida (admin)

| File | Action | Description |
|---|---|---|
| `adm/routes/register.tsx` | Modify | New `Step 'acreditacion'` after successful org creation (REFERENTE only); step indicator shows 3 steps; donante flow untouched; `org-error` retry untouched |
| `adm/components/acreditacion/BienvenidaAcreditacion.tsx` | Create | Presentational N0..N3 ladder + CTA "Empezar con N1"; current level via `useAcreditacion(orgId)` |
| `adm/lib/acreditacion.ts` (or existing constants module) | Create/Modify | Static ladder copy per nivel (what each level unlocks) |
| `adm/app/ProtectedRoute.tsx` | Modify | `requireVerified` redirect passes `state={{ from: location.pathname }}` |
| `adm/routes/verify-email.tsx` | Modify | After success, navigate to `state.from` when it is an internal path, else `roleHome` — so the CTA lands on `/acreditacion` after the mandatory email verification |
| tests: `register.test.tsx`, `BienvenidaAcreditacion.test.tsx`, `ProtectedRoute.test.tsx`, verify-email test | Modify/Create | RED first |

### Slice 2 — Evidence files bound to evidence rows (MS + BFF + admin)

Estimated size: ~350-400 authored changed lines (MS ~110 incl. tests, BFF ~90 incl. spec rewrite,
admin ~180 incl. tests). Previous estimate without the row binding was ~250. It stays one slice; if
it overruns, the natural cut is 2a (MS + BFF row binding) / 2b (admin rendering).

| File | Action | Description |
|---|---|---|
| `ms/acreditacion/dto/EvidenciaResponse.java` | Modify | Add `objectKey` (additive) |
| `ms/domain/OrganizacionEvidenciaRepository.java` | Modify | `existsByOrganizacion_IdAndObjectKey(Long, String)` (read-only finder) |
| `ms/acreditacion/AcreditacionService.java` | Modify | `existeArchivoEvidencia(orgId, objectKey)`: prefix/traversal validation (400), row lookup (404) |
| `ms/acreditacion/AcreditacionController.java` | Modify | `GET /acreditacion/evidencias/archivo?objectKey=` → 204; `@PreAuthorize` ADMINISTRADOR/REFERENTE + `requireAdminOrOwningReferente` (403) |
| `mst/acreditacion/AcreditacionControllerTest` (or a new `EvidenciaArchivoTest`), `mst/domain/OrganizacionEvidenciaRepositoryTest` | Modify/Create | RED first — see Testing |
| `bff/acreditacion/acreditacion.service.ts` | Modify | `verificarArchivoEvidencia(orgId, objectKey, token)` → MS call with Bearer, relays 400/403/404 |
| `bff/acreditacion/acreditacion.module.ts` | Modify | `exports: [AcreditacionService]` |
| `bff/evidencia-files/evidencia-files.controller.ts` | Modify | Replace `assertOwnership`/`misOrganizaciones` with `verificarArchivoEvidencia` for every role before `getObject` |
| `bff/evidencia-files/evidencia-files.module.ts` | Modify | Import `AcreditacionModule` instead of `OrganizacionesModule` |
| `bff/evidencia-files/evidencia-files.controller.spec.ts`, `bff/acreditacion/acreditacion.service.spec.ts` | Modify | RED first — see Testing |
| `adm/types/domain.ts` | Modify | `objectKey?: string \| null` on evidencia types; remove stale "until Slice B" comment (lines 161-167) |
| `adm/lib/evidenciaArchivo.ts` | Create | Strict `objectKey` → `/evidencia-files/{orgId}/{filename}` parser |
| `adm/lib/hooks/useEvidenciaArchivo.ts` | Create | axios blob → object URL, revoke on unmount, maps 403/404 |
| `adm/components/acreditacion/EvidenciaArchivo.tsx` | Create | Image preview or "Abrir documento" link, unavailable state |
| `adm/components/acreditacion/AuditQueue.tsx`, `adm/routes/legajo.tsx`, `adm/routes/acreditacion.tsx` | Modify | Render `EvidenciaArchivo` for FOTO/DOCUMENTO rows |
| `bff/images/images.controller.ts` | Modify | Comment only: deny-list is defense in depth, the evidencia-files route is the supported path |

### Slice 3a — Delivery code backend (MS)

| File | Action | Description |
|---|---|---|
| `ms/donacion/TransicionesDonacion.java` | Create | Transition table (AD-5), delivery entries |
| `ms/donacion/ParticipantesDonacion.java` | Create | Null-safe party resolution |
| `ms/donacion/entrega/CodigoEntrega.java`, `CodigoEntregaRepository.java` | Create | Entity + repo (`findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc`, `findByDonacion_IdAndEmisorIdAndUsadoFalse`) |
| `ms/donacion/entrega/CodigoEntregaThrottle.java` | Create | Copy of `OtpThrottle` algorithm, `app.entrega.*` |
| `ms/donacion/entrega/EntregaService.java`, `EntregaController.java` | Create | `POST codigo`, `POST verificar`, `GET` estado |
| `ms/donacion/entrega/dto/*` | Create | `CodigoEntregaResponse`, `VerificarCodigoRequest`, `EntregaEstadoResponse` |
| `ms/domain/DonacionRepository.java` | Modify | `findByIdForUpdate` with `@Lock(PESSIMISTIC_WRITE)` |
| `ms/donacion/DonacionService.java` | Modify | Use `TransicionesDonacion` + `ParticipantesDonacion`; package-private `registrarConfirmacion(d, parte)` shared with `EntregaService`; `confirmarEntrega` kept, same behaviour |
| `ms/config/SecurityConfig.java` | Modify | `GET /api/donaciones/*/entrega` `.authenticated()` declared **before** the `GET /api/donaciones/**` permitAll |
| `jar_hornero_ms/src/main/resources/application.yml` | Modify | `app.entrega.*` |
| `mst/donacion/entrega/*Test.java`, `TransicionesDonacionTest`, security test | Create | See Testing |

### Slice 3b — Delivery code BFF

| File | Action | Description |
|---|---|---|
| `bff/donaciones/donaciones.controller.ts` | Modify | `POST :id/entrega/codigo`, `POST :id/entrega/verificar`, `GET :id/entrega` — `@Roles(DONANTE, REFERENTE)` |
| `bff/donaciones/donaciones.service.ts` | Modify | Three proxies with Bearer header |
| `bff/donaciones/dto/verificar-codigo.dto.ts` | Create | `codigo`: `@Matches(/^\d{6}$/)` |
| specs | Modify | controller/service specs |

### Slice 3c — Confirmation screen, button retired (admin + BFF + MS)

| File | Action | Description |
|---|---|---|
| `adm/routes/entrega.tsx` | Create | `/donaciones/:id/entrega`: QR (`QRCodeSVG`), digits, countdown, both parties' status, "Escanear código", "Generar código nuevo", typed input |
| `adm/components/entrega/*` | Create | `CodigoQr`, `EscanerQr` (lazy), `CodigoInput`, `EstadoConfirmacion`, `Countdown` |
| `adm/lib/qr/escanearQr.ts`, `adm/lib/qr/payload.ts` | Create | Scanner adapter (dynamic import) and payload parse/format |
| `adm/lib/hooks/useEntrega.ts` | Create | `useEstadoEntrega` (poll 3 s until ENTREGADA), `useGenerarCodigo`, `useVerificarCodigo` |
| `adm/app/router.tsx` | Modify | Route `allow={['DONANTE','REFERENTE']} requireVerified` |
| `adm/routes/mis-donaciones.tsx`, `adm/routes/dashboard.tsx` | Modify | Button replaced by "Confirmar entrega" link to the new route |
| `adm/lib/hooks/useConfirmarEntrega.ts` | Delete | Retired |
| `bff/donaciones/*` | Modify | Remove `confirmar-entrega` route + service method |
| `ms/donacion/DonacionController.java`, `DonacionService.java` | Modify | Remove `confirmar-entrega` endpoint and `confirmarEntrega` |
| `ts_hornero_admin/package.json` | Modify | `qrcode.react`, `qr-scanner` |

### Slice 4a — Cross-org audit queue backend (MS + BFF)

| File | Action | Description |
|---|---|---|
| `ms/acreditacion/AuditoriaController.java` | Create | `GET /api/auditoria/evidencias` |
| `ms/acreditacion/AcreditacionService.java` | Modify | `colaAuditoria(filtros, pageable)` incl. nivel → requisitos resolution |
| `ms/acreditacion/dto/EvidenciaEnColaResponse.java`, `dto/TabCola.java` | Create | Response + tab enum |
| `ms/domain/OrganizacionEvidenciaRepository.java` | Modify | `@Query buscarCola(...)` + `countQuery` |
| `ms/config/SecurityConfig.java` | Modify | `/api/auditoria/**` `hasRole("ADMINISTRADOR")` |
| `bff/acreditacion/acreditacion.controller.ts`, `acreditacion.service.ts` | Modify | `GET auditoria/evidencias` `@Roles(ADMINISTRADOR)`, whitelisted params through `buildQuery` (or a small `auditoria` controller in the same module) |

### Slice 4b — Cross-org audit queue screen (admin)

| File | Action | Description |
|---|---|---|
| `adm/routes/auditoria.tsx` | Create | Tabs Pendientes/Vencidas, filters, `PaginatedTable`/`Pager`, row → detail drawer |
| `adm/lib/hooks/useColaAuditoria.ts` | Create | Query key includes all filters + page/size, `keepPreviousData` |
| `adm/components/acreditacion/AuditQueue.tsx` | Reuse | Rendered in the drawer with `organizacionId` + `evidenciaIds=[id]` |
| `adm/lib/hooks/useAcreditacion.ts` | Modify | `useAuditarEvidencia` also invalidates `['auditoria','cola']` |
| `adm/app/router.tsx`, `adm/app/AppShell.tsx` | Modify | `/auditoria` under the ADMINISTRADOR block + nav entry |

### Slice 5a — Worker contract + HTTP entrypoint (worker, compose)

| File | Action | Description |
|---|---|---|
| `wk/internal/contrato/ronda_v1.go` | Create | Wire DTOs, validation, mapping to `assign` types |
| `wk/internal/geo/deficit.go` | Create | `ResolverDeficit` (AD-2 table), loaded once |
| `wk/internal/assign/scoring.go` | Modify | `ScoreDetallado` → `Desglose`; `Score` delegates |
| `wk/internal/assign/ronda.go` | Modify | `Asignacion.Desglose`; per-donation dummy columns with unassignment penalty (AD-10); `Donacion.DiasEnFondo`, `OrganizacionesExcluidas` hard filter |
| `wk/internal/api/handler.go` | Create | `POST /v1/ronda`, `GET /healthz`, size limit, error envelope `{error, detalle}` |
| `wk/main.go` | Modify | `serve --addr :8090 --data ... [--poblacion ...] [--provincia ...]`; `assign` CLI uses `contrato` |
| `wk/Dockerfile`, `wk/.dockerignore` | Create | `golang:1.26-alpine` build (`CGO_ENABLED=0`) → `alpine` runtime with `wget` for the healthcheck; copies `data/renacom.csv` |
| `wk/contract/ronda-v1.md`, `wk/testdata/ronda-v1/*.json` | Create | Contract doc + golden fixtures |
| `docker-compose.yml` | Modify | `worker` service: build `./go_algorithms_worker`, no `ports`, healthcheck `wget -qO- http://localhost:8090/healthz`, network `hornero`, optional `POBLACION_CSV` |
| `wk/README.md` | Modify | `serve` usage |

### Slice 5b — Pool schema + null safety (MS, SQL)

| File | Action | Description |
|---|---|---|
| `scripts/sql/V001__donaciones_necesidad_id_nullable.sql`, `scripts/sql/README.md` | Create | AD-13 |
| `docs/db-changes.md`, `docs/deploy-rpi-cloudflare.md` | Modify | Log entry + pre-deploy step |
| `ms/domain/ModalidadDonacion.java` | Create | `DIRECTA`, `FONDO_COMUN` |
| `ms/domain/Donacion.java` | Modify | `necesidad` `nullable = true`; `modalidad` (`updatable = false`, null ⇒ DIRECTA); `categoria` (`CategoriaAlimento`), `latitud`, `longitud` |
| `ms/donacion/dto/CreateDonacionRequest.java` | Modify | `modalidad`, optional `necesidadId`, `categoria`, `latitud`, `longitud` + cross-field validation |
| `ms/donacion/DonacionService.java` | Modify | `crear` per modalidad; `decidir` devolución for FONDO_COMUN; cancel resolves asignación hook (no-op until 5c); `eliminar` → 409 for FONDO_COMUN; null-safe `toResponse`/`toActivaResponse`; `fase` |
| `ms/donacion/FaseDonacion.java` | Create | AD-4 derivation |
| `ms/donacion/DonacionResponse.java`, `DonacionActivaResponse.java` | Modify | Nullable `necesidadId`/`organizacionId`; add `modalidad`, `categoria`, `fase`. **Location is write-only** — never returned (the public `GET /api/donaciones` must not leak a donante's pickup point) |
| `ms/domain/DonacionRepository.java` | Modify | Donante/admin queries (`findAllWithDonante` ×2, `findByIdWithRelations`, `findByDonante_IdWithRelations` ×2, `findActivas` + its `countQuery`) switch to `LEFT JOIN FETCH d.necesidad n LEFT JOIN FETCH n.organizacion o` and explicit left joins in count queries (path navigation implies inner joins). Org-scoped queries stay inner. |
| `ms/config/EsquemaVerificador.java` | Create | AD-13 runtime guard |

### Slice 5c — Asignación persistence + ronda trigger (MS)

| File | Action | Description |
|---|---|---|
| `ms/domain/Ronda.java`, `RondaRepository.java`, `EstadoRonda.java` | Create | See Interfaces |
| `ms/domain/Asignacion.java`, `AsignacionRepository.java`, `EstadoAsignacion.java` | Create | See Interfaces |
| `ms/asignacion/RondaService.java`, `RondaController.java` | Create | AD-9; `POST /api/rondas`, `GET /api/rondas`, `GET /api/rondas/{id}`, `GET /api/rondas/fondo` |
| `ms/asignacion/EntradaRondaFactory.java`, `UrgenciaCalculator.java` | Create | Input derivations |
| `ms/asignacion/worker/AsignadorClient.java`, `HttpAsignadorClient.java`, `AsignadorConfig.java`, `dto/*` | Create | RestClient with timeouts; `app.worker.url` (`WORKER_URL`); blank ⇒ `AsignadorNoConfigurado` client that throws 503 |
| `ms/asignacion/AsignacionController.java` (or in `DonacionController`) | Create | `GET /api/donaciones/{id}/asignaciones` — owner donante, referente of any org in the history, admin |
| `ms/donacion/DonacionService.java` | Modify | Resolve vigente asignación on accept / devolución / cancel / override |
| `ms/config/SecurityConfig.java` | Modify | `/api/rondas/**` `hasRole("ADMINISTRADOR")`; `GET /api/donaciones/*/asignaciones` `.authenticated()` before the donaciones permitAll |
| `application.yml`, `docker-compose.yml` | Modify | `app.worker.url: ${WORKER_URL:}`; `ms.environment.WORKER_URL: http://worker:8090` |

### Slice 5d — BFF

| File | Action | Description |
|---|---|---|
| `bff/donaciones/dto/crear-donacion.dto.ts` | Modify | `modalidad`, optional `necesidadId`, `categoria`, `latitud`, `longitud` with `ValidateIf` |
| `bff/donaciones/*` | Modify | `GET :id/asignaciones` `@Roles(DONANTE, REFERENTE, ADMINISTRADOR)` |
| `bff/rondas/rondas.module.ts`, `rondas.controller.ts`, `rondas.service.ts` (+specs) | Create | `POST /rondas`, `GET /rondas`, `GET /rondas/:id`, `GET /rondas/fondo`, all `@Roles(ADMINISTRADOR)` |
| `bff/app.module.ts` | Modify | Register module |

### Slice 5e — Nueva donación (admin)

| File | Action | Description |
|---|---|---|
| `adm/routes/nueva-donacion.tsx` | Create | `/donar` (DONANTE): modalidad choice; DIRECTA navigates to `/explorar` (decision 14); FONDO_COMUN: categoria (required), map pin (reuse `OrgLocationPickerLazy`), observaciones; 4(→5)-criteria side panel |
| `adm/components/donacion/CriteriosAsignacionPanel.tsx` | Create | Static explainer of the scoring criteria |
| `adm/lib/hooks/useCrearDonacion.ts` | Modify | New payload union |
| `adm/types/domain.ts` | Modify | `ModalidadDonacion`, `FaseDonacion`, nullable `necesidadId`/`organizacionId` |
| `adm/routes/necesidad-detalle.tsx` | Unchanged | Decision 14: keeps its existing direct-donation flow (inline create against that necesidad) |
| `adm/routes/nueva-donacion.tsx` (DIRECTA branch) | — | Decision 14: choosing "Donación directa" does not embed a picker; it routes to the existing Explorar screen (`/explorar`) (the existing necesidad-selection UI), from which `necesidad-detalle` creates the direct donation. `/donar` itself only submits `FONDO_COMUN` |

### Slice 5f — Progress, detail, admin ronda (admin)

| File | Action | Description |
|---|---|---|
| `adm/routes/donacion-detalle.tsx` | Create | `/mis-donaciones/:id`: progress Ofrecida → Asignación → En camino → Entregada from `fase`, modalidad badge, assigned org, ronda date, score breakdown, timeline of asignaciones; `?nueva=1` success banner (screen b) |
| `adm/components/donacion/ProgresoDonacion.tsx`, `DesgloseScore.tsx` | Create | Presentational |
| `adm/lib/hooks/useAsignaciones.ts`, `useRondas.ts` | Create | Queries/mutation |
| `adm/routes/mis-donaciones.tsx` | Modify | Modalidad badge, link to detail, handle null org |
| `adm/routes/rondas.tsx` | Create | `/rondas` (ADMINISTRADOR): pool size, "Ejecutar ronda" (disabled while pending), history table |
| `adm/app/router.tsx`, `adm/app/AppShell.tsx` | Modify | Routes + nav |

### Slice 6a — Worker compliance term

| File | Action | Description |
|---|---|---|
| `wk/internal/assign/scoring.go` | Modify | `Pesos.Cumplimiento`, `Normalizados()`, new defaults; `Candidato.TasaCumplimiento` |
| `wk/internal/assign/cumplimiento.go` | Create | `p0` + smoothed rate (AD-11) |
| `wk/internal/contrato/ronda_v1.go` | Modify | Optional `cumplimiento {entregadas, fallidas}`, `pesos.cumplimiento` |
| `wk/testdata/ronda-v1/*`, `wk/contract/ronda-v1.md` | Modify | Additive fields |

### Slice 6b — MS compliance signal

| File | Action | Description |
|---|---|---|
| `ms/asignacion/CumplimientoCalculator.java` | Create | One grouped query (`org.id, estado, count`) over `ENTREGADA`/`RECHAZADA` only; `CANCELADA` excluded (AD-11, decision 14) |
| `ms/domain/DonacionRepository.java` | Modify | Aggregate query |
| `ms/asignacion/EntradaRondaFactory.java`, `ms/domain/Asignacion.java` | Modify | Send counts; persist `terminoCumplimiento` |
| `adm/components/donacion/DesgloseScore.tsx`, `CriteriosAsignacionPanel.tsx` | Modify | Fifth criterion (small; may ride in 6b or a follow-up) |

## Interfaces / Contracts

### MS endpoints (new/changed)

| Method + path (MS, `/api` prefix; BFF drops `/api`) | Roles | Notes |
|---|---|---|
| `POST /api/donaciones/{id}/entrega/codigo` | DONANTE, REFERENTE (party) | 201 `{codigo, expiraEn, qrPayload}`; 409 `YA_CONFIRMADO`; 429 `ESPERA_ANTES_DE_REENVIAR` |
| `POST /api/donaciones/{id}/entrega/verificar` | DONANTE, REFERENTE (party) | body `{codigo}`; 200 `DonacionResponse`; 400/410/429 per AD-6 |
| `GET /api/donaciones/{id}/entrega` | DONANTE, REFERENTE (party) | `{estado, fase, confirmadaDonanteEn, confirmadaReferenteEn, miCodigoExpiraEn}` |
| `POST /api/donaciones/{id}/confirmar-entrega` | — | **Removed in 3c** |
| `POST /api/donaciones` | DONANTE | + `modalidad`, `categoria`, `latitud`, `longitud`; `necesidadId` required only for DIRECTA |
| `GET /api/donaciones/{id}/asignaciones` | owner DONANTE, involved REFERENTE, ADMINISTRADOR | history with desglose + ronda date |
| `GET /api/auditoria/evidencias` | ADMINISTRADOR | AD-8 |
| `GET /api/organizaciones/{id}/acreditacion/evidencias/archivo?objectKey=` | ADMINISTRADOR, owning REFERENTE | AD-12; 204 / 400 `EVIDENCIA_CLAVE_INVALIDA` / 403 / 404 `EVIDENCIA_NO_ENCONTRADA`; consumed only by the BFF `evidencia-files` route (BFF does not expose it) |
| `POST /api/rondas` | ADMINISTRADOR | 201 `RondaResponse`; 409 `RONDA_EN_CURSO`; 503 `WORKER_NO_DISPONIBLE` |
| `GET /api/rondas`, `GET /api/rondas/{id}`, `GET /api/rondas/fondo` | ADMINISTRADOR | paged list / detail / `{pendientes, masAntiguaDesde}` |

SPA route gates mirror these (`ProtectedRoute`): `/donaciones/:id/entrega` DONANTE+REFERENTE,
`/donar` and `/mis-donaciones/:id` DONANTE, `/auditoria` and `/rondas` ADMINISTRADOR.

### Entities (MS)

```java
// org.example.domain
public enum ModalidadDonacion { DIRECTA, FONDO_COMUN }
public enum EstadoRonda { COMPLETADA, FALLIDA }
public enum EstadoAsignacion { PROPUESTA, ACEPTADA, RECHAZADA, CANCELADA }

@Entity @Table(name = "rondas")
class Ronda {
  Long id; Instant ejecutadaEn; Instant finalizadaEn; Long ejecutadaPor;
  EstadoRonda estado; String error;               // error only when FALLIDA
  int versionContrato;                             // 1
  int donacionesConsideradas; int candidatosConsiderados;
  int asignadas; int sinAsignar; int descartadas;  // descartadas = stale at write time
  Double scoreTotal;
  // weights actually applied (normalized), snapshot for explainability
  Double pesoDeficit, pesoUrgencia, pesoProximidad, pesoEspera, pesoCumplimiento;
}

@Entity @Table(name = "asignaciones",
  indexes = { @Index(columnList = "donacion_id"), @Index(columnList = "ronda_id") })
class Asignacion {
  Long id;
  @ManyToOne Ronda ronda; @ManyToOne Donacion donacion;
  @ManyToOne Necesidad necesidad; @ManyToOne Organizacion organizacion;
  EstadoAsignacion estado; Instant creadaEn; Instant resueltaEn;
  double score; double costoOportunidad; double distanciaKm;
  // normalized terms in [0,1]; contribution = term × ronda.peso*
  double terminoDeficit, terminoUrgencia, terminoProximidad, terminoEspera;
  Double terminoCumplimiento;                      // null until 6b
  String deficitFuente; String codigoRadio;        // AD-2
}
```

### Worker contract v1 (JSON)

```jsonc
// POST /v1/ronda
{
  "version": 1,
  "donaciones": [
    { "id": 17, "latitud": -31.41, "longitud": -64.18, "categoria": "NO_PERECEDERO",
      "diasEnFondo": 12, "organizacionesExcluidas": [5] }
  ],
  "candidatos": [
    { "necesidadId": 40, "organizacionId": 8, "latitud": -31.40, "longitud": -64.20,
      "codigoRadio": null, "deficit": null,            // optional; AD-2
      "urgencia": 0.6, "diasDesdeUltimaDonacion": 14,
      "categoriasAceptadas": ["NO_PERECEDERO"], "categoriasPermitidas": ["NO_PERECEDERO"],
      "cumplimiento": { "entregadas": 8, "fallidas": 1 } }  // optional, 6a
  ],
  "pesos": null, "parametros": null                     // optional overrides
}
// 200
{
  "version": 1,
  "asignaciones": [
    { "donacionId": 17, "necesidadId": 40, "organizacionId": 8, "score": 0.71,
      "distanciaKm": 2.1, "costoOportunidad": 0.0,
      "desglose": { "deficit": 0.33, "urgencia": 0.6, "proximidad": 0.77, "espera": 0.16, "cumplimiento": 0.85 },
      "deficitFuente": "NEUTRAL", "codigoRadio": "" }
  ],
  "sinAsignar": [21],
  "scoreTotal": 0.71,
  "pesos": { "deficit": 0.30, "urgencia": 0.25, "proximidad": 0.17, "espera": 0.13, "cumplimiento": 0.15 },
  "parametros": { "distanciaMediaKm": 8, "distanciaMaximaKm": 30, "esperaMaximaDias": 90,
                  "deficitMaximo": 3, "penalizacionNoAsignar": 0.10, "radioResolucionKm": 1.0,
                  "cumplimientoPseudoObs": 5 }
}
// 400 { "error": "VERSION_NO_SOPORTADA" | "ENTRADA_INVALIDA", "detalle": "..." }
```

### Admin SPA types (excerpt)

```ts
export type ModalidadDonacion = 'DIRECTA' | 'FONDO_COMUN';
export type FaseDonacion =
  | 'EN_FONDO' | 'ASIGNADA' | 'OFRECIDA' | 'ACEPTADA' | 'EN_CAMINO'
  | 'CONFIRMANDO' | 'ENTREGADA' | 'RECHAZADA' | 'CANCELADA';
export interface CodigoEntrega { codigo: string; expiraEn: string; qrPayload: string }
export interface EstadoEntrega {
  estado: EstadoDonacion; fase: FaseDonacion;
  confirmadaDonanteEn: string | null; confirmadaReferenteEn: string | null;
  miCodigoExpiraEn: string | null;
}
```

## Testing Strategy

Strict TDD (`openspec/config.yaml`): every row below starts as a failing test. Runners per service:
MS `mvn test` (JUnit 5, H2, spring-security-test), BFF `npm test` (Jest), admin `npm test` + **`npm
run build`** (tsc catches what vitest does not), worker `go test ./...`.

| Slice | Layer | What to test | Approach |
|---|---|---|---|
| 1 | Unit/integration (vitest) | Referente reaches the Bienvenida step after org success; donante never sees it; `org-error` retry unchanged; CTA navigates to `/acreditacion`; `ProtectedRoute` forwards `from`; verify-email honours only internal `from` | Testing Library + axios-mock-adapter |
| 2 | MS unit | `EvidenciaResponse.from` carries `objectKey` | plain JUnit |
| 2 | MS repository | `existsByOrganizacion_IdAndObjectKey` true for the org's row, false for the same key under another org and for an unknown key; append-only reflection test still green | `@DataJpaTest` on H2 |
| 2 | MS controller | `archivo` endpoint: matching row ⇒ 204 (owning referente and admin); valid key with no row ⇒ **404** `EVIDENCIA_NO_ENCONTRADA` (owning referente and admin); non-owning referente ⇒ **403** (checked before the row lookup, so no existence oracle); DONANTE ⇒ 403; anonymous ⇒ 401/403; foreign prefix / `..` / extra `/` ⇒ 400 | `@WebMvcTest` with real `SecurityConfig` + mocked service, plus service unit test |
| 2 | BFF | `serve`: MS 204 ⇒ streams the object with its content type (**200**); MS 404 ⇒ `NotFoundException` and `getObject` never called; MS 403 ⇒ `ForbiddenException` and `getObject` never called; admin also goes through the MS check (no admin bypass); `misOrganizaciones` no longer called; service forwards Bearer and URL-encodes `objectKey` | Jest controller + service specs |
| 2 | vitest | Parser rejects foreign prefixes, path traversal, orgId mismatch; hook revokes object URL on unmount; 403 **and 404** render the unavailable state; AuditQueue/legajo/acreditación render the file | axios-mock-adapter with `responseType: 'blob'` |
| 3a | MS unit | Generate hashes + TTL 10 min; regenerate burns previous; throttle 429; `YA_CONFIRMADO`; verify: wrong party code rejected, expired 410, 5th miss burns 429, success sets the verifier's timestamp, first → PENDIENTE_CONFIRMACION, second → ENTREGADA; idempotent re-verify; non-party 403; donation with null necesidad has no referente party (no NPE) | Mockito + fixed `Clock` (OtpService test precedent) |
| 3a | MS integration | Concurrent double verification ends in ENTREGADA (row lock); `TransicionesDonacion` table matrix; anonymous `GET /api/donaciones/{id}/entrega` denied | `@SpringBootTest` + H2, two threads; security test with `@Import(SecurityConfig.class)` |
| 3b | BFF | Routes carry roles, forward Bearer, DTO rejects non-6-digit codes, MS errors relayed | Jest controller/service specs |
| 3c | vitest | QR rendered from `qrPayload`; payload parser (wrapped and bare); countdown reaches 0 → "Generar código nuevo"; scanner adapter mocked, payload of another donación rejected locally; typed input submits; polling stops at ENTREGADA; old button absent in `mis-donaciones` and `dashboard` | `vi.mock('../lib/qr/escanearQr')`, fake timers |
| 3c | MS/BFF | `confirmar-entrega` returns 404/405 | controller tests |
| 4a | MS | Tabs semantics (PENDIENTE vs APROBADA+expired, REEMPLAZADA excluded); each filter; nivel → requisitos; paging metadata + `size` cap 100; non-admin 403; anonymous 403; append-only reflection test still green | repository slice on H2 + `@WebMvcTest` with real `SecurityConfig` |
| 4a | BFF | Param whitelist forwarded, `@Roles(ADMINISTRADOR)` | Jest |
| 4b | vitest | Tab/filter changes reset page and change query key; pager; approving from the drawer invalidates the queue | Testing Library |
| 5a | Go | Contract decode/validate (version, limits, NaN, ranges); deficit resolver precedence rows 1-4 incl. zero-population ⇒ NEUTRAL; `desglose` terms sum with weights to `score`; exclusions are hard filters; penalty 0 ⇒ same `ScoreTotal`/assigned set as the old solver on random instances; with contention the older donation wins; handler 200/400/413 via `httptest`; golden request → golden response; oracle test untouched | `go test ./...`, table tests, `go-testing` skill patterns |
| 5b | MS | Create DIRECTA unchanged; FONDO_COMUN requires categoria + coordinates and rejects `necesidadId`; `modalidad` not updatable; `mias`/`findById`/`activas` include pool donations (LEFT JOIN) and org-scoped lists exclude unassigned ones; `toResponse` null-safe; `fase` table (AD-4); location never serialized; FONDO_COMUN delete → 409; devolución clears necesidad **without deleting the row** (orphanRemoval regression); `EsquemaVerificador` flag ⇒ 503 `ESQUEMA_PENDIENTE` | Mockito + `@DataJpaTest` on H2 |
| 5b | Manual | Script idempotency (run twice) and `\d donaciones` on the local dev DB (`make up-local`) | Runbook step, recorded in `docs/db-changes.md` "Applied to" |
| 5c | MS | Candidate query excludes N0, closed/expired necesidades, orgs without referente or coordinates; urgencia/días derivations; exclusions from rejected assignments; lock ⇒ 409; worker timeout ⇒ FALLIDA ronda + 503 and nothing assigned; stale donation at write time ⇒ `descartadas`; happy path persists Ronda + Asignaciones and sets `necesidad`; accept/devolución/cancel resolve the vigente asignación; `/api/rondas/**` admin-only | fake `AsignadorClient`; `HttpAsignadorClient` with `MockRestServiceServer` against the golden fixtures |
| 5d | BFF | DTO cross-field validation; rondas module admin-only; asignaciones route roles | Jest |
| 5e/5f | vitest | Modalidad switch shows the right fields; FONDO_COMUN submit payload; progress maps every `fase`; breakdown renders contributions (term × weight) and `deficitFuente`; null organizacion rendered as "Esperando ronda"; "Ejecutar ronda" disabled while pending, 409/503 messages | Testing Library + `npm run build` |
| 6a | Go | No history ⇒ `p0`; `p0 = 0.5` when nobody has history; weights normalized; `Cumplimiento = 0` ⇒ identical scores to the four-term version; accreditation still filters | table tests |
| 6b | MS | Grouped counts per org (ENTREGADA ⇒ entregadas, RECHAZADA ⇒ fallidas); `CANCELADA` and non-terminal donations excluded from both counts (8 ENTREGADA + 1 CANCELADA + 1 RECHAZADA ⇒ 8/1); passed in the request; `terminoCumplimiento` persisted | `@DataJpaTest` + fake client |

No E2E suite exists across services; the end-to-end check is a manual run on `make up-local`
(documented per slice in tasks) — create pool donation → run ronda → accept → exchange codes.

## Threat Matrix

The reference matrix covers VCS/shell/executable-classification boundaries. This change adds an
HTTP service-to-service call (MS → worker) but no shell command, no subprocess, no git/PR automation
and no executable-file classification.

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | N/A | No file is classified or executed by path/extension |
| Git repository selection | N/A | No git automation; the user performs all git operations |
| Commit state | N/A | Same |
| Push state | N/A | Same |
| PR commands | N/A | Same |

Security properties that *are* in scope are handled as design requirements with RED tests in the
Testing Strategy: worker reachable only on the compose network (no `ports`), body/row limits and
input validation on `/v1/ronda`; `GET` routes under `/api/donaciones/**` that expose private data
declared `.authenticated()` before the permitAll matcher; `/api/auditoria/**` and `/api/rondas/**`
admin-only in all three layers; delivery codes hashed, TTL-bound, attempt-limited and row-locked;
donante location write-only; evidence files served only through the authenticated route, and only
when the MS confirms ownership **and** an `OrganizacionEvidencia` row with that `objectKey` (AD-12).

## Migration / Rollout

| Slice | Schema / infra | Rollout | Rollback |
|---|---|---|---|
| 1 | none | SPA rebuild | Revert SPA |
| 2 | none (additive DTO field, new read endpoint) | MS first, then BFF (the new BFF route depends on the MS `archivo` endpoint), then SPA — one `docker compose up --build -d` covers it | Revert BFF + MS together (the old BFF ownership-only check needs no MS endpoint); public deny-list untouched |
| 3a | `codigos_entrega` (ddl-auto) | MS only; button still works | Revert; orphan table harmless |
| 3b | none | BFF | Revert |
| 3c | none | MS + BFF + SPA **together** (`docker compose up --build -d`) | Redeploy previous images; `PENDIENTE_CONFIRMACION` donations are completed by the restored button |
| 4a/4b | none | MS + BFF, then SPA | Revert (read-only) |
| 5a | new `worker` service | `docker compose up --build -d` builds it natively (arm64) on the Pi; unused until 5c | Remove service |
| 5b | **run `V001` before deploy**; new nullable columns via ddl-auto | Script → deploy MS | Redeploy previous MS. Relaxed `NOT NULL` is harmless while no pool donation exists; otherwise cancel them, then optionally `SET NOT NULL`. Extra columns ignored by old code |
| 5c | `rondas`, `asignaciones` (ddl-auto); `WORKER_URL` env | MS | Revert; tables orphan-safe; assigned pool donations behave as direct ones |
| 5d-5f | none | BFF then SPA | Revert |
| 6a/6b | none | worker then MS | `pesos.cumplimiento = 0` or revert |

Pre-flight before slice 3a: confirm on the Pi that `donaciones_estado_check` already allows
`PENDIENTE_CONFIRMACION` (`docs/db-changes.md` shows the Pi entry unchecked); the delivery code
relies on it. Enum columns created by `ddl-auto` get CHECK constraints that `update` never widens:
adding a value later to `ModalidadDonacion`, `EstadoAsignacion` or `EstadoRonda` needs its own
`scripts/sql/V00N` script.

## Open Questions

None. Resolved in revision 2:

- [x] AD-10 unassignment penalty — accepted (decision 12).
- [x] Audit `nivel` filter — `RequisitoAcreditacion.nivelExigido` (decision 14, AD-8).
- [x] Compliance and cancellations — `CANCELADA` not counted against the organizacion (decision 14, AD-11).
- [x] Evidence-file access bound to an evidence row — required, MS-authorized, 404 on no row (decision 13, AD-12).
- [x] Nueva donación entry point — `necesidad-detalle` keeps its direct flow; `/donar` "Donación directa" routes to `/explorar` (decision 14, slice 5e).

## Operational Preconditions (external, not design questions)

- [ ] **INDEC population CSV**: until it is sourced and mounted (`POBLACION_CSV`), every candidate
      resolves to `deficitFuente = NEUTRAL` (AD-2); the thesis text must state this limitation.
- [ ] **Pi DB check constraint**: before slice 3a, confirm on the Pi that `donaciones_estado_check`
      allows `PENDIENTE_CONFIRMACION` (`docs/db-changes.md` Pi entry unchecked).
- [ ] **V001 on the Pi**: run `scripts/sql/V001__donaciones_necesidad_id_nullable.sql` before
      deploying slice 5b (AD-13 runbook).
- [ ] **QR libraries at apply time**: confirm `qrcode.react` / `qr-scanner` versions, React 19 peer
      range, license and maintenance; fallback inside the same adapter per AD-7.

## Spec Alignment (for the orchestrator)

- `specs/asignacion-historial-cumplimiento/spec.md` "Compliance Rate Definition" still counts
  `CANCELADA` as resolved (scenario 8/10 = 0.8). Decision 14 overrides it; the spec needs a delta so
  `CANCELADA` is excluded (the scenario becomes 8/9). The design follows decision 14.
- The same spec asks for a configurable neutral prior; AD-11's prior is the ronda average `p0`
  with configurable pseudo-observations `m`. If the spec's "configured value" must be a fixed
  number, `p0` becomes a `parametros.cumplimientoPrior` override (additive contract field) — no
  structural change.
