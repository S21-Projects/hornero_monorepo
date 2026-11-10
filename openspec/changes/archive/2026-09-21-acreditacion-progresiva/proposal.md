# Proposal: Acreditación Progresiva

## Intent

Accreditation of an `organizacion` today is a single boolean flip. `Organizacion` carries
`validada` (Boolean), `estado` (`PENDIENTE`/`APROBADA`/`RECHAZADA`) and one `validadoPor` FK that is
overwritten on every call (`jar_hornero_ms/src/main/java/org/example/domain/Organizacion.java:43-52`),
and `validar()` mutates all three with no actor history, no reason and no evidence
(`.../organizacion/OrganizacionService.java:85-107`). There is no audit or event entity anywhere in
the MS domain package. An admin cannot answer "why is this organizacion approved, who decided it,
and on what evidence" — and neither can the thesis.

The user requirement, verbatim: *"no podemos solo tener un crud, tiene que haber registro."*

This change replaces the boolean with a **progressive accreditation ladder** whose top rung is
exactly "ready to register at Banco de Alimentos Córdoba", backed by an **append-only event log**
that is the record of how each organizacion got where it is. Evidence is **declared, photo-attached
and admin-audited** — never system-verified. Success looks like: an admin opens an organizacion,
sees its level, sees each requirement with its evidence and validity date, raises or lowers the
level with a recorded reason, and exports a dossier (`legajo`) that reads as a defensible audit
trail rather than a screenshot of a checkbox.

## Scope

### In Scope

- **Accreditation ladder**: a `NivelAcreditacion` enum with 4 levels (N0–N3), stored on
  `Organizacion` as an additive nullable Java-defaulted column, plus a legal-transition table in the
  service layer modelled on the `TRANSICIONES_PERMITIDAS` precedent in `DonacionService.java:36-46`.
- **Requirement catalogue**: the 9 union requirements of Banco de Alimentos Córdoba as an enum,
  each mapped to the level that demands it.
- **Evidence entity** (`organizacion_evidencia`): one row per requirement submission, carrying its
  own validity window, an optional R2 object key for a photo, an optional declaration text, and an
  audit state set by an admin. Expiry is **record-and-warn**: a passed `validoHasta` marks the
  evidence expired on read; the level never drops by itself.
- **Append-only event log** (`organizacion_evento`): every accreditation-relevant fact as an
  immutable row — registration, evidence attached/replaced, requirement approved/observed, level
  raised/lowered, referente reassigned. Emitted only by the MS service layer, inside the same
  transaction as the state write.
- **Legajo export**: a server-assembled dossier (level, per-requirement evidence with
  CURRENT/EXPIRED/MISSING status, full chronological event log), rendered as a printable view in
  `ts_hornero_admin`.
- **Referente evidence submission** in `ts_hornero_admin`: upload photo + declaration per
  requirement; **admin audit queue**: approve/observe each requirement, raise/lower the level with a
  mandatory reason.
- **Authenticated evidence-file route** in the BFF, distinct from the existing public image route.
- **Level-driven caps**: which food categories an organizacion may request, and how many
  `necesidad` records it may hold open at once. This requires introducing a `CategoriaAlimento`
  vocabulary, which does not exist in the MS today (see Approach).
- **Go worker**: accreditation as a hard filter inside `acepta()`
  (`go_algorithms_worker/internal/assign/scoring.go:116-126`), never a fifth weighted term in
  `Score()` (`scoring.go:149-152`).

### Out of Scope

- **Hash chain over the event log.** Deferred, and layerable on the same rows later. Honest
  rationale: SHA-256 is keyless, so a chain stored in the same PostgreSQL the application can
  `UPDATE` detects accidental corruption, not deliberate tampering — whoever edits a row recomputes
  the chain forward. Making it evidence requires revoking `UPDATE`/`DELETE` from the app's DB role
  or anchoring the latest hash off-device, both operational costs on a single Raspberry Pi.
- **Quantity / volume model.** No quantity or unit field is added to `Necesidad` or `Donacion`. The
  cap is category + concurrency only.
- **Automatic level decay.** No scheduled job, no on-read level recomputation. Expiry is surfaced,
  never acted on.
- **System verification of any requirement.** No registry lookups, no OCR, no geocoded proof of the
  50 km radius. Distance may be *displayed* from the existing `latitud`/`longitud`, but the
  requirement is satisfied by admin audit.
- **Hibernate Envers.** Not a current dependency (`jar_hornero_ms/pom.xml`); it audits ORM row
  revisions, not domain evidence, and its revision tables do not shape into a human-readable legajo.
- **Public display of the level** on `ts_hornero_astro`. The ladder stays internal/admin-facing in
  this change; a public badge is a separate product decision.
- **Wiring the Go worker into a live round.** `main.go:105` still describes the round JSON as "the
  contract the BFF *would* post"; no transport exists. This change modifies the scoring package and
  its tests only.
- **PDF generation server-side.** No headless browser on the Pi (see Approach).
- **Retiring `validada` / `estado`.** Both columns stay and keep their current meaning.

## Capabilities

### New Capabilities

- `organizacion-acreditacion`: the N0–N3 ladder, the 9-requirement catalogue and its
  level mapping, legal level transitions, who may trigger each, and the caps a level imposes
  (permitted food categories, maximum concurrent open `necesidades`).
- `organizacion-evidencia`: evidence items per requirement — declaration and/or photo, own validity
  window, admin audit states, replacement semantics, expired-but-not-demoted behaviour, and
  access control over evidence files.
- `organizacion-evento-log`: the append-only record — event taxonomy, who may emit, immutability
  rules, and the invariant that the stored level is reconstructible by replaying the log.
- `organizacion-legajo`: dossier contents, per-requirement CURRENT/EXPIRED/MISSING reporting, and
  the explicit "declared and audited, not system-verified" disclosure.

### Modified Capabilities

- `organizacion-self-edit`: the evidence submission channel is a *second*, independent
  referente→admin approval flow. The spec must state that it does not use, replace or interfere with
  the single mutable pending snapshot (`Organizacion.java:80-92`), and that an
  `infoPublicaPendiente` submission is not an accreditation event.
- `referente-organizacion-assignment`: reassigning an organizacion MUST log a
  `REFERENTE_REASIGNADO` event and MUST NOT alter `nivel`, `estado` or `validada`. This extends the
  existing invariant rather than changing it.

## Approach

### 1. The ladder (4 levels)

| Level | Name | What it demands | What it grants |
|---|---|---|---|
| N0 | `REGISTRADA` | Nothing proven. Self-registration only. | Visible to admins only. MAY NOT publish `necesidades`. |
| N1 | `IDENTIFICADA` | Identity requirements: the organizacion and its referente are identified, a fixed physical address/premises exists, and the declared purpose is food assistance to people in vulnerable situations. | Public listing. Non-perishable categories. Low concurrency cap. |
| N2 | `OPERATIVA` | N1 + adequate sanitary conditions for handling and storing food, no kiosk/almacén co-located at the same address, and premises within 50 km of Banco de Alimentos. | Refrigerated and frozen categories unlocked. Higher concurrency cap. |
| N3 | `ACREDITADA` | N2 + valid legal documentation (one of: Asociación Simple, Asociación Civil, Fichero de Culto, Fundación, Cooperativa, Centro de Jubilados, Centro Vecinal, Aval de otra personería jurídica) and a recorded acceptance of unannounced audits. | **"Ready to register at Banco de Alimentos Córdoba"** — every union requirement satisfied. All categories, highest concurrency cap. |

Levels are cumulative: N3 requires every requirement below it to be currently approved.

**Requirement-set caveat for `sdd-spec`.** Five of the nine union requirements are quoted with
evidence in the exploration artifact: the 50 km radius measured from Banco de Alimentos, the eight
documentation options, adequate sanitary conditions, acceptance of unannounced audits, and no
kiosk/grocery at the same address. The remaining four (organizacion identity, identified referente,
fixed premises/serving operation, food-assistance purpose) are named above from the structure of the
flow, **not** transcribed from the source. `sdd-spec` MUST transcribe all nine verbatim from
<https://bancodealimentoscba.org.ar/suma-a-tu-comedor/> and the signup form before freezing the
enum. The ladder's shape does not depend on that wording; the enum constants do.

**Backwards compatibility.** `validada` and `estado` keep working exactly as today and become a
projection of the ladder: `estado = APROBADA ⟺ nivel ≥ N1`. Existing approved rows map to N1,
`PENDIENTE` to N0, `RECHAZADA` to N0 with a rejection event. This keeps `findBySlugPublic`'s
`APROBADA` filter (`OrganizacionService.java:127`), the BFF and the Astro public site untouched.

### 2. Evidence

`organizacion_evidencia`: `organizacion_id`, `requisito` (enum), `tipoEvidencia`
(`DECLARACION` | `FOTO` | `DOCUMENTO`), `objectKey` (nullable R2 key), `declaracion` (nullable text),
`validoDesde`, `validoHasta` (nullable = never expires), `estado`
(`PENDIENTE` | `APROBADA` | `OBSERVADA` | `REEMPLAZADA`), `cargadoPor`/`cargadoEn`,
`revisadoPor`/`revisadoEn`. Replacing evidence inserts a new row and marks the previous
`REEMPLAZADA` — history is never overwritten. `expirada` is derived on read
(`validoHasta < today`), stored nowhere, and never triggers a level change.

**Photos reuse the existing S3/R2 path** (`ts_hornero_bff/src/upload/upload.service.ts`) with a new
`org-evidencia/{orgId}/` prefix. They MUST NOT be served through the existing image route:
`GET /images?key=` is `@Public()` and streams any key in the bucket
(`ts_hornero_bff/src/images/images.controller.ts:8-23`), which would make sanitary-condition photos
and personería documents world-readable. This change adds an authenticated, ownership-checked
evidence-file route guarded by `@Roles(ADMINISTRADOR)` plus owning-`REFERENTE`, keeping the three
enforcement layers (MS `SecurityConfig`, BFF `RolesGuard`, SPA `ProtectedRoute`) in sync.

### 3. The event log

`organizacion_evento`: `organizacion_id`, `tipo`, `ocurridoEn`, `actorUsuarioId`, `actorTipo`,
`nivelAntes`, `nivelDespues` (nullable), `requisito` (nullable), `evidenciaId` (nullable), `motivo`
(text), `payload` (canonical JSON stored as `text`, never `jsonb` — PostgreSQL normalizes `jsonb` on
write, which would break a future hash chain).

Events are emitted **only** by the MS service layer, inside the same `@Transactional` as the state
write. The BFF and the SPA never write events. The repository exposes inserts and finders only; no
update or delete method is written, so append-only is enforced by the absence of the operation.

**Current level is a stored column, not a replay.** Per the record-and-warn decision there is no
on-read recomputation. The stored `nivel` is authoritative for reads (cheap on a Pi); the log is
authoritative for *why*. The binding invariant, which a test MUST assert: replaying the log for an
organizacion reconstructs exactly its stored `nivel`. Every write to `nivel` appends its event in the
same transaction, so the two cannot diverge.

### 4. Caps, and the category gap

The level caps **category and concurrency, not quantities**. Two halves:

- **Concurrency** is enforceable today, entirely in the MS: on `necesidad` creation, count the
  organizacion's `ABIERTA` + `EN_PROGRESO` rows (`EstadoNecesidad.java:3-8`) against the level's cap
  and reject beyond it. No new field.
- **Category is not.** A case-insensitive grep for `categoria` across `jar_hornero_ms` returns zero
  matches, and `Necesidad` has only `descripcion`, `prioridad`, `estado`, `fechaPublicacion`,
  `fechaVencimiento` (`Necesidad.java:16-43`). The `CategoriasAceptadas` field the Go worker filters
  on (`scoring.go:56-58`) has no producer in the MS at all. So the category cap requires introducing
  a `CategoriaAlimento` enum and an additive nullable `categoria` column on `Necesidad`, with null
  meaning "unclassified" and behaving as it does today. That is real scope, and `sdd-design` must
  size it.

In the worker, the cap is a hard filter extending `acepta()` (`scoring.go:116-126`) — infeasible
pairs already return `false` and become `Inf` in the cost matrix (`scoring.go:157-168`). It is
**never** a fifth weighted term in `Score()` (`scoring.go:149-152`): counting accreditation on both
sides rewards the same thing twice and penalizes precisely the newly accredited organizacion in an
underserved area, the one the system exists to find.

Level cap values (N1: 3 open, N2: 6, N3: 12) are proposal-level defaults to be confirmed in spec, and
belong in configuration, not hardcoded in the worker.

### 5. Legajo export

Assembled by the MS as JSON, proxied by the BFF, rendered by `ts_hornero_admin` as a printable view
with a print stylesheet. **No server-side PDF generation**: headless Chromium on a Raspberry Pi 5 is
a ~400 MB image and a multi-hundred-MB RSS spike per render on a device already running five
containers plus PostgreSQL. Browser print-to-PDF gives the same artifact at zero device cost and
zero new dependency. Contents: organizacion identity and current level with its since-date; per
requirement, its status (`APROBADA` / `OBSERVADA` / `PENDIENTE` / `FALTANTE`), evidence type, validity
window, **`VIGENTE` or `VENCIDA`**, and who audited it when; links to evidence photos; the full
chronological event log; and a footer stating plainly that this dossier records declared and
admin-audited evidence, not system-verified facts.

### 6. No new services

Nothing here adds a process, a daemon or a dependency. New tables and endpoints in existing
services; no Redis; no scheduled job (the record-and-warn decision removed the only candidate).
Pi cost is the storage of the new rows and evidence images, and images already live in R2, off-device.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `jar_hornero_ms/.../domain/Organizacion.java` | Modified | Additive nullable `nivel` column (Java-defaulted `N0`), per the D4 pattern at lines 67-70 |
| `jar_hornero_ms/.../domain/Necesidad.java` | Modified | Additive nullable `categoria` (`CategoriaAlimento`) |
| `jar_hornero_ms/.../domain/` | New | `NivelAcreditacion`, `RequisitoAcreditacion`, `CategoriaAlimento`, `TipoEventoOrganizacion`, `OrganizacionEvidencia`, `OrganizacionEvento` |
| `jar_hornero_ms/.../organizacion/OrganizacionService.java` | Modified | `validar()`/`rechazar()` (lines 85-122) become level transitions that emit events; new transition table, evidence audit, legajo assembly |
| `jar_hornero_ms/.../necesidad/` | Modified | Concurrency and category cap check on creation |
| `jar_hornero_ms/.../config/SecurityConfig` | Modified | New authenticated accreditation and evidence endpoints |
| `ts_hornero_bff/src/organizaciones/` | Modified | Proxy routes for ladder, evidence submission, audit actions, legajo |
| `ts_hornero_bff/src/upload/upload.service.ts` | Modified | `uploadOrgEvidencia()` under an `org-evidencia/` prefix |
| `ts_hornero_bff/src/` (new module) | New | Authenticated evidence-file streaming route — NOT the `@Public()` `/images` route |
| `ts_hornero_admin/src/` | New/Modified | Referente evidence submission screen; admin audit queue; level panel with transition + reason; printable legajo view |
| `go_algorithms_worker/internal/assign/scoring.go` | Modified | `Candidato` gains the permitted-category set from the level; `acepta()` filters on it |
| `ts_hornero_astro` | **Unchanged** | Public site reads `APROBADA`, which is preserved |
| `ts_hornero_app` | **Unchanged** | Deprecated; no work planned |
| Auth/cookie model, `Donacion`, OTP flow, pending info-pública snapshot | **Unchanged** | Explicitly untouched |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A `NOT NULL` or defaulted column breaks `ddl-auto=update` on a non-empty table | Med | Every new column additive, nullable, Java-defaulted, per the D4 comment (`Organizacion.java:67-70`). Any exception must be called out and shipped as hand-written SQL |
| Evidence photos leak through the public `GET /images?key=` route | **High if ignored** | Dedicated authenticated route; explicit spec requirement that evidence keys are never served by `ImagesController` |
| Reassignment silently changes accreditation | Med | `REFERENTE_REASIGNADO` is a logged non-accreditation event; regression test asserts `nivel`/`estado`/`validada` unchanged |
| Stored `nivel` drifts from the event log | Med | Same-transaction emission plus a replay-equals-stored test |
| The exact 9-requirement wording is not yet transcribed | High | Flagged as a spec-phase prerequisite above; ladder shape is independent of it |
| Category cap needs a vocabulary the MS does not have | High | Scoped explicitly as part of this change; nullable `categoria` keeps existing `necesidades` behaving as today |
| Change is far over the 400-line review budget under the cached `single-pr` strategy | **High** | `sdd-tasks` must forecast and recommend slices: (1) event log + ladder in MS, (2) evidence + files, (3) admin SPA, (4) caps + worker |
| Two parallel referente→admin approval flows confuse users | Med | Spec must keep them visually and structurally separate in `ts_hornero_admin` |

## Rollback Plan

1. **Pre-merge**: revert the feature branch. No production schema has changed.
2. **Post-deploy, code only**: redeploy the previous container images. New columns and tables remain
   in PostgreSQL but are additive and nullable, so the previous code ignores them —
   `validada`/`estado` were never removed and still drive every public read.
3. **Data**: the event log and evidence tables are append-only and orphan-safe; they can be left in
   place indefinitely. If removal is required, `DROP TABLE organizacion_evento, organizacion_evidencia`
   and `ALTER TABLE organizaciones DROP COLUMN nivel` / `ALTER TABLE necesidades DROP COLUMN categoria`
   by hand — `ddl-auto=update` never drops.
4. **Evidence files in R2**: delete the `org-evidencia/` prefix. No other prefix is touched.
5. **Worker**: `scoring.go` changes are behaviour-neutral when the permitted-category set is empty,
   matching the existing "empty means accepts anything" rule (`scoring.go:117`).

## Dependencies

- Verbatim transcription of the 9 union requirements from
  <https://bancodealimentoscba.org.ar/suma-a-tu-comedor/> and the signup form — blocks the
  `RequisitoAcreditacion` enum only, not the rest of the design.
- Confirmed level cap numbers (open-`necesidad` limits and the category-to-level mapping) — product
  values, defaults proposed above.
- A confirmed coordinate for Banco de Alimentos Córdoba, if the 50 km distance is to be *displayed*
  as an aid to the auditing admin.
- No new libraries, services or infrastructure.

## Success Criteria

- [ ] An organizacion has a level in {N0, N1, N2, N3}; N3 means every union requirement is currently
      approved, i.e. "ready to register at Banco de Alimentos".
- [ ] Every level change, evidence submission and audit decision appears as an immutable row in
      `organizacion_evento` with actor, timestamp and reason; no code path updates or deletes one.
- [ ] Replaying the event log for any organizacion reconstructs its stored `nivel` (asserted by test).
- [ ] Expired evidence is visibly flagged to the admin and the level does **not** change by itself.
- [ ] An admin exports a legajo showing, per requirement, its evidence, auditor, validity window and
      `VIGENTE`/`VENCIDA` status, plus the full chronological event log.
- [ ] Evidence photos are unreachable without authentication and ownership/admin role.
- [ ] An organizacion cannot exceed its level's open-`necesidad` count, nor request a food category
      its level does not permit.
- [ ] Reassigning an organizacion logs an event and leaves `nivel`, `estado` and `validada` unchanged.
- [ ] `ts_hornero_astro` and the public `APROBADA` contract behave exactly as before.
- [ ] Per-service suites green: `mvn test`, `npm test` (BFF), `npm test` + `npm run build` (admin),
      `go test ./...`.
