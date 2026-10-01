# Proposal: Tesis Core Features

## Intent

The thesis — *"Sistema de acreditación, asignación priorizada y trazabilidad de donaciones de
alimentos"* — promises three pillars. Only the first is fully implemented (`acreditacion-progresiva`,
archived 2026-09-21). The other two are promised but not delivered:

- **Asignación priorizada (fondo común)** exists only as a tested Go solver
  (`go_algorithms_worker/internal/assign/*`). It is CLI-only, nothing calls it, and the MS cannot
  even persist a pool donation: `Donacion.necesidad` is `@JoinColumn(nullable = false)`
  (`jar_hornero_ms/.../domain/Donacion.java:37-39`) and there is no `modalidad` anywhere.
- **Trazabilidad** has dual confirmation (`DonacionService.confirmarEntrega`, lines 151-189) but it
  is a plain authenticated button — no code, no TTL, no QR. CU-13 promises a QR/OTP handshake.

Around those gaps sit smaller debts the thesis and the new UI mockups (Claude Design canvas
"Hornero — Nuevas features") depend on: an onboarding Bienvenida screen for the N0–N3 ladder, a
cross-org audit queue (today `AuditQueue.tsx` is per-org), the compliance-history scoring term named
in `odd/tasks/tesis-documento-der.md`, and SPA consumption of the authenticated evidence-file route.

This change is the **ordered implementation inventory** for all of it: one umbrella, six work
units, each cut into independently reviewable and deployable slices. Success looks like: a donante
offers to the fondo común, an ADMINISTRADOR runs a ronda, the donation is assigned to an
organizacion with a visible, explainable score breakdown (including compliance history), and the
delivery is closed by scanning or typing the counterpart's short-lived code — never by a bare
button.

## Scope

### In Scope

1. **Bienvenida** — a 3rd register step "Acreditación" after Cuenta/Organización (referente flow
   only) that explains the N0..N3 ladder and ends in the CTA "Empezar con N1", which routes to the
   existing `acreditacion.tsx`. UI only; data via `useAcreditacion`.
2. **Evidence-file access, closed end to end.** See "Exploration correction" below: the BFF route
   already exists. Remaining: the SPA renders evidence photos/documents through
   `GET /evidencia-files/:orgId/:filename` (audit detail, legajo, referente's own acreditación
   view); stale "until Slice B ships" comments are removed (`images.controller.ts:14-20`,
   `ts_hornero_admin/src/types/domain.ts:161-167`); the public-route deny-list stays as
   defense-in-depth and is re-documented as such.
3. **`entrega-qr-ttl`** — delivery confirmation by a 6-digit OTP rendered as a QR, **replacing** the
   `confirmar-entrega` button. Each party generates its own code; the counterpart scans it or types
   it. Code stored as BCrypt hash with TTL, throttled resend and bounded verification attempts,
   mirroring `OtpService` / `OtpThrottle` (`429 ESPERA_ANTES_DE_REENVIAR`). Generating a new code
   invalidates the previous one immediately. Mobile confirmation screen: QR, typed-code fallback,
   countdown, both parties' confirmation status, "Escanear código" / "Generar código nuevo". The
   ADMINISTRADOR `overrideEstado` path is kept unchanged.
4. **Cross-org audit queue** — MS + BFF read endpoint over evidence awaiting audit across all
   organizaciones, with offset pagination and the response envelope from
   `docs/pagination-rest-endpoints.md`, tabs Pendientes / Vencidas, filters `nivel`, `requisito`,
   `tipoEvidencia`; admin list screen that opens the existing detail with Aprobar / Observar.
5. **Fondo común assignment** —
   - worker callable contract (input/output schema versioned, independent of transport);
   - `Donacion.modalidad` (`DIRECTA` | `FONDO_COMUN`), immutable after creation;
   - `donaciones.necesidad_id` made nullable by a **hand-written, versioned SQL script** run once on
     the Pi before deploy (`ddl-auto=update` kept, no Flyway);
   - `Asignacion` persistence: organizacion (and necesidad — the solver's candidate is the
     necesidad, `scoring.go:19-29`), ronda date, per-criterion scores, total, `costoOportunidad`;
   - ronda triggered **only manually by an ADMINISTRADOR** (MS `SecurityConfig`, BFF `@Roles`,
     SPA `ProtectedRoute` kept in sync);
   - BFF routes and admin screens: Nueva donación (modalidad choice + 4-criteria side panel),
     Donación ofrecida (progress Ofrecida → Asignación → En camino → Entregada), Mis donaciones
     detail (modalidad badge, assigned organizacion, ronda date, score breakdown, timeline).
6. **`scoring-historial-cumplimiento`** — a compliance term per organizacion derived from existing
   donaciones (`ENTREGADA` vs `CANCELADA`/`RECHAZADA`), a neutral prior for organizaciones without
   history, and renormalized weights. No new tracking tables.

### Out of Scope

- Hash chain over `organizacion_evento` (same rationale as `acreditacion-progresiva`).
- Server-side PDF generation.
- Quantity / volume model on `Necesidad` or `Donacion`.
- Automatic accreditation level decay.
- Scheduled or per-donation rondas (manual ADMINISTRADOR trigger only).
- Adopting a migration tool (Flyway/Liquibase).
- Re-routing already-assigned or `DIRECTA` donations through the solver.
- Any work in `ts_hornero_app` (deprecated) or public display of assignments on `ts_hornero_astro`.

## Exploration correction (slice 2)

The exploration lists G7/G11 (authenticated evidence route) as missing. That is stale: commit
`89b309e` added `ts_hornero_bff/src/evidencia-files/evidencia-files.controller.ts`
(`@Roles(REFERENTE, ADMINISTRADOR)`, ownership via `misOrganizaciones`), and `e9dffa5` persists
`objectKey`. But no SPA code consumes it — the only `images?key=` / file URL in
`ts_hornero_admin/src` is `OrgImagesEditor.tsx:9`, and nothing references `evidencia-files`. Slice 2
is therefore re-scoped to the consumer side plus hardening, and shrinks accordingly. `sdd-spec`
should confirm whether the file must additionally be bound to an existing `organizacion_evidencia`
row (today any key under the org prefix is served to its owner).

## Capabilities

### New Capabilities

- `donacion-entrega-codigo`: per-party 6-digit delivery code, QR rendering of the same code,
  BCrypt-hashed storage, TTL, immediate invalidation on regenerate, resend throttling and attempt
  limits, who may generate/verify, how two verifications move the donación to `ENTREGADA`, and the
  retirement of the unconditional confirm action.
- `auditoria-cola-global`: cross-org audit queue — contents, Pendientes vs Vencidas semantics,
  filters, offset pagination + envelope, ADMINISTRADOR-only access.
- `donacion-fondo-comun`: `modalidad` vocabulary and immutability, pool donations without a
  necesidad, visibility/state of a pool donation before and after assignment, the progress steps
  shown to the donante.
- `ronda-asignacion`: manual ADMINISTRADOR trigger, worker contract (input/output), `Asignacion`
  persistence and its explainability fields, handling of unassigned donations, idempotency of a
  ronda.
- `asignacion-historial-cumplimiento`: compliance-rate definition, neutral prior, weight
  renormalization, and the rule that compliance is a weighted term while accreditation stays a hard
  filter.

### Modified Capabilities

- `referente-onboarding`: registration gains a 3rd step "Acreditación" (Bienvenida) after
  Organización; it MUST NOT alter the partial-failure retry or the approval-flow requirements, and
  MUST NOT appear in donante registration.
- `organizacion-evidencia`: "Authenticated Evidence-File Access" extends to the SPA — evidence files
  MUST be rendered only via the authenticated route; optionally, file access bound to an existing
  evidence row (spec decides).
- `organizacion-acreditacion`: no requirement change expected; listed only so `sdd-spec` checks the
  audit-queue filters against the existing `nivel`/`requisito` vocabulary. Drop if unchanged.

## Approach

### Ordering and the transition-table conflict

Slices 3 and 5 both touch `EstadoDonacion` and `TRANSICIONES_PERMITIDAS`
(`DonacionService.java:36-46`). Today the table has no entries for `PENDIENTE_CONFIRMACION` /
`ENTREGADA`; `confirmarEntrega` bypasses it and resolves the referente through
`d.getNecesidad().getOrganizacion()` (line 157) — which breaks for a pool donation with a null
necesidad. Therefore **slice 3 lands before slice 5**: slice 3 fixes the delivery transitions in
the table (code-verified path), slice 5 then adds the pool states on top of a stable table and
generalizes "who is the receiving referente" to come from the assignment when `necesidad` is null.
Whether "Asignación" is a new `EstadoDonacion` value or a phase derived from `modalidad` + presence
of an `Asignacion` is a **design** decision.

### Delivery order (each line = one reviewable delivery; user performs all git operations)

| Slice | Content | Services | Est. changed lines (incl. tests) | Depends on |
|---|---|---|---|---|
| 1 | Bienvenida register step | admin | 250–350 | — |
| 2 | Evidence files rendered via authenticated route + comment cleanup | admin (+ BFF/MS if row binding) | 150–250 | — |
| 3a | Delivery code: entity, service (hash/TTL/throttle/attempts), MS endpoints, transition entries; old confirm endpoint kept | MS | 350–450 | — |
| 3b | BFF routes for generate/verify/status | BFF | 150–250 | 3a |
| 3c | Mobile confirmation screen (QR render, scan, typed fallback, countdown), button removed, old endpoint retired in MS/BFF | admin, BFF, MS | 400–500 | 3b |
| 4a | Cross-org audit queue read endpoint (MS query + BFF proxy, pagination, filters) | MS, BFF | 300–400 | — |
| 4b | Admin queue list screen, tabs, filters, reuse of detail/Aprobar/Observar | admin | 300–400 | 4a |
| 5a | Worker callable contract + chosen transport entrypoint | worker | 200–300 | transport decision |
| 5b | SQL script, `modalidad`, nullable `necesidad`, null-safety in `toResponse`/queries/`confirmarEntrega` | MS, `scripts/sql/` | 350–450 | 3c |
| 5c | `Asignacion` entity, ronda trigger (ADMINISTRADOR), worker client, persistence | MS | 400–500 | 5a, 5b |
| 5d | BFF create with `modalidad`, assignment read routes, ronda trigger route | BFF | 250–350 | 5c |
| 5e | Nueva donación screen (modalidad + 4-criteria panel) | admin | 300–400 | 5d |
| 5f | Donación ofrecida progress + Mis donaciones detail; admin "Ejecutar ronda" action | admin | 350–450 | 5d |
| 6a | Worker compliance term, neutral prior, renormalized weights | worker | 150–250 | 5a (may run parallel to 5b–5f) |
| 6b | MS compliance signal fed into the ronda input | MS | 150–250 | 5c, 6a |

Total forecast ≈ 4,000–5,500 changed lines across 15 slices. Several slices sit at the 400-line
edge (3c, 5c, 5f); `sdd-tasks` should split them further if the forecast holds. Under
`ask-on-risk`, a chain strategy (`stacked-to-main` or `feature-branch-chain`) must be chosen before
apply. Slices 1, 2, 3a and 4a have no mutual dependency and may be reordered freely.

### Key technical lines per unit

- **Slice 3** reuses the `OtpService` pattern rather than a shared abstraction first; extraction is
  a refactor only if duplication is real. QR rendering and camera scanning need a client library in
  `ts_hornero_admin` (new dependency — design picks it; `BarcodeDetector` is not universally
  available). The code is short-lived and single-purpose, so 6 digits is acceptable only with the
  attempt limit.
- **Slice 3 rollout**: new endpoints ship first while the old button still works; the button and
  endpoint are removed together in 3c so no deployed UI calls a missing endpoint.
- **Slice 4** follows `docs/pagination-rest-endpoints.md` (offset + envelope) instead of inventing a
  shape. "Vencidas" reuses the record-and-warn derived expiry (`validoHasta < today`).
- **Slice 5 SQL**: a numbered script under a new `scripts/sql/` (exact location is design) doing
  `ALTER TABLE donaciones ALTER COLUMN necesidad_id DROP NOT NULL`, documented in
  `docs/deploy-rpi-cloudflare.md` as a pre-deploy step. The entity annotation changes in the same
  slice; `ddl-auto=update` alone never relaxes a constraint.
- **Slice 6** keeps the acreditacion rule intact: accreditation remains a hard filter in `acepta()`;
  compliance is a separate weighted term, which is a different signal (behaviour, not paperwork).

### Worker ↔ MS transport — DESIGN decision, not decided here

The worker is CLI-only today (`main.go`, JSON via stdin/file); services run in docker compose on a
Raspberry Pi 5. Options for `sdd-design`:

| Option | Shape | Main tradeoff |
|---|---|---|
| A. Worker as an HTTP service | new compose service, MS calls it over the internal network | one more always-on container on the Pi for an admin-triggered, rare operation |
| B. MS spawns the binary as a subprocess | Go binary (arm64) copied into the MS image, JSON over stdin/stdout | no new service; couples two build toolchains in one image, process management in Java |
| C. BFF spawns / calls the worker | same as A or B but from NestJS | BFF is documented as holding no domain logic — conflicts with the layering |
| D. DB-mediated job | MS writes a `ronda` request row, worker (cron/loop) reads and writes results | async, decoupled; needs polling and a status model for a manual trigger |
| E. Port the solver to Java | no transport at all | discards the tested Go solver and its brute-force oracle test |

Slice 5a delivers the transport-independent contract regardless; only its entrypoint depends on the
choice.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `ts_hornero_admin/src/routes/register.tsx` | Modified | 3rd "Acreditación" step (Bienvenida) |
| `ts_hornero_admin/src/components/acreditacion/`, `AuditQueue.tsx`, legajo view | Modified | Render evidence via `/evidencia-files`; cross-org queue screen |
| `ts_hornero_admin/src/types/domain.ts`, `lib/hooks/` | Modified | Stale comments; hooks for delivery code, audit queue, modalidad, asignación, ronda |
| `ts_hornero_admin/src/routes/` (donaciones screens) | New/Modified | Mobile confirmation, Nueva donación, Donación ofrecida, Mis donaciones detail |
| `ts_hornero_bff/src/images/images.controller.ts` | Modified | Comment only; deny-list kept as defense-in-depth |
| `ts_hornero_bff/src/donaciones/` | Modified | Delivery code routes; `modalidad`; assignment reads; old confirm route removed in 3c |
| `ts_hornero_bff/src/acreditacion/` | Modified | Cross-org queue proxy |
| `ts_hornero_bff/src/` (ronda module) | New | ADMINISTRADOR ronda trigger proxy |
| `jar_hornero_ms/.../domain/Donacion.java`, `EstadoDonacion.java` | Modified | `modalidad`, nullable `necesidad`, possibly new state |
| `jar_hornero_ms/.../donacion/DonacionService.java` | Modified | Transition table, code-verified confirmation, null-safe org resolution |
| `jar_hornero_ms/.../donacion/` (delivery code) | New | Code entity/service modeled on `auth/otp/OtpService` + `OtpThrottle` |
| `jar_hornero_ms/.../acreditacion/` | Modified | Cross-org queue query |
| `jar_hornero_ms/.../` (asignacion/ronda) | New | `Asignacion` entity, ronda service, worker client, compliance signal |
| `jar_hornero_ms/.../config/SecurityConfig` | Modified | New authenticated/ADMINISTRADOR routes |
| `scripts/sql/` (location per design) | New | First hand-written versioned SQL script (`necesidad_id` nullable) |
| `go_algorithms_worker/main.go`, `internal/assign/scoring.go` | Modified | Callable entrypoint; compliance term + renormalized `Pesos` |
| `docs/deploy-rpi-cloudflare.md` | Modified | Pre-deploy SQL step; worker deployment per transport choice |
| `ts_hornero_astro`, `ts_hornero_app` | Unchanged | — |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Slices 3 and 5 conflict on `TRANSICIONES_PERMITIDAS` / `EstadoDonacion` | High if parallel | Strict order 3 → 5; 5b starts only after 3c |
| Null `necesidad` breaks existing reads (`toResponse`, `confirmarEntrega:157`, repository joins) | High | 5b is dedicated to null-safety with regression tests before any pool donation can be created |
| First hand-written SQL script forgotten on deploy → inserts fail | Med | Script idempotent, versioned, documented as a runbook pre-step; entity change and script ship in the same slice |
| 6-digit code brute-forced | Med | BCrypt, TTL, attempt limit, invalidate on regenerate, throttle — same bar as email OTP |
| Camera/QR library adds bundle weight or fails on some phones | Med | Typed-code fallback is always available; library chosen in design |
| Removing the confirm button while an old UI build is cached | Low | 3c removes button and endpoint together; admin is a rebuilt SPA |
| Ronda inputs not available in the MS: no `deficit`/`codigoRadio` anywhere in `jar_hornero_ms`, and MS `Donacion` has no `categoria` or location, which the solver's `Donacion` requires (`scoring.go:10-17`) | High | Design must define the input producer (neutral deficit default vs. worker-side radio lookup) — see open decisions |
| Worker transport adds an always-on process to the Pi | Med | Transport is an explicit design decision with a Pi-cost column |
| Umbrella scope creep / reviewer fatigue | High | 15 slices with a per-slice forecast; chain strategy decided before apply |
| Exploration drift (slice 2 already partly shipped) | Realized | Re-scoped here; spec/design must re-verify against HEAD, not the exploration |

## Rollback Plan

| Slice | Rollback |
|---|---|
| 1 | Revert the SPA commit; no data or API touched. |
| 2 | Revert the SPA commit; the BFF route and public deny-list remain in place, so no exposure is reintroduced. |
| 3a / 3b | Revert; new table/endpoints are additive and unused by the old button. Leftover code table is orphan-safe (drop by hand if desired). |
| 3c | Redeploy the previous admin/BFF/MS images, which restores the button and endpoint. Donaciones already `ENTREGADA` stay valid; partially confirmed ones remain `PENDIENTE_CONFIRMACION` and the old button completes them. |
| 4a / 4b | Revert; read-only endpoint and screen, no data written. |
| 5a | Revert; the worker CLI behaviour is unchanged. |
| 5b | Redeploy previous images. The relaxed `NOT NULL` is harmless to old code **only while no pool donation exists**; if any exists, cancel or reassign them first, then optionally `ALTER TABLE donaciones ALTER COLUMN necesidad_id SET NOT NULL`. `modalidad` column is additive and ignored by old code. |
| 5c / 5d | Revert; `asignaciones` table is orphan-safe; pool donations stay `OFRECIDA` unassigned. |
| 5e / 5f | Revert SPA; backend remains usable via API. |
| 6a / 6b | Set the compliance weight to 0 (renormalization makes this equivalent to the current four-term score) or revert. |

## Dependencies

- Product answers to the open decisions below (block slices 5b/5c/5e and parts of 3c only).
- Transport decision in `sdd-design` (blocks 5a entrypoint and 5c client).
- A QR render + scan library for `ts_hornero_admin` (chosen in design).
- Operator access to run the SQL script on the Pi before deploying 5b (user-performed).

## Open product decisions (returned to the orchestrator — not decided here)

1. **Pool donation inputs.** The solver needs a `categoria` and a location per donation
   (`scoring.go:10-17`); MS `Donacion` has neither. What does a fondo común donation carry —
   donante's address, a pickup point, or no proximity at all? Is `categoria` a required field on
   Nueva donación for both modalidades or only `FONDO_COMUN`?
2. **After assignment**: does the assigned organizacion's referente still accept
   (`OFRECIDA → ACEPTADA`), or does assignment imply acceptance? This shapes the transition table.
3. **Unassigned donations** (`sinAsignar`): stay in the pool for the next ronda indefinitely, expire,
   or notify the donante? May the donante cancel while waiting?
4. **Delivery code TTL** value (email OTP uses 15 min) and whether both parties must present codes
   or one scan suffices for `ENTREGADA` (decision #2 says "the other party's code"; confirm it is
   mutual).

## Success Criteria

- [ ] A new referente sees the Bienvenida step after Organización and "Empezar con N1" lands on the
      acreditación screen; donante registration is unchanged.
- [ ] Evidence photos/documents render in the SPA only through the authenticated route; a
      non-owning referente gets 403; the public image route still rejects evidence keys.
- [ ] A donación reaches `ENTREGADA` only after valid code verification by both parties; expired,
      superseded or over-attempted codes are rejected; the plain confirm action no longer exists;
      admin override still works.
- [ ] An ADMINISTRADOR lists pending and expired evidence across all organizaciones, filters by
      nivel/requisito/tipoEvidencia, pages through results, and approves/observes from the queue.
- [ ] A donante creates a `FONDO_COMUN` donación with no necesidad; `modalidad` cannot be changed
      afterwards; existing `DIRECTA` flows behave exactly as before.
- [ ] An ADMINISTRADOR runs a ronda; each assignment is persisted with ronda date, per-criterion
      scores, total and `costoOportunidad`, and the donante sees them in Mis donaciones.
- [ ] Organizaciones with a history of delivered donaciones score higher on the compliance term;
      organizaciones without history receive the neutral prior; weights sum as specified.
- [ ] Per-service suites green per slice: `mvn test`, BFF `npm test`, admin `npm test` +
      `npm run build`, `go test ./...` (strict TDD per `openspec/config.yaml`).
