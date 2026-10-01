# Feature: tesis-followups

Engram mirror: `odd/tesis-followups/tasks` (project hornero_monorepo).

## Objective

Close the gaps found after archiving `tesis-core-features`: prove the full stack works end to end in
Docker, update operational docs, and fill the remaining UI gaps around the fondo común and onboarding.

## Why

Every slice passed unit/integration tests per service, but the stack with the new Go worker was never
run end to end. Some screens also miss context the new flows need (referente does not know an offer
came from the fondo común, admin cannot see modalidad, onboarding counter missing).

## Scope

- In: e2e smoke test with `make up-local`, fixes for anything it breaks, CLAUDE.md + deploy runbook,
  Makefile `migrate` helper, referente fondo común badge + rejection notice, admin modalidad/fase in
  control de donaciones, ronda history executor name, Bienvenida "faltan N requisitos" counter,
  public site entry point to the fondo común.
- Out: new business rules, schema changes beyond what fixes require.

## Constraints

- TDD: strict (source: openspec/config.yaml `strict_tdd: true`). Runners: MS `mvn test`, BFF `npm test`,
  admin `npm test` + `npm run build` + `npm run lint`, worker `go test ./...`; Astro has no test runner.
- Branch `feat/tesis-followups` from `develop`; work-unit commits per task; no push.
- UI copy in Spanish, code/docs in English (CLAUDE.md, runbook) unless the file is Spanish.

## Tasks

- [x] T1 E2E smoke test in Docker (`up-local`): worker healthy, donar fondo común, ronda, accept,
      QR both sides, ENTREGADA, audit queue, evidence file. Route: inline. Fixes 541f94d, 46bb931.
      Audit queue: admin 200 (PENDIENTES/VENCIDAS/nivel filter), donante 403, anonymous 401.
      Evidence files: own missing 404, other org 403, donante 403, public /images with evidence key 403.
- [x] T2 Docs: CLAUDE.md (worker in the service chain, Go commands, make backup/migrate,
      scripts/sql) + docs/deploy-rpi-cloudflare.md (make migrate, develop branch, 6 services, worker
      healthcheck, POBLACION_CSV, removed stale make start-local note). Route: inline.
- [x] T3 Makefile `backup` + `migrate` targets (backup, then every scripts/sql/V*.sql in order; `ENV_FILE=.env.local` for local). Verified against the local stack; backups/ gitignored. Route: inline.
- [ ] T4 Referente dashboard: fondo común badge on assigned pool offers + notice that rejecting
      returns it to the pool. Route: delegated (admin, tests).
- [ ] T5 Admin control de donaciones: modalidad + fase columns/badges. Route: delegated.
- [ ] T6 Ronda history: executor name instead of "Admin #id" (MS RondaResponse + admin). Route: delegated.
- [ ] T7 Bienvenida: "Para llegar a N1 te faltan N requisitos" computed from acreditación data.
      Route: delegated.
- [ ] T8 Astro public site: entry point explaining the fondo común and linking to /donar. Route: delegated.

## Acceptance

Each task: behavior observed (tests or manual e2e evidence), suites green, one work-unit commit.

## Progress

- 2026-10-01: document created; branch `feat/tesis-followups` from develop (cb972be).
- T1 e2e (2026-10-01), local stack with a pre-existing DB (same state as the Pi):
  - EsquemaVerificador detected the un-migrated DB; FONDO_COMUN creation answered 503 ESQUEMA_PENDIENTE. ✅
  - Backup + V001 run twice (idempotent) + MS restart → creation 201. ✅
  - BUG fixed (541f94d): `findByIdForUpdate` inner-joined necesidad, so the ronda write phase never
    found pool donations and discarded every assignment. Now locks the row with no joins (Postgres
    rejects FOR UPDATE on the nullable side of an outer join). RED/GREEN in DonacionRepositoryTest; MS 434/434.
  - Re-run: ronda assigned 2/2; foreign referente 403; accept; EN_CAMINO; both codes generated; wrong
    code 400 CODIGO_INVALIDO; one verification → PENDIENTE_CONFIRMACION; both → ENTREGADA; asignación
    ACEPTADA; retired confirmar-entrega 404. ✅
  - Minor: verify endpoint answers HTTP 201 (Nest POST default) with body status 200 → fix in BFF.
  - PRODUCT GAP: a rice donation was assigned to "Útiles escolares" (legacy necesidades have null
    categoria = "accepts all" for the worker). User decided a full item catalog → new feature
    `odd/tasks/catalogo-articulos.md` (decisions in Engram `odd/catalogo-articulos/decisions`),
    plus cleaning the non-real stored data.
