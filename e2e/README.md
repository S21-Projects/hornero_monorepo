# Hornero e2e (API level)

End-to-end tests for the donation flow, driven over HTTP against the real local stack
(BFF -> MS -> Postgres -> Go worker). No browser. Vitest + native `fetch`, Node 20+.

## Run

```bash
make up-local        # in one terminal; wait until the BFF answers on :3001
make e2e             # or: cd e2e && npm install && npm test
```

- `E2E_BFF_URL` (default `http://localhost:3001`) selects the BFF.
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` override the seeded admin (`admin@hornero.ar`).
- Needs the demo data: run it against `make up-local` (it sets `SEED_DEMO_DATA=true`); a production-like
  stack (`make up`) has no demo accounts.
- Uses the demo accounts seeded by the MS `DataInitializer` (donante, referente, referente2,
  referente3, admin) and the seeded needs/articulos. It does not reset the DB: every run creates
  fresh donations tagged with a unique marker and never relies on absolute counts.

## Notes

- `12-reclamos-reportes` needs `docker compose exec postgres` from the repo root: no API creates unclaimed
  (ReNaCoM) organizaciones, so it imports its own `e2e-` rows with SQL and clears the previous run's first.

- The BFF rate-limits auth per IP (login 5/min, register 3/min). Global setup logs each actor in
  once and shares the cookie jars; if the window is already spent it waits (up to ~1 min) and
  retries. The suite registers a single throw-away account per run.
- Test files run sequentially (shared DB state, rate limits).
- `POST /rondas` needs the Go worker; a 503 fails the FONDO_COMUN scenario with a clear message.
- `it.fails` marks a known app bug the suite documents; see the comment above it. Remove `.fails`
  once the bug is fixed.

## Coverage

| Test file | Scenarios |
|---|---|
| `01-direct-flow` | DIRECTA: OFRECIDA -> ACEPTADA -> EN_CAMINO -> mutual codes -> ENTREGADA |
| `02-fondo-comun` | pool donation -> ronda -> PROPUESTA asignacion -> accept -> ENTREGADA |
| `03-exceptional-paths` | reject, cancel, wrong delivery code (+ lockout, known bug) |
| `04-authz-validation-override` | 403/401 matrix, invalid input, admin override with/without motivo |
| `05-session-and-verification` | unverified donante refused; refresh rotation, logout revokes refresh |
| `06` to `11` | donor privacy, deactivated user, activity log, idempotency, password reset, anonymization |
| `12-reclamos-reportes` | claims (approve/reject, 403s), reports, cascades, anonymization of a claimant, public map |

## Manual testing scenarios

Scripts that put the local stack in a known state so you can continue by hand in the UI. They are not
tests: they create real rows, tagged `escenario <runId> <label>` in `observaciones`.

```bash
make up-local                                   # prerequisite: demo data (SEED_DEMO_DATA=true)
make escenario                                  # lists the scenarios and the demo logins
make escenario ESC=fondo-comun N=5              # N defaults to 3, capped at 20
# or: cd e2e && npm run escenario -- post-ronda --n 2
```

| Scenario | Leaves the stack with |
|---|---|
| `fondo-comun` | N FONDO_COMUN donations (OFRECIDA) offering articulos open necesidades ask for. Log in as the admin and run a ronda at `/rondas`. |
| `directa-ofrecida` | N DIRECTA donations (OFRECIDA) spread across the referentes' organizaciones; prints which referente to log in as. |
| `en-camino` | N DIRECTA donations in EN_CAMINO; prints the donante and referente logins to test delivery code confirmation. |
| `post-ronda` | N fondo-comun donations plus a ronda run as admin; prints the PROPUESTA asignaciones and the referente to log in as. Needs the Go worker (`docker compose ps worker`); a 503 is reported as such. |

Notes: the script refuses a BFF URL that is not `localhost`/`127.0.0.1` unless you pass `--force`
(`E2E_BFF_URL` selects the BFF, as for the tests). Each demo actor logs in once per run (login is
limited to 5/min; it waits and retries on 429). A ronda considers the whole pool, not only the
donations the script created. Shared helpers live in `src/flows.ts` (vitest-free; `src/fixtures.ts`
re-exports them for the tests).
