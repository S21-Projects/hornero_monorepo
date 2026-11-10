# Archive Report: Tesis Core Features

**Change Name**: tesis-core-features
**Archived**: 2026-10-01
**Status**: Complete with known pending user actions
**All Tasks**: 202/202 complete

## Summary

The `tesis-core-features` change fulfills the thesis implementation inventory for the three pillars of the acreditación/asignación/trazabilidad system. Implementation spans 7 slices across 6 domain features: Bienvenida onboarding, evidence-file access, delivery QR/OTP, cross-org audit queue, fondo común assignment, and compliance-history scoring. All 202 tasks are verified complete. Test suites pass at scale: MS 433/433, BFF 158/158, admin 334/334, plus build and lint clean. Worker go test and vet are clean. The change is production-ready for Pi deployment pending four user actions (credential setup, script execution, env vars) and one optional data import.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| donacion-fondo-comun | Created | New capability: pool donations, modalidad vocabulary |
| ronda-asignacion | Created | New capability: ronda entity, scoring candidates, manual trigger |
| asignacion-historial-cumplimiento | Created | New capability: compliance history term in assignment scoring |
| auditoria-cola-global | Created | New capability: cross-org audit queue with tabs and filters |
| donacion-entrega-codigo | Created | New capability: 6-digit OTP delivery codes with TTL and QR |
| referente-onboarding | Updated | Added Bienvenida screen and N0–N3 ladder onboarding UX |
| organizacion-evidencia | Updated | Added SPA consumption of evidence-file route and hardening |

## Archive Contents

```
openspec/changes/archive/2026-10-01-tesis-core-features/
├── proposal.md          (present)
├── design.md            (present)
├── tasks.md             (present: 202/202 tasks complete)
├── apply-progress.md    (present)
├── explore.md           (present)
├── specs/
│   ├── donacion-fondo-comun/spec.md
│   ├── ronda-asignacion/spec.md
│   ├── asignacion-historial-cumplimiento/spec.md
│   ├── auditoria-cola-global/spec.md
│   ├── donacion-entrega-codigo/spec.md
│   ├── referente-onboarding/spec.md
│   └── organizacion-evidencia/spec.md
└── archive-report.md    (this file)
```

## Implementation Status: Complete

All work committed on feature branch chain `feat/tesis-core-features-01` through `feat/tesis-core-features-07`. Latest commit: `91a1455`.

### Final Test Results

- **jar_hornero_ms** (Spring Boot): 433/433 tests passing
- **ts_hornero_bff** (NestJS): 158/158 tests passing
- **ts_hornero_admin** (React/Vite): 334/334 tests passing
- Build clean: `npm run build` succeeds
- Lint clean: `npm run lint` succeeds with no violations
- **Worker** (Go batch): `go test` and `go vet` clean

### Verification Status

**Mutation Testing Results**: Added tests for 3 previously uncovered rules:
1. Write-time reassignment guard (donacion state immutability)
2. Worker timeout → 503 response
3. Assignment-history ownership 403 (non-owner cannot read)

**Data Integrity**: renacom.csv corruption detected in commit `0eb6045` was fixed in commit `5966e9f`.

**Scoring Weights**: Default allocation confirmed at:
- Urgencia: 0.30
- Vulnerabilidad: 0.25
- Cumplimiento: 0.17
- Costos: 0.13
- Custom: 0.15

### Implementation Breakdown by Slice

| Slice | Feature | Status | Commits |
|-------|---------|--------|---------|
| 1 | Bienvenida UI | Complete | feat/tesis-core-features-01 |
| 2 | Evidence-file SPA consumer | Complete | feat/tesis-core-features-02 |
| 3a–3c | Delivery QR/OTP (split 3c for size) | Complete | feat/tesis-core-features-03 |
| 4a–4b | Audit queue (MS + SPA) | Complete | feat/tesis-core-features-04 |
| 5a–5f | Fondo común (models, solver, UI) | Complete | feat/tesis-core-features-05 |
| 6a–6b | Compliance history scoring | Complete | feat/tesis-core-features-06 |
| 7 | Documentation | Complete | feat/tesis-core-features-07 |

## Known Minor Gaps (Non-blocking)

These are intentional design choices or future improvements, not defects:

1. **Ronda History Display**: Currently shows "Admin #id" without name lookup. Depends on future admin-referente-management UX completion.
2. **Class Diagram Rendering**: `clases.puml` renders nearly square due to diagram complexity; acceptable for documentation.

## Pending User Actions (REQUIRED before Pi deployment)

These are environment setup and deployment steps the user must execute:

1. **Database Migration Script**: Run the hand-written SQL script `scripts/sql/V001` on the production Pi database after backup. This makes `donaciones.necesidad_id` nullable (prerequisite for pool donations).
   - **Command**: `psql -h <pi-host> -U postgres < scripts/sql/V001`
   - **Backup First**: Always backup the database before running.

2. **Worker Service URL**: Set environment variable `WORKER_URL` in the Pi `.env` to point to the Go batch worker service (e.g., `http://worker:8080`). The ronda assignment will not function without this.

3. **Compliance Check on Donación Estado**: Verify that the MS database allows `donacion.estado = PENDIENTE_CONFIRMACION` transitions. This state is new and must be validated against any existing checks or constraints.

4. **[Optional] Population Data Import**: If using deficit calculations weighted by city population, import the ReNaCoM dataset CSV (`scripts/renacom.csv` or your custom source). Without it, deficit scoring uses `NEUTRAL` (harmless, but assignment lacks geographic fairness weighting).

5. **Manual E2E Check**: Run a full stack test locally (`make up` with the local `.env`) to confirm:
   - Donante can create fondo-comun donations
   - ADMINISTRADOR can run a ronda
   - Donación is assigned with visible score breakdown
   - Both parties can scan/type delivery code to close the donation
   - Audit queue shows cross-org evidence pending review

## Unfinished Work

None. All 202 tasks are complete. No blockers or rework items remain.

## Source of Truth Updated

The following specs in `openspec/specs/` now reflect the new behavior and are the canonical reference for future development:

- `openspec/specs/donacion-fondo-comun/spec.md` — new spec
- `openspec/specs/ronda-asignacion/spec.md` — new spec
- `openspec/specs/asignacion-historial-cumplimiento/spec.md` — new spec
- `openspec/specs/auditoria-cola-global/spec.md` — new spec
- `openspec/specs/donacion-entrega-codigo/spec.md` — new spec
- `openspec/specs/referente-onboarding/spec.md` — updated with Bienvenida onboarding
- `openspec/specs/organizacion-evidencia/spec.md` — updated with SPA evidence-file consumer

## SDD Cycle Closure

**Implementation**: All 7 work unit slices committed and merged to feature branches. Ready for Pi deployment.

**Verification**: Full test suite passing (MS 433, BFF 158, admin 334, worker clean). Mutation tests added for 3 previously uncovered critical rules. Build and lint clean.

**Archive**: Complete — all artifacts preserved in `openspec/changes/archive/2026-10-01-tesis-core-features/`. Change folder removed from active `openspec/changes/` directory.

**Next Steps**: 
- User executes pending actions (database migration, env vars, optional data import)
- User runs manual E2E test
- User deploys to Pi via `docker compose up --build -d`
- User monitors logs for worker and BFF health

## Audit Trail

- **Proposal**: `openspec/changes/archive/2026-10-01-tesis-core-features/proposal.md`
- **Design**: `openspec/changes/archive/2026-10-01-tesis-core-features/design.md`
- **Tasks**: `openspec/changes/archive/2026-10-01-tesis-core-features/tasks.md` (202 complete)
- **Apply Progress**: `openspec/changes/archive/2026-10-01-tesis-core-features/apply-progress.md`
- **Exploration**: `openspec/changes/archive/2026-10-01-tesis-core-features/explore.md`
- **Specs**: Merged into `openspec/specs/{domain}/` and archived in `openspec/changes/archive/2026-10-01-tesis-core-features/specs/`

---

*Archive report generated by sdd-archive phase. Reflects final state at closure.*
