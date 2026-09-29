# Apply Progress: Tesis Core Features

Engram mirror: `sdd/tesis-core-features/apply-progress`.

## Scope of this batch

Slice 1 — Bienvenida register step (admin) ONLY, per orchestrator instruction. Slices 2+ not
started. Strict TDD mode, `ts_hornero_admin` (Vitest).

## Completed Tasks (Slice 1)

- [x] 1.1 RED — `register.test.tsx`: 3rd "Acreditación" step renders after successful org
      creation; step indicator shows 3 stages for REFERENTE, 2 for DONANTE.
- [x] 1.2 RED — `BienvenidaAcreditacion.test.tsx` (new): N0..N3 ladder copy, current-level badge
      via mocked `useAcreditacion`, "Empezar con N1"/"Más tarde" callbacks.
- [x] 1.3 RED — `ProtectedRoute.test.tsx`: `requireVerified` redirect carries
      `state={{ from: location.pathname }}`.
- [x] 1.4 RED — `verify-email.test.tsx` (new — none existed before): navigates to `state.from`
      when internal, else `roleHome`.
- [x] 1.5 GREEN — `BienvenidaAcreditacion.tsx` created.
- [x] 1.6 GREEN — `src/lib/acreditacion.ts` created (static `NIVEL_LADDER`).
- [x] 1.7 GREEN — `register.tsx`: new `Step 'acreditacion'`, `StepIndicator`, wiring.
- [x] 1.8 GREEN — `ProtectedRoute.tsx`: `state={{ from: location.pathname }}` added.
- [x] 1.9 GREEN — `verify-email.tsx`: resumes `state.from` when internal, else `roleHome`.
- [x] 1.10 REFACTOR — confirmed no duplicated ladder copy elsewhere; no extraction needed.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.2/1.5/1.6 | `BienvenidaAcreditacion.test.tsx` | Integration (component) | N/A (new) | ✅ Written — failed to resolve import | ✅ 4/4 passing | ✅ N0/N2 current-level cases + CTA/secondary click cases | ✅ Clean |
| 1.1/1.7 | `register.test.tsx` | Integration | ✅ 22/22 (baseline) | ✅ Written — 4/6 failed (missing step, missing indicator) | ✅ 6/6 passing | ✅ REFERENTE (3 stages) + DONANTE (2 stages) cases | ➖ None needed |
| 1.3/1.8 | `ProtectedRoute.test.tsx` | Integration | ✅ 20/20 baseline (pre-1.3 test) | ✅ Written — 1/20 failed | ✅ 20/20 passing | ➖ Single scenario (state shape is fixed) | ➖ None needed |
| 1.4/1.9 | `verify-email.test.tsx` | Integration | N/A (new file — none existed) | ✅ Written — 1/2 failed (from-path case) | ✅ 2/2 passing | ✅ internal `from` case + no-`from`/roleHome case | ➖ None needed |

### Test Summary
- Total tests written/modified: 4 new BienvenidaAcreditacion + 4 new/modified register.test.tsx
  cases + 1 new ProtectedRoute case + 2 new verify-email.test.tsx cases = 11.
- Total tests passing: full `ts_hornero_admin` suite — 204/204.
- Layers used: Integration (component/route) — 11 new/modified; Unit — 0 (no pure-function task
  in this slice; `NIVEL_LADDER` is a plain data export, triangulation skipped: single output, no
  branching).
- Approval tests: none — no refactoring-of-existing-behavior task in this slice.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `ts_hornero_admin/src/lib/acreditacion.ts` | Created | Static N0..N3 ladder copy (`NIVEL_LADDER`) |
| `ts_hornero_admin/src/components/acreditacion/BienvenidaAcreditacion.tsx` | Created | Presentational ladder + CTA, reads `useAcreditacion(orgId)` |
| `ts_hornero_admin/src/components/acreditacion/BienvenidaAcreditacion.test.tsx` | Created | RED/GREEN tests for the above |
| `ts_hornero_admin/src/routes/register.tsx` | Modified | New `Step 'acreditacion'`, `StepIndicator`, `handleEmpezarAcreditacion`; `done` step's final button now leads to `acreditacion` instead of directly to panel |
| `ts_hornero_admin/src/routes/register.test.tsx` | Modified | Updated retry-flow assertion (button rename `Ir a mi panel` → `Continuar` → new step) + 2 new tests |
| `ts_hornero_admin/src/app/ProtectedRoute.tsx` | Modified | `requireVerified` redirect now passes `state={{ from: location.pathname }}` |
| `ts_hornero_admin/src/app/ProtectedRoute.test.tsx` | Modified | New test + `VerifyEmailStateProbe` helper |
| `ts_hornero_admin/src/routes/verify-email.tsx` | Modified | Reads `location.state.from`; navigates there when internal, else `roleHome` |
| `ts_hornero_admin/src/routes/verify-email.test.tsx` | Created | No prior test file existed for this route |

## Design Interpretation (not a spec deviation, but worth recording)

`design.md`'s file table said "add `Step 'acreditacion'` after successful org creation" without
stating whether the existing `done` confirmation screen (with `OrgImagesEditor` photo upload) is
kept or replaced. Chose to **keep `done` unchanged** and insert `acreditacion` as the step reached
from `done`'s (renamed) "Continuar" button, rather than deleting the photo-upload feature. This
satisfies "a 3rd step Acreditación renders after successful org creation" without dropping
existing value. `handleOrgRetry`'s success path also now leads to `done` → `acreditacion`,
consistently.

The "Para llegar a N1 te faltan N requisitos" dynamic requisito count from the design mockup was
**not implemented** — task 1.2's test only requires the ladder copy + current-level badge +
navigation callback via a mocked `useAcreditacion(orgId)` (no `useLegajo` count). Implementing the
dynamic count would need an additional untested data dependency beyond what tasks.md specifies;
static ladder copy is used instead.

## Verification (slice 1)

- `npm test` (Vitest, `ts_hornero_admin`): **204/204 passing** (42 test files).
- `npm run build` (`tsc -b && vite build`): **success** (pre-existing chunk-size warning only,
  unrelated to this change).
- `npm run lint` (eslint): **clean, no output**.

## Review Workload / Size

Authored changed lines for this slice (additions + deletions, `git diff --stat` + new files):
- Modified files: 213 lines changed (`+204/-9` across `ProtectedRoute.tsx`,
  `ProtectedRoute.test.tsx`, `register.tsx`, `register.test.tsx`, `verify-email.tsx`).
- New files: 295 lines (`BienvenidaAcreditacion.tsx` 73, `BienvenidaAcreditacion.test.tsx` 93,
  `acreditacion.ts` 45, `verify-email.test.tsx` 84).
- **Total ≈ 508 authored changed lines** — above the 400-line budget and above the slice's own
  250–350 forecast (mainly because `verify-email.test.tsx` had to be created from scratch — no
  prior test file existed for that route — and the register.tsx step-indicator work needed a new
  test-mocking router path).
- This is one cohesive work unit (register onboarding step + its two supporting guard fixes,
  `tasks.md` bundles them under a single "USER COMMIT POINT"). It is fully green
  (tests+build+lint) and was not split further to avoid leaving any piece non-functional.
  Recommending **`size:exception`** for this slice rather than retroactively splitting completed,
  interdependent work.

## USER COMMIT POINT

`feat(admin): add bienvenida onboarding step after org creation`

## Status

10/10 slice-1 tasks complete. Slices 2–7 not started (out of scope for this batch).
Ready for archive of slice 1 (verification optional/already run above) or for the next `sdd-apply`
batch to start slice 2 once the user has committed this work and reviewed the size exception.

## Delivery decision — Slice 1

- size:exception accepted by the user (2026-09-29): ~500 changed lines vs 400 budget, one cohesive green unit (bulk is new verify-email tests). Single commit: `feat(admin): add bienvenida onboarding step after org creation`.
- Follow-up (optional, not in spec): dynamic "te faltan N requisitos" count from the mockup.
