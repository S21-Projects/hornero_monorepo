# Design: Acreditación Progresiva

Technical design for the change proposed in `openspec/changes/acreditacion-progresiva/proposal.md`.
Requirement wording is owned by `sdd-spec`; this document owns the mechanism.

Services touched: **`jar_hornero_ms`** (primary), **`ts_hornero_bff`**, **`ts_hornero_admin`**,
**`go_algorithms_worker`**. Explicitly untouched: `ts_hornero_astro`, `ts_hornero_app` (deprecated).

---

## Technical Approach

The change is **one stored column plus two new append-only tables**, all written inside the same
Spring `@Transactional` unit as the state they describe.

- `Organizacion.nivel` (`NivelAcreditacion`, nullable, Java-defaulted `N0`) is the **read model**.
  It is authoritative for every query — a lookup on a Raspberry Pi must not fold an event stream.
- `organizacion_evento` is the **write history**. It answers *why*, *who*, *when* and *on what
  evidence*. It is never updated and never deleted.
- `organizacion_evidencia` is the **evidence store**: one immutable row per submission, with its own
  validity window and its own admin audit state. Replacement inserts a new row and marks the old one
  `REEMPLAZADA`.

The binding invariant between the read model and the history — *replaying the log reconstructs the
stored `nivel`* — is maintained structurally, not by a reconciliation job: the only code path that
writes `nivel` is a single private method that also appends the event, in the same transaction.

Backwards compatibility is a **projection, not a migration of meaning**: `estado` and `validada`
keep their current semantics and become derived (`estado = APROBADA ⟺ nivel ≥ N1`), so
`findBySlugPublic` (`OrganizacionService.java:127`), the BFF and the Astro public site are unchanged.

The work is deliberately cut into **two slices**. Slice A is complete and shippable on its own.
Slice B is scheduled after the thesis-document task (see *Slicing* below).

---

## Architecture Decisions

### AD-1: Stored `nivel` as the read model, event log as the record of truth-of-history

**Choice**: `Organizacion.nivel` is a stored, authoritative column. `organizacion_evento` is an
append-only history. Both are written in the same transaction, by the same method.

**Alternatives considered**:
1. *Derive the level from the log on every read.* Every `findBySlug`, every listing, every public
   page load folds an event stream per organizacion.
2. *Hibernate Envers.* Not a current dependency (`jar_hornero_ms/pom.xml`); it audits ORM row
   revisions, not domain evidence with independent expiry.

**Rationale**: (1) puts an O(events) fold on the hottest read path of a service running on one
Raspberry Pi 5 alongside four other containers plus PostgreSQL, and the user has already ruled out
on-read recomputation ("record-and-warn"). (2) produces revision tables that do not shape into a
human-readable legajo. The chosen split gives O(1) reads and a complete history, at the cost of one
invariant that must be tested — which is exactly what AD-3 does.

### AD-2: Reuse the `TRANSICIONES_PERMITIDAS` pattern — and state what it does not give us

**Choice**: `AcreditacionService` declares
`static final Map<NivelAcreditacion, Set<NivelAcreditacion>> TRANSICIONES_PERMITIDAS`
as an `EnumMap`/`EnumSet`, validated by a private `validateTransition(actual, siguiente)` that throws
`ResponseStatusException(BAD_REQUEST, "Invalid state transition: X -> Y")` — the exact shape of
`DonacionService.java:36-46` and `DonacionService.java:245-251`.

Legal transitions (single step, both directions — the ladder is cumulative, so skipping a rung would
mean asserting requirements nobody audited):

| From | To |
|---|---|
| `N0` | `N1` |
| `N1` | `N0`, `N2` |
| `N2` | `N1`, `N3` |
| `N3` | `N2` |

**What the precedent does NOT cover — and this change must add**: `validateTransition` in
`DonacionService` validates and mutates one `estado` column and logs **no actor, no timestamp and no
reason** (`Donacion.java` has only bare columns `confirmadaDonanteEn`, `confirmadaReferenteEn`,
`overrideEn` — there is no history entity anywhere in `org/example/domain/`). It is therefore a
**transition validator** precedent, not an audit precedent. Reusing it alone does not satisfy *"no
podemos solo tener un crud, tiene que haber registro."* The transition table is the guard; the event
append is the record. Both are required.

**Rationale**: matching an existing, tested in-repo pattern costs nothing and keeps the MS legible.
Inventing a state-machine abstraction for two call sites would not.

### AD-3: The replay invariant is enforced by construction, not by reconciliation

**Choice**: a single private method is the **only** writer of `nivel`:

```java
private void aplicarTransicion(Organizacion org, NivelAcreditacion destino,
                               Administrador actor, String motivo,
                               TipoEventoOrganizacion tipo) {
    NivelAcreditacion antes = nivelActual(org);      // null-coalescing, see AD-6
    validateTransition(antes, destino);
    org.setNivel(destino);
    proyectarEstadoLegacy(org);                      // AD-6
    eventoRepository.save(OrganizacionEvento.de(org, tipo, actor, motivo, antes, destino));
}
```

`OrganizacionEventoRepository` extends `Repository<OrganizacionEvento, Long>` — **not**
`JpaRepository` — and declares only `save`, `findByOrganizacion_IdOrderByOcurridoEnAscIdAsc` and
`findByOrganizacion_IdAndTipoIn`. There is no `delete`, no `deleteAll`, no `saveAndFlush`-with-id and
no derived update. Append-only is enforced by **the absence of the operation**, which is checkable by
reading one file.

A pure function `AcreditacionReplay.reconstruir(List<OrganizacionEvento>) -> NivelAcreditacion` folds
the level-changing events (`nivelDespues` of the last event that carries one, starting at `N0`). The
test asserting `reconstruir(log(org)) == org.getNivel()` is the success criterion made executable.

**Alternatives considered**: a scheduled reconciliation job comparing stored level to replayed level.
**Rationale**: rejected — a job that detects the drift after the fact is strictly worse than a code
path that cannot drift, and it is a new scheduled component on a device where the record-and-warn
decision just removed the only other candidate for one.

### AD-4: Evidence is a separate table, structurally disjoint from the pending info-pública snapshot

**Choice**: `organizacion_evidencia` is its own table with its own lifecycle. It does **not** touch
`aceptaDonacionesPendiente` / `sitioWebUrlPendiente` / `donacionDirectaUrlPendiente` /
`infoPublicaPendienteEn` (`Organizacion.java:80-92`), and the accreditation service never calls
`seedPendiente`, `limpiarPendiente`, `aprobarInfoPublica` or `rechazarInfoPublica`
(`OrganizacionService.java:274-322`).

The two flows are kept apart on four axes:

| | Info-pública self-edit | Evidence submission |
|---|---|---|
| Storage | one mutable snapshot on `organizaciones` | one immutable row per submission in `organizacion_evidencia` |
| Cardinality | at most one pending change per org | many pending items, independently audited |
| Service | `OrganizacionService` | new `AcreditacionService` |
| Endpoints | `PATCH /api/organizaciones/{id}/info-publica[/aprobar\|/rechazar]` | `POST/PATCH /api/organizaciones/{id}/acreditacion/...` |
| Emits an accreditation event? | **No** | Yes |

**Rationale**: the existing snapshot is one mutable pending row that scales to three scalar fields.
It cannot express "3 of 5 documents renewed, 2 expiring" — and forcing it to would make an
`infoPublicaPendiente` submission indistinguishable from an accreditation fact, which the proposal
explicitly forbids. Keeping them disjoint also means this change cannot regress the shipped
self-edit flow: no line of `OrganizacionService.java:206-322` is edited.

### AD-5: Event payload is canonical JSON stored as `text`

**Choice**: `payload` is `@Column(columnDefinition = "text")` holding a String produced by an
`ObjectMapper` configured with `SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS` and
`MapperFeature.SORT_PROPERTIES_ALPHABETICALLY`, exposed as a single `@Bean` named
`canonicalObjectMapper` so it cannot silently diverge from the default mapper.

**Alternatives considered**: `jsonb`.
**Rationale**: PostgreSQL normalizes `jsonb` on write — it reorders keys, drops duplicate keys and
reformats numbers. The bytes read back are not the bytes written, which makes any future hash chain
over these rows unverifiable. The hash chain is out of scope here, but the column type is the one
decision that would be expensive to reverse once rows exist, so it is made now. Cost of `text`: no
JSON operators in queries — acceptable, because nothing queries inside the payload (the queryable
facts are first-class columns).

### AD-6: `estado`/`validada` become a projection of `nivel`, written by one function

**Choice**:

```java
private void proyectarEstadoLegacy(Organizacion org) {
    boolean acreditada = nivelActual(org).compareTo(NivelAcreditacion.N1) >= 0;
    if (acreditada) {
        org.setEstado(EstadoOrganizacion.APROBADA);
        org.setValidada(true);
    } else if (org.getEstado() != EstadoOrganizacion.RECHAZADA) {
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        org.setValidada(false);
    }
}
```

`RECHAZADA` is preserved rather than collapsed to `PENDIENTE`, because `crear()` counts it
(`countByReferente_IdAndEstadoNot(..., RECHAZADA)`, `OrganizacionService.java:46`) to enforce the
3-organizacion cap — collapsing it would silently re-open that cap for rejected orgs.

`nivelActual(org)` returns `org.getNivel() == null ? NivelAcreditacion.N0 : org.getNivel()`, the
null-coalescing read pattern already used for `aceptaDonaciones` at `OrganizacionService.java:351`.

**Rationale**: `findBySlugPublic` filters on `APROBADA` (`OrganizacionService.java:127`), and the
Astro public site plus the BFF read that contract. Keeping the projection in one function means the
public contract cannot drift as a side effect of a level change. `validar()` and `rechazar()`
(`OrganizacionService.java:85-122`) are rewritten to delegate to `AcreditacionService` so the two
paths cannot disagree.

### AD-7: Existing rows migrate via an idempotent startup backfill that seeds a genesis event

**Choice**: a `@Component AcreditacionBackfill implements ApplicationRunner` (the same lifecycle hook
as the shipped `DataInitializer`), guarded by `WHERE nivel IS NULL`:

| Current `estado` | Assigned `nivel` | Genesis event(s) |
|---|---|---|
| `APROBADA` | `N1` | `MIGRACION_INICIAL` (`nivelAntes=N0`, `nivelDespues=N1`, `motivo="Backfill: estado APROBADA"`) |
| `PENDIENTE` | `N0` | `MIGRACION_INICIAL` (`nivelAntes=N0`, `nivelDespues=N0`) |
| `RECHAZADA` | `N0` | `MIGRACION_INICIAL` + `REGISTRO_RECHAZADO` |
| `null` | `N0` | `MIGRACION_INICIAL` |

**Alternatives considered**: (a) leave `nivel` NULL forever and coalesce on read; (b) hand-written SQL
`UPDATE`.

**Rationale**: (a) is cheaper but **breaks AD-3** — a pre-existing approved org would replay to `N0`
while storing `N1`, and the invariant test would be a lie for every production row. (b) cannot write
the events, and `ddl-auto=update` gives us no migration file to hang it on. The backfill is
idempotent (the `nivel IS NULL` guard), runs once over a table with tens of rows, and costs the Pi a
single pass at boot. `MIGRACION_INICIAL` is deliberately a distinct event type so the legajo can
state plainly that this fact predates the ladder and was not audited.

**`validadoPor` stays.** It is overwritten on each call (`Organizacion.java:50-52`) and is therefore
not history, but removing it is a schema drop `ddl-auto=update` will not perform. It keeps its
current meaning: "the last admin who touched approval". The event log is the history.

### AD-8: New endpoints are NOT public — `SecurityConfig` needs an explicit matcher, declared first

**Finding that contradicts the naive reading of the proposal.** `SecurityConfig.java:50-56` grants
`permitAll()` to `GET /api/organizaciones/**`. Every new **GET** under that prefix —
`/{id}/acreditacion`, `/{id}/acreditacion/evidencias`, `/{id}/legajo` — would be **world-readable by
default**, exposing evidence declarations, auditor identities and the full event log to anonymous
users. `@PreAuthorize` on the controller does not save it: the filter chain grants access before
method security is consulted.

**Choice**: declare explicit matchers **before** the `permitAll` block, following the in-repo
precedent and its comment at `SecurityConfig.java:42-48` (`/api/donaciones/activas`):

```java
.requestMatchers(HttpMethod.GET,
        "/api/organizaciones/*/acreditacion",
        "/api/organizaciones/*/acreditacion/**",
        "/api/organizaciones/*/legajo").authenticated()
```

plus `@PreAuthorize` on each controller method as defense in depth. Spring evaluates matchers in
declaration order, so placement is load-bearing and must be covered by a test, not a comment.

**Rationale**: this is the single highest-severity issue in the change and it is invisible unless you
read `SecurityConfig` and the new controller together. See the *HTTP Authorization Boundary Matrix*.

### AD-9: Raising a level is gated on requirement completeness; expiry never lowers a level

**Choice**: `subirNivel(orgId, destino, motivo)` rejects with `409 CONFLICT` unless **every**
`RequisitoAcreditacion` whose `nivelExigido <= destino` has an evidencia in state `APROBADA`.
An `APROBADA` evidencia whose `validoHasta < today` (derived `expirada`) **blocks a raise** but
**never triggers a drop**. Lowering a level (`bajarNivel`) requires only a non-blank `motivo`.

**Alternatives considered**: allow raising with a reason over missing requirements (admin override).
**Rationale**: the ladder's entire claim is "N3 means every union requirement is currently approved".
An override makes that claim unfalsifiable. The admin's escape hatch already exists and is the
correct one: approve the evidencia first, which is itself a logged event. Blocking a raise on expired
evidence is consistent with record-and-warn: record-and-warn constrains what the system does *by
itself*; it says nothing about letting an admin promote on stale proof.

### AD-10: The Go worker gets a second hard filter, not a fifth weighted term

**Choice**: `Candidato` gains

```go
// CategoriasPermitidas is the set the organizacion's accreditation level
// allows it to receive. Empty means uncapped, matching CategoriasAceptadas.
CategoriasPermitidas []string `json:"categoriasPermitidas,omitempty"`
```

and `acepta()` (`scoring.go:116-126`) requires membership in **both** sets. The two sets are kept
distinct on purpose: `CategoriasAceptadas` is *what the necesidad asked for*,
`CategoriasPermitidas` is *what the level allows*. Collapsing them at the producer would make an
accreditation-driven rejection indistinguishable from a demand mismatch in the round output.

Empty `CategoriasPermitidas` is a no-op, matching the existing "empty means accepts anything" rule at
`scoring.go:117` — which is what makes this change behaviour-neutral until a producer exists.

**The concurrency cap is not in the worker at all.** It is enforced in `NecesidadService.crear`, so
an over-cap necesidad is never created and never reaches a round.

**Alternatives considered**: a fifth weighted term in `Score()` (`scoring.go:149-152`).
**Rationale (carried from exploration, restated because it is the load-bearing one)**: counting
accreditation as a weight rewards the same property twice — once by unlocking a category, once by
boosting the score — and it penalizes precisely the newly accredited organizacion in an underserved
area, which is the case the deficit term exists to find. A hard filter caps; a weight ranks. The
requirement is a cap.

### AD-11: Legajo is MS-assembled JSON, BFF-proxied, printed by the browser

**Choice**: `GET /api/organizaciones/{id}/legajo` returns a fully assembled `LegajoResponse`; the BFF
proxies it unchanged; `ts_hornero_admin` renders `/organizaciones/:id/legajo` with a `@media print`
stylesheet and relies on the browser's print-to-PDF.

**Alternatives considered**: headless Chromium / Puppeteer in the BFF.
**Rationale**: a headless-Chromium image is ~400 MB and spikes several hundred MB RSS per render, on
a Pi 5 already running five containers plus PostgreSQL. Browser print-to-PDF yields the same artifact
at zero device cost and zero new dependency. Assembly in the MS (not the SPA) keeps the dossier's
contents — including the "declared and admin-audited, not system-verified" disclosure — a
server-owned fact rather than something a client could omit.

---

## Data Model

All three shapes are **additive, nullable and Java-defaulted**, per the D4 comment at
`Organizacion.java:67-70`: `ddl-auto=update` cannot add a `NOT NULL` column without a `DEFAULT` to a
non-empty table.

### `Organizacion` — one added column

```java
// D8: additive/nullable per D4. nivelActual() coalesces null -> N0; the
// AcreditacionBackfill runner fills it once at boot (AD-7).
@Enumerated(EnumType.STRING)
@Column(name = "nivel", nullable = true)
private NivelAcreditacion nivel = NivelAcreditacion.N0;
```

### `organizacion_evento` (new table, append-only)

| Column | Java type | Null | Note |
|---|---|---|---|
| `id` | `Long` | no | `IDENTITY` |
| `organizacion_id` | `Organizacion` | no | `@ManyToOne(LAZY)`, indexed |
| `tipo` | `TipoEventoOrganizacion` | no | `@Enumerated(STRING)` |
| `ocurrido_en` | `Instant` | no | set in the factory, never by the caller |
| `actor_usuario_id` | `Long` | yes | plain id, **not** a FK — the log must survive user deletion |
| `actor_tipo` | `String` | yes | JWT `tipo` discriminator, or `SISTEMA` for the backfill |
| `nivel_antes` | `NivelAcreditacion` | yes | |
| `nivel_despues` | `NivelAcreditacion` | yes | non-null only on level-changing events |
| `requisito` | `RequisitoAcreditacion` | yes | |
| `evidencia_id` | `Long` | yes | plain id, not a FK |
| `motivo` | `String` | yes | `length = 1000` |
| `payload` | `String` | yes | `columnDefinition = "text"`, canonical JSON (AD-5) |

No `@Setter` on the entity: fields are `final`-in-spirit, populated by a static factory
`OrganizacionEvento.de(...)` and read-only thereafter (`@Getter` + `@NoArgsConstructor(access =
PROTECTED)` for JPA). An entity with no setters is an entity the rest of the codebase cannot mutate.

Index: `@Index(name = "idx_evento_org_ocurrido", columnList = "organizacion_id, ocurrido_en")` —
`ddl-auto=update` does create indexes declared on `@Table`.

`TipoEventoOrganizacion` (initial set): `MIGRACION_INICIAL`, `ORGANIZACION_REGISTRADA`,
`REGISTRO_RECHAZADO`, `EVIDENCIA_CARGADA`, `EVIDENCIA_REEMPLAZADA`, `REQUISITO_APROBADO`,
`REQUISITO_OBSERVADO`, `NIVEL_SUBIDO`, `NIVEL_BAJADO`, `REFERENTE_REASIGNADO`.

### `organizacion_evidencia` (new table, immutable rows)

| Column | Java type | Null | Note |
|---|---|---|---|
| `id` | `Long` | no | |
| `organizacion_id` | `Organizacion` | no | `@ManyToOne(LAZY)`, indexed |
| `requisito` | `RequisitoAcreditacion` | no | |
| `tipo_evidencia` | `TipoEvidencia` | no | `DECLARACION` \| `FOTO` \| `DOCUMENTO` |
| `object_key` | `String` | yes | R2 key under `org-evidencia/{orgId}/` — **Slice B only** |
| `declaracion` | `String` | yes | `length = 2000` |
| `valido_desde` | `LocalDate` | yes | defaults to submission date |
| `valido_hasta` | `LocalDate` | yes | **null means never expires** |
| `estado` | `EstadoEvidencia` | no | `PENDIENTE` \| `APROBADA` \| `OBSERVADA` \| `REEMPLAZADA` |
| `cargado_por` / `cargado_en` | `Long` / `Instant` | no | |
| `revisado_por` / `revisado_en` | `Long` / `Instant` | yes | |
| `observacion` | `String` | yes | `length = 1000`, the auditor's note on `OBSERVADA` |

`estado` is the **one** mutable field (`PENDIENTE → APROBADA|OBSERVADA`, and `* → REEMPLAZADA`), and
every mutation appends its own event. Content fields (`declaracion`, `objectKey`, validity window)
are never rewritten — a correction is a new row plus `REEMPLAZADA` on the old one.

`expirada` is **derived on read**, stored nowhere:
`evidencia.getValidoHasta() != null && evidencia.getValidoHasta().isBefore(LocalDate.now())`.

### `Necesidad` — one added column (**Slice B**)

```java
@Enumerated(EnumType.STRING)
@Column(name = "categoria", nullable = true)
private CategoriaAlimento categoria;   // null == unclassified == today's behaviour
```

Verified: `rg -i categoria jar_hornero_ms/` returns **zero** matches today; `Necesidad.java:16-43`
has only `descripcion`, `prioridad`, `estado`, `fechaPublicacion`, `fechaVencimiento`. The
`CategoriasAceptadas` field the worker filters on (`scoring.go:56-58`) has **no producer anywhere**.

### Hand-written SQL

**None required.** Every column is additive and nullable; both new tables are new. The only
non-`ddl-auto` step is the `AcreditacionBackfill` runner (AD-7), which is Java, idempotent, and ships
with the code rather than as a loose SQL file. Should a future change want `NOT NULL` on `nivel`,
that is a hand-written `ALTER` and must be flagged then — not now.

---

## Data Flow

### Evidence submission → audit → level raise

```
REFERENTE (ts_hornero_admin)
   │ POST /organizaciones/:id/acreditacion/evidencias   { requisito, declaracion, validoHasta }
   ▼
ts_hornero_bff  AcreditacionController → AcreditacionService
   │ cookie access_token ──► Authorization: Bearer   (NecesidadesService.crear precedent)
   ▼
jar_hornero_ms  POST /api/organizaciones/{id}/acreditacion/evidencias   @PreAuthorize REFERENTE
   │
   ├─ ownership check: org.referente.id == principal        (else 403)
   │
   └─ @Transactional ───────────────────────────────────────────────┐
        insert organizacion_evidencia (estado = PENDIENTE)          │ one unit
        mark prior row for same requisito REEMPLAZADA (if any)      │ of work
        append EVIDENCIA_CARGADA  [+ EVIDENCIA_REEMPLAZADA]         │
      ──────────────────────────────────────────────────────────────┘

ADMINISTRADOR (ts_hornero_admin, audit queue)
   │ PATCH /organizaciones/:id/acreditacion/evidencias/:evId/aprobar   { }
   ▼                                              (or /observar { observacion })
jar_hornero_ms  @PreAuthorize ADMINISTRADOR
   └─ @Transactional: evidencia.estado = APROBADA; append REQUISITO_APROBADO
                      ── nivel is NOT touched here ──

ADMINISTRADOR
   │ PATCH /organizaciones/:id/acreditacion/nivel   { destino: "N2", motivo: "..." }
   ▼
jar_hornero_ms  AcreditacionService.cambiarNivel
   ├─ validateTransition(N1, N2)                     → 400 if illegal
   ├─ requisitosCompletos(org, N2)                   → 409 if missing/expired (AD-9)
   └─ @Transactional ───────────────────────────────────────────────┐
        org.nivel = N2                                              │ one unit
        proyectarEstadoLegacy(org)   → estado/validada              │ of work
        append NIVEL_SUBIDO {actor, motivo, N1→N2}                  │
      ──────────────────────────────────────────────────────────────┘
```

Raising the level and approving evidence are **separate admin actions on purpose**: approving proof
and asserting a level are different claims, and conflating them would make the level change
unattributable to a decision.

### Legajo export

```
ADMINISTRADOR ──► ts_hornero_admin /organizaciones/:id/legajo
                        │ GET /organizaciones/:id/legajo (axios, withCredentials)
                        ▼
                  ts_hornero_bff  @Roles(ADMINISTRADOR)  ──► MS (Bearer)
                        ▼
                  jar_hornero_ms  GET /api/organizaciones/{id}/legajo
                        │ (explicit .authenticated() matcher — AD-8)
                        │ @PreAuthorize hasRole('ADMINISTRADOR')
                        ▼
                  LegajoAssembler:
                      identidad + nivel + nivelDesde (last NIVEL_* event)
                      per requisito: estado ∈ {APROBADA, OBSERVADA, PENDIENTE, FALTANTE}
                                     + tipoEvidencia + ventana + VIGENTE|VENCIDA
                                     + auditor + fecha de auditoría
                      eventos[] in chronological order
                      disclosure: "declared and admin-audited, not system-verified"
                        ▼
                  SPA renders + window.print()  →  browser PDF (AD-11)
```

### Reassignment (invariant preserved)

```
PATCH /api/organizaciones/{id}/referente   (unchanged endpoint, unchanged signature)
   └─ @Transactional: org.referente = nuevo
                      append REFERENTE_REASIGNADO {antes, despues}
                      nivel, estado, validada  ── UNTOUCHED ──
```

`asignarReferente` (`OrganizacionService.java:148-182`) gains exactly one line — the event append.
Its existing 3-organizacion cap check and its `null` unassign branch are unchanged.

---

## File Changes

### Slice A — `jar_hornero_ms`

| File | Action | Description |
|---|---|---|
| `domain/NivelAcreditacion.java` | Create | `N0, N1, N2, N3` (`REGISTRADA`, `IDENTIFICADA`, `OPERATIVA`, `ACREDITADA` as a display label) |
| `domain/RequisitoAcreditacion.java` | Create | 9 constants + `nivelExigido`. **Constant names/wording owned by `sdd-spec`** |
| `domain/TipoEventoOrganizacion.java` | Create | event taxonomy (listed above) |
| `domain/TipoEvidencia.java` | Create | `DECLARACION, FOTO, DOCUMENTO` |
| `domain/EstadoEvidencia.java` | Create | `PENDIENTE, APROBADA, OBSERVADA, REEMPLAZADA` |
| `domain/OrganizacionEvento.java` | Create | append-only entity, no setters, static factory |
| `domain/OrganizacionEvidencia.java` | Create | evidence entity; only `estado`/`revisado*` mutable |
| `domain/OrganizacionEventoRepository.java` | Create | `extends Repository<>`; save + finders only (AD-3) |
| `domain/OrganizacionEvidenciaRepository.java` | Create | save + `findByOrganizacion_Id`, `findByOrganizacion_IdAndRequisitoAndEstadoNot` |
| `domain/Organizacion.java` | Modify | add `nivel` (+ D8 comment) |
| `acreditacion/AcreditacionService.java` | Create | transition table, `cambiarNivel`, evidence submit/audit, replay, legajo assembly |
| `acreditacion/AcreditacionReplay.java` | Create | pure fold, no Spring, no repository |
| `acreditacion/AcreditacionController.java` | Create | the endpoints in *Interfaces* below |
| `acreditacion/dto/*.java` | Create | `CargarEvidenciaRequest`, `AuditarEvidenciaRequest`, `CambiarNivelRequest`, `AcreditacionResponse`, `EvidenciaResponse`, `EventoResponse`, `LegajoResponse` |
| `config/AcreditacionProperties.java` | Create | `@Value("${app.acreditacion.cap-n1:3}")` etc., per the `app.otp.*` precedent (`OtpService.java:38-41`) |
| `config/AcreditacionBackfill.java` | Create | idempotent `ApplicationRunner` (AD-7) |
| `config/SecurityConfig.java` | Modify | explicit `.authenticated()` matchers **before** the `permitAll` GET block (AD-8) |
| `config/CanonicalJsonConfig.java` | Create | `canonicalObjectMapper` bean (AD-5) |
| `organizacion/OrganizacionService.java` | Modify | `validar`/`rechazar` (85-122) delegate to `AcreditacionService`; `asignarReferente` (148-182) appends `REFERENTE_REASIGNADO`; `crear` (38-71) appends `ORGANIZACION_REGISTRADA` |
| `organizacion/dto/OrganizacionResponse.java` | Modify | add `nivel` (additive field; existing positional constructor call at `OrganizacionService.java:334-358` must be updated) |
| `necesidad/NecesidadService.java` | Modify | concurrency cap in `crear` (30-48) |
| `domain/NecesidadRepository.java` | Modify | add `long countByOrganizacion_IdAndEstadoIn(Long, Collection<EstadoNecesidad>)` |
| `resources/application.properties` | Modify | `app.acreditacion.cap-n0=0`, `cap-n1=3`, `cap-n2=6`, `cap-n3=12` |

### Slice A — `ts_hornero_bff`

| File | Action | Description |
|---|---|---|
| `acreditacion/acreditacion.module.ts` | Create | new module, registered in `app.module.ts` |
| `acreditacion/acreditacion.controller.ts` | Create | `@Roles(...)` per route; cookie → Bearer, `OrganizacionesController` precedent (lines 29-33) |
| `acreditacion/acreditacion.service.ts` | Create | thin `HttpService` proxy to `${JAVA_MS_URL}/api/...` |
| `acreditacion/dto/*.ts` | Create | request DTOs with `class-validator` |
| `images/images.controller.ts` | Modify | **reject keys beginning `org-evidencia/`** with 403 (pre-commitment guard, see *Slicing*) |
| `app.module.ts` | Modify | import `AcreditacionModule` |

### Slice A — `ts_hornero_admin`

| File | Action | Description |
|---|---|---|
| `lib/hooks/useAcreditacion.ts` | Create | TanStack Query hooks (`useAcreditacion`, `useCargarEvidencia`, `useAuditarEvidencia`, `useCambiarNivel`, `useLegajo`) |
| `components/acreditacion/NivelBadge.tsx` | Create | N0–N3 badge, reuses `components/Badge.tsx` |
| `components/acreditacion/EvidenciaForm.tsx` | Create | referente submission; **visually separate** from `components/org/InfoPublicaForm.tsx` (AD-4) |
| `components/acreditacion/AuditQueue.tsx` | Create | admin approve/observe per requisito, expiry warning |
| `components/acreditacion/NivelPanel.tsx` | Create | raise/lower with mandatory `motivo` |
| `routes/acreditacion.tsx` | Create | referente view, mounted under the `REFERENTE` guard |
| `routes/legajo.tsx` | Create | printable dossier + `@media print` stylesheet |
| `app/router.tsx` | Modify | two routes: `/acreditacion` (REFERENTE) and `/organizaciones/:id/legajo` (ADMINISTRADOR), inside the existing `ProtectedRoute` groups (lines 61-91) |
| `routes/admin.tsx` | Modify | link into the audit queue |

### Slice B (deferred — after the thesis-document task)

| File | Action | Description |
|---|---|---|
| `jar_hornero_ms/domain/CategoriaAlimento.java` | Create | food category vocabulary |
| `jar_hornero_ms/domain/Necesidad.java` | Modify | additive nullable `categoria` |
| `jar_hornero_ms/necesidad/NecesidadService.java` | Modify | category cap on `crear` |
| `jar_hornero_ms/necesidad/dto/*` | Modify | expose `categoria` |
| `jar_hornero_ms/acreditacion/AcreditacionService.java` | Modify | `categoriasPermitidas(nivel)` |
| `ts_hornero_bff/src/evidencia-files/*` | Create | authenticated, ownership-checked streaming route |
| `ts_hornero_bff/src/upload/upload.service.ts` | Modify | `uploadOrgEvidencia()` under `org-evidencia/{orgId}/` |
| `ts_hornero_bff/src/upload/upload.controller.ts` | Modify | `POST upload/org-evidencia/:id` |
| `ts_hornero_admin/components/acreditacion/EvidenciaForm.tsx` | Modify | enable photo attach |
| `go_algorithms_worker/internal/assign/scoring.go` | Modify | `CategoriasPermitidas` + `acepta()` (AD-10) |
| `go_algorithms_worker/internal/assign/scoring_test.go` | Modify | filter cases |

### Explicitly NOT changed

| Area | Why |
|---|---|
| `ts_hornero_astro` (all) | reads `estado = APROBADA`, preserved by AD-6 |
| `ts_hornero_app` (all) | deprecated; no work planned |
| `auth/`, cookie model, `JwtService` | no new role, no new claim |
| `Donacion`, `DonacionService` | donations are not accreditation facts |
| `OrganizacionService.java:206-322` (pending snapshot) | AD-4 keeps the flows disjoint — not one line edited |
| `hungarian.go`, `Score()`, `Pesos` | AD-10: filter, not weight |

---

## Interfaces / Contracts

### MS endpoints (all under `/api/organizaciones`, all explicitly `.authenticated()` — AD-8)

| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| `GET` | `/{id}/acreditacion` | ADMIN or owning REFERENTE | — | `AcreditacionResponse` |
| `POST` | `/{id}/acreditacion/evidencias` | owning REFERENTE | `CargarEvidenciaRequest` | `EvidenciaResponse` (201) |
| `PATCH` | `/{id}/acreditacion/evidencias/{evId}/aprobar` | ADMINISTRADOR | — | `EvidenciaResponse` |
| `PATCH` | `/{id}/acreditacion/evidencias/{evId}/observar` | ADMINISTRADOR | `{ observacion }` | `EvidenciaResponse` |
| `PATCH` | `/{id}/acreditacion/nivel` | ADMINISTRADOR | `CambiarNivelRequest` | `AcreditacionResponse` |
| `GET` | `/{id}/legajo` | ADMINISTRADOR | — | `LegajoResponse` |

Path-collision check: `@GetMapping("/{slug}")` (`OrganizacionController.java:76`) is a single-segment
pattern; every new GET has two or more segments, so Spring's most-specific-match wins and the
existing route is unaffected. The same holds for the BFF's `@Get(':slug')`
(`organizaciones.controller.ts:97-102`).

### DTO shapes

```java
public record CargarEvidenciaRequest(
    @NotNull  RequisitoAcreditacion requisito,
    @NotNull  TipoEvidencia tipoEvidencia,
    @Size(max = 2000) String declaracion,
    String objectKey,        // Slice A: MUST be null; 400 if present (see Slicing)
    LocalDate validoDesde,
    LocalDate validoHasta) { }   // null == never expires

public record CambiarNivelRequest(
    @NotNull NivelAcreditacion destino,
    @NotBlank @Size(max = 1000) String motivo) { }
```

```java
public record LegajoResponse(
    Long organizacionId, String nombre, String slug, String direccion,
    NivelAcreditacion nivel, Instant nivelDesde,
    List<RequisitoEnLegajo> requisitos,
    List<EventoResponse> eventos,
    String disclosure) { }      // server-owned constant, AD-11

public record RequisitoEnLegajo(
    RequisitoAcreditacion requisito, NivelAcreditacion nivelExigido,
    EstadoRequisitoLegajo estado,        // APROBADA | OBSERVADA | PENDIENTE | FALTANTE
    TipoEvidencia tipoEvidencia, String declaracion,
    LocalDate validoDesde, LocalDate validoHasta,
    boolean expirada,                    // derived: VIGENTE | VENCIDA
    String auditorNombre, Instant auditadoEn) { }
```

### The append-only repository surface (AD-3)

```java
@Repository
public interface OrganizacionEventoRepository
        extends org.springframework.data.repository.Repository<OrganizacionEvento, Long> {

    OrganizacionEvento save(OrganizacionEvento evento);

    List<OrganizacionEvento> findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(Long organizacionId);

    List<OrganizacionEvento> findByOrganizacion_IdAndTipoIn(
            Long organizacionId, Collection<TipoEventoOrganizacion> tipos);
}
```

Deliberately **not** `JpaRepository`: that interface would hand every caller `delete`, `deleteAll`,
`deleteById` and `saveAll`. The absence of the method is the enforcement.

### Go worker (Slice B)

```go
func (c Candidato) acepta(categoria string) bool {
    if categoria == "" {
        return true
    }
    return enConjunto(c.CategoriasAceptadas, categoria) &&
           enConjunto(c.CategoriasPermitidas, categoria)
}

// enConjunto: empty set means "no restriction", matching scoring.go:117.
func enConjunto(conjunto []string, valor string) bool {
    if len(conjunto) == 0 {
        return true
    }
    for _, v := range conjunto {
        if v == valor {
            return true
        }
    }
    return false
}
```

`Score()` (`scoring.go:130-155`) and `MatrizCosto()` (`scoring.go:160-174`) are untouched: an
infeasible pair already returns `false` and becomes `Inf` in the matrix.

---

## Slicing: what ships first, and what the system cannot do until Slice B

**Slice A is coherent and shippable on its own.** It delivers the ladder, the append-only log, the
replay invariant, text-declaration evidence, the audit queue, the level panel and the legajo.

**Slice B (after the thesis-document task)** delivers the `CategoriaAlimento` vocabulary with the
`Necesidad.categoria` column and the worker filter, plus the authenticated evidence-file route with
photo upload.

### What the system can do while Slice B is pending

- Full N0→N3 ladder with legal-transition enforcement, actor, timestamp and mandatory reason.
- Every accreditation fact recorded as an immutable row; legajo export with the full chronological log.
- Per-requirement evidence as **text declaration** with a validity window, audited by an admin,
  flagged `VIGENTE`/`VENCIDA`.
- The **concurrency cap** (N0: 0, N1: 3, N2: 6, N3: 12 open `necesidades`), which needs no new field
  and is enforced in `NecesidadService.crear`.

### What it cannot do, and the explicit rule for evidence photos

- **No category cap.** `Necesidad` has no `categoria` and the worker's `CategoriasAceptadas` has no
  producer, so there is nothing to cap. An organizacion at any level may publish a necesidad for
  anything; only the count is capped. This is today's behaviour, not a regression.
- **No evidence photos may be uploaded, at all.** This is a hard rule, not a preference. Evidence
  photos of sanitary conditions and personería documents are exactly the material that must not be
  world-readable, and `GET /images?key=` is `@Public()` and streams **any** key in the bucket
  (`ts_hornero_bff/src/images/images.controller.ts:8-23`). Until the ownership-checked route exists
  in Slice B:
  - The BFF exposes **no** `org-evidencia/` upload endpoint — an object with that prefix cannot be
    created through the application.
  - `CargarEvidenciaRequest.objectKey` is rejected with `400` if non-null, so the MS cannot record a
    reference to one either.
  - `ImagesController` **rejects** any key beginning `org-evidencia/` with `403`, shipped in Slice A
    as a pre-commitment guard with its own test. This costs three lines now and makes it impossible
    for Slice B's upload path to land before its access control, in either merge order.
  - `TipoEvidencia.FOTO` and `DOCUMENTO` exist in the enum but are only selectable in the SPA once
    Slice B lands; Slice A's `EvidenciaForm` offers `DECLARACION` only.
- **The worker is unchanged in Slice A.** `scoring.go` is not edited, so round behaviour is
  bit-identical.

---

## Testing Strategy

`strict_tdd: true` (`openspec/config.yaml:14`) — every row below is a RED test written before the
production change it covers. No root aggregate command; run per service.

### `jar_hornero_ms` — `mvn test` (JUnit 5 + spring-boot-starter-test + spring-security-test + H2)

| Layer | What to test | Approach |
|---|---|---|
| Unit | `AcreditacionReplay.reconstruir` over hand-built event lists | pure function, no Spring context |
| Unit | `TRANSICIONES_PERMITIDAS`: every legal edge passes, every illegal one throws `400` (incl. N0→N2, N1→N3, N0→N3) | table-driven `@ParameterizedTest` |
| Unit | `proyectarEstadoLegacy`: N0→PENDIENTE/false, N1..N3→APROBADA/true, `RECHAZADA` preserved | direct call |
| Unit | expiry derivation: `validoHasta` null → never expired; past → expired; today → not expired | boundary values, injected clock/`LocalDate` |
| **Integration** | **`reconstruir(log(org)) == org.getNivel()`** after a full N0→N1→N2→N3→N2 sequence | `@DataJpaTest`/`@SpringBootTest` + H2. **This is the change's headline invariant** |
| Integration | raising to N2 with a missing requisito → `409`; with an expired-but-APROBADA requisito → `409`; lowering with a blank `motivo` → `400` (AD-9) | service-level |
| Integration | evidence replacement: new row inserted, prior row `REEMPLAZADA`, both events appended, prior content unchanged | `@DataJpaTest` |
| Integration | `asignarReferente` appends `REFERENTE_REASIGNADO` and leaves `nivel`, `estado`, `validada` byte-identical (**preserved invariant**) | assert all three before/after |
| Integration | `validar()` on a `PENDIENTE` org yields `nivel = N1` **and** `estado = APROBADA` **and** an event | back-compat regression |
| Integration | `findBySlugPublic` still 404s for a level-N0 org and 200s for N1+ | back-compat regression |
| Integration | `AcreditacionBackfill` is idempotent: second run over the same rows appends no event and changes no `nivel` | run the `ApplicationRunner` twice |
| **Security** | anonymous `GET /api/organizaciones/{id}/legajo` → `401`; DONANTE → `403`; ADMIN → `200`. Same three for `/acreditacion` (**AD-8**) | `@WebMvcTest` + `spring-security-test`, full filter chain |
| Integration | non-owning REFERENTE posting evidence → `403` | `spring-security-test` |
| Integration | concurrency cap: creating a necesidad beyond the level cap → `409`; at cap−1 → `201`; N0 → `409` on the first | `NecesidadService` |
| Integration | transactional atomicity: a forced failure after the `nivel` write rolls back the event too (no orphan event, no silent level change) | `@Transactional` rollback test |
| Compile-time | `OrganizacionEventoRepository` exposes no delete/update (assert by reading the interface in review; optionally an ArchUnit-style reflection test) | reflection over declared methods |

### `ts_hornero_bff` — `npm test` (Jest + Supertest)

| Layer | What to test | Approach |
|---|---|---|
| Unit | `AcreditacionService` forwards the cookie token as `Bearer` to the right MS URL | mocked `HttpService.axiosRef` |
| Unit | DTO validation rejects a blank `motivo` and an unknown `destino` | `class-validator` |
| **Integration** | **`GET /images?key=org-evidencia/1/x.jpg` → `403`** (Slice A pre-commitment guard) | Supertest against `ImagesController` |
| Integration | `@Roles(ADMINISTRADOR)` routes reject REFERENTE and DONANTE | `RolesGuard` |

### `ts_hornero_admin` — `npm test` (Vitest + Testing Library + axios-mock-adapter), then `npm run build`

| Layer | What to test | Approach |
|---|---|---|
| Unit | `NivelBadge` renders each of N0–N3 | render |
| Unit | `NivelPanel` disables submit while `motivo` is blank | user-event |
| Integration | `AuditQueue` shows an expiry warning for `expirada: true` and does **not** show a level change | axios-mock-adapter |
| Integration | `EvidenciaForm` offers `DECLARACION` only in Slice A | render assertion |
| Integration | new routes are behind `ProtectedRoute` with the right `allow` set | `router.test.tsx` precedent |
| Build | `tsc -b && vite build` passes | `npm run build` — vitest does not typecheck the build graph |

### `go_algorithms_worker` — `go test ./...` (Slice B only)

| Layer | What to test | Approach |
|---|---|---|
| Unit | empty `CategoriasPermitidas` is a no-op (existing round results unchanged) | table-driven, mirrors `scoring.go:117` |
| Unit | a category in `CategoriasAceptadas` but not `CategoriasPermitidas` → `Score` returns `false` → `Inf` in `MatrizCosto` | table-driven |
| Unit | the existing 200-random-matrix Hungarian oracle still passes | unchanged `hungarian_test.go` |

---

## Threat Matrix

The reference matrix in `references/threat-matrix.md` covers shell, VCS and executable-file
boundaries. This change introduces none of them, so every row is `N/A`:

| Boundary | Applicability |
|---|---|
| Documentation-like paths | **N/A** — no file is classified or executed; the change adds JPA entities and HTTP endpoints |
| Git repository selection | **N/A** — no VCS automation; no `git` invocation in any touched path |
| Commit state | **N/A** — no index or worktree interaction |
| Push state | **N/A** — no remote ref resolution |
| PR commands | **N/A** — no PR automation |

The change's real adversarial boundary is **HTTP authorization**, which the reference matrix does not
model. It is recorded here with the same discipline — every row has a planned RED test:

| Boundary | Adversarial case | Expected safe behaviour | Planned RED test |
|---|---|---|---|
| `SecurityConfig` matcher order | anonymous `GET /api/organizaciones/7/legajo`, exploiting `permitAll` on `/api/organizaciones/**` (`SecurityConfig.java:50-56`) | `401` — explicit `.authenticated()` matcher declared **before** the `permitAll` block (AD-8) | `@WebMvcTest` full-chain: anonymous → 401 |
| Role escalation | DONANTE `GET /{id}/acreditacion` | `403` | `spring-security-test` with a DONANTE principal |
| Ownership bypass | REFERENTE posts evidence to an org they do not own | `403` | service test with a foreign principal |
| Public object streaming | `GET /images?key=org-evidencia/1/x.jpg` | `403` — prefix deny-list in `ImagesController` | Supertest, Slice A |
| Evidence key smuggling | `CargarEvidenciaRequest.objectKey` non-null in Slice A | `400` | MS validation test |
| BFF route shadowing | `GET /organizaciones/:slug` swallowing `:id/acreditacion` | two-segment paths never match the one-segment `:slug` | BFF e2e assertion |

---

## Migration / Rollout

1. **Schema**: `ddl-auto=update` adds `organizaciones.nivel` and creates `organizacion_evento` and
   `organizacion_evidencia` on first boot. No hand-written SQL, no downtime beyond the container
   restart.
2. **Backfill**: `AcreditacionBackfill` runs once at boot, guarded by `nivel IS NULL` (AD-7). It is
   safe to re-run and safe to roll back through — a rolled-back deployment simply ignores the column.
3. **Feature flag**: none. The SPA routes are the flag: until they ship, no user can reach the new
   endpoints, and the projection (AD-6) keeps every existing read identical.
4. **Rollback, code only**: redeploy the previous images. New columns and tables are additive and
   nullable; the previous code never reads them; `validada`/`estado` still drive every public read.
5. **Rollback, data**: the new tables are append-only and orphan-safe and may be left in place.
   Removal is a manual `DROP TABLE organizacion_evento, organizacion_evidencia` and
   `ALTER TABLE organizaciones DROP COLUMN nivel` — `ddl-auto=update` never drops.
6. **R2**: nothing is written under `org-evidencia/` in Slice A, so there is nothing to clean up.
7. **Pi cost**: two new tables holding tens to hundreds of small rows, one extra index, one boot-time
   pass. No new process, no daemon, no Redis, no scheduled job.

### Review-budget note

Slice A alone is well over the cached 400-changed-line budget under the `single-pr` strategy.
`sdd-tasks` must forecast and slice it — the natural work units are the same boundaries used above:
(A1) MS domain + event log + ladder + backfill, (A2) MS evidence + legajo + SecurityConfig,
(A3) BFF proxy + images deny-list, (A4) admin SPA, with (B1) categoria + worker and (B2) evidence
files deferred.

---

## Open Questions

- [ ] **`RequisitoAcreditacion` constant names and the nine verbatim requirement statements** are
      owned by `sdd-spec` (transcribed from <https://bancodealimentoscba.org.ar/suma-a-tu-comedor/>
      plus the signup form). This design depends only on the enum's *shape* — `nivelExigido` per
      constant — not on its wording, so it does not block. Freeze the constants before writing
      `AcreditacionBackfill` tests that reference them.
- [ ] **Banco de Alimentos Córdoba's coordinate**, if the 50 km distance is to be *displayed* to the
      auditing admin. Affects the legajo view only; the requirement is satisfied by admin audit
      either way (proposal: out of scope for system verification).
- [ ] **Does a level change need to be visible to the referente immediately**, or only through their
      own `/acreditacion` view? Affects nothing structural — `GET /{id}/acreditacion` already serves
      the owning referente — but it decides whether a notification is in scope. Assumed out of scope.
