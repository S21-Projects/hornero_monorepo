# Feature: escenarios-pruebas-manuales

## Objective
Scripts that put the local stack (`make up-local`) into a known point of a flow so the user can
continue testing by hand in the UI, instead of building every state from scratch.

## Why
Manual testing of rondas and donation flows needs donations in specific states. There is no script
for it: `make seed` only creates referentes/orgs, `DataInitializer` seeds once per empty DB, and the
e2e suite runs flows to completion.

## Scope
- `make escenario ESC=<name> [N=<count>]`, scripts under `e2e/scenarios/`, reusing `e2e/src/client.ts`
  (Actor, login, cookie jars, 429 retry) and the flow helpers from `e2e/src/fixtures.ts`.
- Scenarios:
  - `fondo-comun`: N FONDO_COMUN donations (OFRECIDA) with articulos requested by open necesidades, ready for a ronda.
  - `directa-ofrecida`: N DIRECTA donations waiting for the referente decision.
  - `en-camino`: N DIRECTA donations in EN_CAMINO, ready for delivery code confirmation.
  - `post-ronda`: fondo-comun donations + POST /rondas, leaving PROPUESTA asignaciones for the referente.
  - `list`/help output describing each scenario and which demo user to log in with.
- Out of scope: browser UI automation (Playwright), changes to app services.

## Constraints
- Local stack only (demo accounts from `SEED_DEMO_DATA=true`); refuse to run if BFF URL is not localhost unless forced.
- Donations tagged with an `escenario <runId>` marker in observaciones.
- No commits without user permission. No branch switching.
- TDD: off (no project config). Checks: `cd e2e && npx tsc --noEmit`, existing e2e suite still type-checks; a live run needs `make up-local` (user's machine).

## Tasks
- [x] T1 Extract vitest-free flow helpers so scripts and tests share them — route: delegated (writer trigger)
- [x] T2 Scenario runner + 4 scenarios + Makefile target + README section — route: delegated (same writer)
- [ ] T3 Checks: typecheck (done); live run if the stack is up (partial: stack up but has 0 necesidades, scenarios not exercised)

## Acceptance
- `make escenario ESC=fondo-comun N=5` creates 5 OFRECIDA pool donations and prints ids + who to log in as.
- Existing e2e tests unchanged in behavior and still type-check.

## Progress
- 2026-11-02: document created.
- 2026-11-02: T1 done: new `e2e/src/flows.ts` (vitest-free helpers; `crearDirecta` gained an optional `tag` param); `e2e/src/fixtures.ts` re-exports it. T2 done: `e2e/scenarios/run.ts` (fondo-comun, directa-ofrecida, en-camino, post-ronda, list), `tsx` devDependency + `escenario` npm script, `e2e/tsconfig.json` includes `scenarios`, Makefile `escenario` target, README section, CLAUDE.md line.
- 2026-11-02: checks observed: `cd e2e && npx tsc --noEmit` OK; `make escenario` (list) prints scenarios + logins OK; `make escenario ESC=fondo-comun N=2` against the running stack logged in the donante, then failed cleanly with "no open necesidades" because `GET /necesidades` returns totalElements 0 on that stack. Creation paths of the 4 scenarios and POST /rondas are NOT yet verified live; needs demo necesidades (reseed/`make up-local` with SEED_DEMO_DATA=true on a fresh DB). Vitest suite not run (needs same data).
