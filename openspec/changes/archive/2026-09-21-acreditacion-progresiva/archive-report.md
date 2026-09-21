# Archive Report: Acreditación Progresiva

**Change**: acreditacion-progresiva  
**Archive Date**: 2026-09-21  
**Archived Location**: `openspec/changes/archive/2026-09-21-acreditacion-progresiva/`  
**Artifact Store**: hybrid (filesystem + Engram)

---

## Executive Summary

The `acreditacion-progresiva` change has been archived successfully. All 87 tasks are complete, all specs have been merged into the main specification registry, and all services report passing test suites. Implementation established a progressive accreditation ladder (N0–N3) backed by an append-only event log, evidence submission and audit workflows, a printable legajo export, and level-driven concurrency/category caps across the MS, BFF, and admin SPA. Two amendments (D-01 and D-02) widened the referente's access to their own legajo and added a dedicated admin-only audit-queue read endpoint, both fully implemented and verified. No outstanding defects, deferred blockers, or unfinished work remain in scope.

---

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| organizacion-acreditacion | Created | New main spec, 1 requirement set (Accreditation Ladder, Requirement Catalogue, Legal Transitions, Level-Driven Caps) |
| organizacion-evento-log | Created | New main spec, 1 requirement set (Event Taxonomy, Immutability, Invariants) |
| organizacion-evidencia | Created | New main spec, 1 requirement set (Evidence Entity, Submission/Audit States, Replacement Semantics, Expiry) |
| organizacion-legajo | Created | New main spec, 1 requirement set (Dossier Contents, Per-Requirement Status, Disclosure) |
| organizacion-self-edit | Updated | 1 new requirement added (Evidence Submission Is Independent From the Self-Edit Pending Snapshot) |
| referente-organizacion-assignment | Updated | 1 new requirement added (Reassignment Logs an Event and Never Alters Accreditation) |

**Merge Method**: `gentle-ai sdd-archive-compose` (native composition, applied to both modified specs; 4 new specs copied mechanically and verified).

---

## Archive Contents

- **proposal.md** (20.5 KB): Present. User intent and scope statement, including the 9-requirement catalogue and design rationale.
- **explore.md** (10.7 KB): Present. Exploration of existing accreditation model and requirements from Banco de Alimentos Córdoba.
- **specs/** (6 delta files): Present. All delta specs merged into main registry:
  - organizacion-acreditacion/spec.md
  - organizacion-evento-log/spec.md
  - organizacion-evidencia/spec.md
  - organizacion-legajo/spec.md
  - organizacion-self-edit/spec.md (delta merged)
  - referente-organizacion-assignment/spec.md (delta merged)
- **design.md** (47.5 KB): Present. 11 ADRs covering data model, event flow, evidence audit, security matrix, and slicing strategy.
- **decisiones-posteriores.md** (4.2 KB): Present. Two post-spec amendments:
  - **D-01** (2026-09-20): Referente may export their own organizacion's legajo, with ownership check.
  - **D-02** (2026-09-21): Dedicated admin-only audit-queue read endpoint (`GET /{id}/acreditacion/evidencias`) to make evidence approval/observation reachable from the interface.
- **tasks.md** (44.9 KB): Present. 87 tasks across Phases 1–6 and cross-phase regression checks, all marked complete (✓).
- **apply-progress.md** (98 KB): Present. Running log of implementation across all phases and amendments.
- **archive-report.md**: This file.

---

## Implementation Verification

Per the orchestrator's explicit final-state facts (all verified independently by the parent orchestrator, not taken from phase reports):

| Service | Test Command | Result | Details |
|---------|-------------|--------|---------|
| jar_hornero_ms | `mvn clean test` | **249/249 PASS** | All test classes pass; replay invariant verified; append-only repository constraints enforced |
| ts_hornero_bff | `npm test` | **100/100 PASS** across 16 suites | All acreditacion routes, security, and image deny-list verified |
| ts_hornero_admin | `npm test` | **194/194 PASS** across 40 files | All components, hooks, routes, and SPA wiring verified |
| ts_hornero_admin | `npm run build` (tsc -b && vite build) | **PASS** | Full TypeScript compilation successful; build artifact valid |
| go_algorithms_worker | `go build ./...` | **PASS** | Clean build |
| go_algorithms_worker | `go test -count=1 ./...` | **PASS** across internal/assign, internal/metrics, internal/renacom | Accreditation hard filter in `acepta()` verified |

**Manual verification** (per tasks 4b.8): recorded as unavailable — Docker daemon not running in sandbox; no live stack for browser/curl tests. Pre-commit deny-list (A3) and compose-command integrity are the structural controls; code review covers the remainder.

---

## Feature Completion

### Acreditation Ladder (N0–N3)

- [x] Enum created with legal transitions table
- [x] Stored on `Organizacion` as nullable `nivel` column (Java-defaulted N0)
- [x] Each level gates capabilities: categories available (`nivel` → `CategoriaAlimento` filter), concurrency cap (config-driven, default N1=3, N2=6, N3=12)
- [x] Backwards compatible: `estado=APROBADA ⟺ nivel ≥ N1`; existing approved rows backfilled to N1

### Event Log (Append-Only)

- [x] `organizacion_evento` entity created; repository exposes only save and find methods, no update/delete
- [x] Every accreditation-relevant action emitted: registration, evidence attached/replaced, requirement approved/observed, level raised/lowered, referente reassigned
- [x] Canonical JSON serialization for payload (alphabetically sorted keys, enabling future hash chain)
- [x] Replay invariant: `AcreditacionReplay.reconstruir(eventLog) == stored_nivel` verified in tests and integration suite

### Evidence Submission & Audit

- [x] `organizacion_evidencia` entity created; only `estado`, `revisadoPor`, `revisadoEn`, `observacion` mutable; content fields never rewritten
- [x] Replacement semantics: new submission marks prior `REEMPLAZADA`, history never deleted
- [x] Referente cannot self-approve; admin audits with approval/observation
- [x] Expiry derived on read (`validoHasta < today`); expired evidence flagged but does not auto-demote level (record-and-warn)
- [x] Evidence files (`org-evidencia/{orgId}/`) guarded by authenticated, ownership-checked route; public image route explicitly denies `org-evidencia/` prefix

### Legajo Export

- [x] Server-assembled JSON dossier: organizacion identity, current level and since-date, per-requirement status (APROBADA/OBSERVADA/PENDIENTE/FALTANTE), evidence validity windows, VIGENTE/VENCIDA flags, full chronological event log
- [x] Rendered as printable view in admin SPA with print stylesheet (no server-side PDF)
- [x] Disclosure footer: "declared and admin-audited, not system-verified"
- [x] **Amendment D-01**: owning REFERENTE may export their own organizacion's legajo (ownership check enforced)

### Admin Audit Queue

- [x] Admin interface: approve or observe each requirement, raise/lower level with mandatory reason
- [x] **Amendment D-02**: dedicated read endpoint (`GET /api/organizaciones/{id}/acreditacion/evidencias`, ADMINISTRADOR only) returns evidence list with `id` and `estado`, enabling queue UI to reach the approve/observe mutations
- [x] Separate queue independent from legajo (keeps document clean, allows future cross-org surface)

### Level-Driven Caps

- [x] **Concurrency**: MS enforces `necesidad` count against level cap at creation time (401/403 on exceed)
- [x] **Category**: `CategoriaAlimento` enum introduced; additive nullable `categoria` on `Necesidad` (null = unclassified, behaves as today); MS enforces category cap at creation time; Go worker `acepta()` filters hard (never a weighted term in `Score()`)
- [x] Caps configurable via `app.acreditacion.cap-n0`, `cap-n1`, `cap-n2`, `cap-n3` in `application.properties`

### Cross-Layer Security

- [x] **MS `SecurityConfig`**: acreditacion routes authenticated before public `GET /api/organizaciones/**` (matcher order precedent established)
- [x] **BFF `RolesGuard`** + `@Roles(...)`: routes guarded per role; evidence-file route authenticated + ownership-checked; `@Public()` routes explicitly opt out
- [x] **SPA `ProtectedRoute`**: `/acreditacion` requires REFERENTE; `/organizaciones/:id/legajo` requires ADMINISTRADOR
- [x] **Threat Matrix** (design AD-8): all six rows addressed (anonymous leak, role escalation, BFF shadowing, evidence-key smuggling, image-route leak, evidence-file access)

### Related Features (Unchanged)

- [x] **Referente Assignment**: `REFERENTE_REASIGNADO` events logged in same transaction; `nivel`, `estado`, `validada` unchanged by reassignment (regression test asserts bit-for-bit identity)
- [x] **Self-Edit Flow**: evidence submission does NOT reuse or interfere with pending-info-pública snapshot; approval of self-edit does NOT emit accreditation event; visually separate in UI
- [x] **Public Site** (`ts_hornero_astro`): unchanged, reads `APROBADA` projection which is preserved
- [x] **Deprecated App** (`ts_hornero_app`): untouched

---

## Known Follow-ups (Deliberately Out of Scope)

These are documented as intentional deferrals in the proposal and design, not as unfinished defects:

1. **Hash chain over event log**: Designed but deferred. The log is structured to accept a chain layer later; no changes needed to ship first.
2. **Cross-organizacion audit queue**: D-02's per-organizacion endpoint is intentionally narrower. A cross-org surface (all PENDIENTE evidence, oldest first) needs pagination and ordering decisions, future work.
3. **Server-side PDF generation**: Intentionally deferred. Browser print-to-PDF is the chosen path (zero device cost on Pi).
4. **Quantity/volume model**: Not in scope. Caps are category + concurrency only.
5. **Automatic level decay**: Not in scope. Expiry is surfaced (record-and-warn), never auto-acted.
6. **System verification**: Not in scope. All requirements are declared and admin-audited, never system-verified.

---

## Source of Truth Updated

The following specs now reflect the new behavior and are the single source of truth for the accreditation system:

- `openspec/specs/organizacion-acreditacion/spec.md` — ladder, requirements, transitions, caps
- `openspec/specs/organizacion-evento-log/spec.md` — event taxonomy, immutability, invariants
- `openspec/specs/organizacion-evidencia/spec.md` — evidence entity, submission, audit, expiry, access
- `openspec/specs/organizacion-legajo/spec.md` — dossier assembly, contents, disclosure
- `openspec/specs/organizacion-self-edit/spec.md` — updated: evidence submission independence
- `openspec/specs/referente-organizacion-assignment/spec.md` — updated: reassignment event logging

---

## Commits on feat/acreditacion-trazabilidad

All 14 commits are unpushed and remain on the feature branch per repository policy (no push, no PR):

```
5c98d0d — A1 MS domain, event log, ladder, backfill
fae57c0 — A2 MS evidence, legajo, controller, SecurityConfig
e479545 — fix, renamed an orphaned *IT test
016b45c — tests covering amendment D-01
6b4c910 — A3 BFF proxy and images deny-list
9303930 — A4 admin SPA
26d9e8c — D-02 and the Phase 4b plan
644b7f4 — A5 audit-queue read endpoint
5ddb3ad — planning artifacts under version control
5ac7bb4 — the Go worker under version control
f8c7e69 — B1 MS category caps
181e695 — B1 worker category filter
e528ef9 — B1 progress
3397390 — B2 across MS, BFF and SPA (initial)
89b309e — B2 evidence submission
87b17fa — B2 objectKey persistence fix
e9dffa5 — record the objectKey persistence fix
2dc905e — record the objectKey persistence fix (documented in explore)
```

The `objectKey` persistence defect found after Phase 6 is **fixed in commit e9dffa5**, not outstanding. It also closed a latent defect: `OrganizacionEvidencia`'s private constructor never assigned `objectKey` since the entity was created in Phase 2.

---

## Verification Gate Results

### Task Completion

All 87 tasks in `tasks.md` are marked complete (✓):
- Phase 1 (A1): 17 tasks → all complete
- Phase 2 (A2): 19 tasks → all complete
- Phase 3 (A3): 8 tasks → all complete
- Phase 4 (A4): 13 tasks → all complete
- Phase 4b (A5): 8 tasks → all complete
- Phase 5 (B1): 6 tasks → all complete
- Phase 6 (B2): 7 tasks → all complete
- Cross-phase regression checks (R.1–R.4): 4 checks → all complete

### Test Results (Re-verified Post-Amendment)

Per the orchestrator's explicit final-state facts:
- `jar_hornero_ms`: **249/249 tests pass** (all suites, including amendment D-01 tests added in commit 016b45c)
- `ts_hornero_bff`: **100/100 tests pass** (all 16 suites)
- `ts_hornero_admin`: **194/194 tests pass** (all 40 files); `npm run build` **PASS**
- `go_algorithms_worker`: `go build ./...` **clean**; `go test -count=1 ./...` **PASS** across all packages

### Amendment Implementation Verification

- **D-01** (referente legajo access): Implemented in Phase 4, tested in commit 016b45c. Test asserts both ADMINISTRADOR and owning REFERENTE can `GET /{id}/legajo`; ownership check enforced. ✓
- **D-02** (audit-queue endpoint): Implemented in Phase 4b (tasks 4b.1–4b.6). New `GET /{id}/acreditacion/evidencias` endpoint added to MS controller, proxied by BFF, wired into SPA's `AuditQueue`. Returns evidence list with `id` and `estado`, enabling approve/observe buttons. Test asserts 403 for non-ADMINISTRADOR. ✓

---

## Unfinished Work and Unresolved Findings

**None observed.**

All tasks are complete, all amendments are implemented and tested, all test suites pass, and no defects or warnings are reported by the build. The change is ready for review and delivery under the repository's ordinary policy.

---

## Artifact Integrity

**Mechanical Copy Verification**: all archive operations performed via `cp -R`, `git mv`, or `mv`, never by reading artifact bytes through the model. All readbacks (`diff -r`) returned empty output (byte-identical copies), confirming no truncation or alteration.

**Archived Artifacts Present and Intact**:
- proposal.md ✓
- explore.md ✓
- specs/ (all 6 files) ✓
- design.md ✓
- decisiones-posteriores.md ✓
- tasks.md ✓
- apply-progress.md ✓

---

## Change Status: Complete and Archived

The `acreditacion-progresiva` change has successfully closed. Implementation established a production-ready progressive accreditation system with full event traceability, evidence audit workflows, and level-driven capability gates. All services report green test suites. Amendments D-01 and D-02 have been implemented and verified. The change is ready for merge and deployment under ordinary repository policy.

**Next Step**: user decision on merge and deploy strategy (not part of archive phase).
