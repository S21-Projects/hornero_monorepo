# Feature: tfg-entrega-4

Engram mirror: `odd/tfg-entrega-4/tasks` (project hornero_monorepo).
Source of tasks: `docs/TAREAS_AGENTE_TFG.md` (untracked, lives in the main worktree on `develop`).

## Objective

Produce the verified data, diagrams and code changes the thesis needs for delivery 4, so the document
only states what the prototype actually does.

## Why

The professor asked for verifiable business rules, a checkable security policy and test evidence. A
read-only audit (2026-11-08) showed several premises of the task list and the thesis draft do not match
the code (no Redis, no PostGIS, no Gin, requirement numbering collisions).

## Scope

- In: blocks A (extraction), B (diagrams), C (security), D (business rules), E (demo data), final
  `docs/tfg/RESUMEN.md`.
- Out: editing the Word document (the author does that), push, PR, merge.

## Constraints

- Branch `tfg/entrega-4` from `develop`, worktree `../hornero_app-tfg`; work-unit commits; no push.
- Verify first, then implement. Report what already existed (path and line) and what was added. Never
  invent values.
- Thesis deliverables go to `docs/tfg/` in neutral Spanish, Markdown with pipe tables. Code and comments
  in English; UI copy in Spanish.
- TDD: strict (source: `openspec/config.yaml`, as recorded in `odd/tasks/tesis-followups.md`). Runners:
  MS `mvn test`, BFF `npm test`, admin `npm test` + `npm run build` + `npm run lint`, worker
  `go test ./...`, e2e `make e2e`; Astro has no test runner.
- Local stacks must not touch the production R2 bucket. Never enable `EVIDENCIA_BORRADO_ENABLED` locally.
- No production access without explicit authorization for destination, operation and credential.
- Files owned by the author's uncommitted work on `develop`: `ts_hornero_admin/src/routes/actividad*`,
  `ts_hornero_admin/src/routes/panel*`.
- Delivery strategy: `ask-on-risk`. Forecast for blocks C and D exceeds about 400 authored lines, so ask
  for the chain strategy before those commits.

## Tasks

Route legend: `delegated` means a bounded worker; trigger in parentheses.

### A. Extraction

- [x] A1.1-A1.3 Run all suites, coverage and traceability table (delegated, per-action test run; writer
      for the annex)
- [x] A1.4 Benchmark 500 x 500 for RNF18, state which machine (delegated; none exists, needs a Go benchmark)
- [x] A1.5 Confirm event-level invariant and determinism tests (delegated)
- [x] A2 `docs/tfg/reglas-negocio.md` (delegated, mapping trigger)
- [x] A3 `docs/tfg/cronograma-real.md` (delegated, mapping trigger)
- [x] A4 `docs/tfg/inventario.md` (delegated, mapping trigger)

### B. Diagrams

- [ ] B1 Data dictionary and full ER, `docs/tfg/anexo-d-modelo-datos.md`
- [ ] B2 Update class and ER diagrams if C or D add entities
- [ ] B3 Corrected deployment diagram (no Redis; it does not exist)
- [ ] B4 Reassignment sequence diagram (optional)

### C. Security

- [ ] C1 BCrypt cost 12 (currently default 10)
- [ ] C2 Sessions: password-change and admin revocation, CSP mode, e2e on cookies and revoked refresh
- [ ] C3 Evidence: EXIF removal, configurable size, attachment, admin download event, retention
- [ ] C4 Audit: hash chain, daily verification, R2 anchors, DB permissions
- [ ] C5 Backups: retention, evidence copy, dump size, restore drill (needs production authorization)
- [ ] C6 Dependency audits, dependabot, secret scan

### D. Business rules

- [ ] D1 RN-04 evidence expiry (BLOCKED: author must choose policy a or b)
- [ ] D2 RN-08 no double reassignment, concurrency test
- [ ] D3 RN-05 deterministic tie-break, including `ORDER BY` on candidate and pool queries (none today)
- [ ] D4 RF17 and RF18 (BLOCKED: author decides scope after A2)

### E. Demo

- [ ] E1 `make demo-seed` and `make demo-reset`

### Close

- [ ] `docs/tfg/RESUMEN.md`

## Progress

- 2026-11-08: read-only audit done; worktree and branch created from `develop` at `ca681d6`. A2, A3 and A4 written and spot-checked against code.

## Verification evidence

- A1 suite run 2026-11-08 at `ca681d6`, raw data pending in the annex: MS 1114 passed, line coverage 90.8%;
  BFF 445 passed, 96.35%; admin 698 passed, 86.57%; worker 131 passed including subtests, 1 skipped,
  2.5% to 96.5% per package; Astro has no tests; e2e 102 of 102 passed in 130 s.
- E2E ran on an isolated stack with a throwaway env file and local MinIO, not `.env.local`. Endpoint
  confirmed as `http://minio:9000` in bff and ms before tests.
- Finding: `TestRondaSuperaAlArgmaxIndependiente` skips with a stale fixture, so "the round beats the
  greedy per-donation pick" is not currently asserted. Fix under D3 or A1.5.

- A1.4: `BenchmarkRonda500x500` 118.9 to 128.5 ms per round on an Apple M3 Pro, not the Pi.
- A1.5: same input and order gives identical output over 50 runs; with exact score ties, shuffled input
  changes pairs on all 30 seeds. Known gap for D3. `TestRondaGlobalSuperaAlGreedyBajoContencion` passes.
- Parent spot check: `go test ./...` all packages ok; `go vet ./...` clean.

## Next step

Block B next. D1 blocked on author policy, D4 on scope. Author must check public access on the R2 bucket in the Cloudflare panel (evidence shares the bucket with public images).
