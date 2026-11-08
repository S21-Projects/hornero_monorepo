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
| `13-session-revocation` | admin revocation of sessions, cookies and revoked refresh tokens |
| `14-acreditacion` | CU-07 evidence upload (PDF, bytes checked, ownership, file serving), CU-08 audit approve/observe, CU-09 level ladder (409 incomplete, 400 skipped level, categories by level, expired evidence blocks a raise), CU-10 legajo data and event log |
| `15-reasignacion` | a rejected pool donation returns to the pool and no ronda proposes it again to an organizacion that rejected it |

Not reachable end to end (no endpoint, no clock injection, so they stay covered by MS tests only):
the unanswered-proposal expiry (3 days) and the daily job that persists `VENCIDA` evidence with its
30-day grace (RN-04); the legajo PDF itself, which the browser prints from the JSON that
`14-acreditacion` asserts.

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

## Demo for recording (`make demo-up`, `make demo-seed`, `make demo-reset`)

Fictional data to record the thesis demo from end to end: 3 organizaciones at N3, N2 and N1 with
approved evidence files (the N1 one also has pending and observed N2 evidence for the admin to audit
on camera), 2 donantes, needs of every category and 5 pool donations waiting for a ronda.

```bash
make down                 # the demo uses the same host ports (3001, 8081, 5173, 4321, 5432): stop other stacks first
make demo-up              # first time: generates .env.demo, builds and starts the stack, applies scripts/sql
make demo-seed            # loads the data (about 2 minutes: registration is rate limited) and prints the logins
make demo-reset           # back to the initial state: wipes the demo stack and reseeds it
make demo-down            # stop it, keeping the data
make demo-verify EMAIL=nuevo@example.com   # stands in for the OTP email of an account registered on camera
```

Logins (all fictional, one shared password, printed again at the end of `make demo-seed`): admin
`admin.demo@example.com`; referentes `referente.naranjos@example.com` (Comedor Los Naranjos, N3),
`referente.sol@example.com` (Merendero Sol de Barrio, N2), `referente.molino@example.com` (Copa de Leche
El Molino, N1); donantes `donante.ana@example.com`, `donante.luis@example.com`. The password is defined in
`scripts/demo/demo.sh` (`DEMO_PASSWORD`). Panel: http://localhost:5173, public map: http://localhost:4321.

Script of the recording against this data:

1. Public map (4321) shows the three organizaciones.
2. Register a new referente in the panel, then `make demo-verify EMAIL=<that address>` (the OTP email is
   never sent under `MAIL_LOG_ONLY`), and upload evidence.
3. As the admin, audit the pending evidence of El Molino (the observed one is already there) and raise it
   N1 -> N2. Try N1 -> N3 first to show the rejection (refused with 409 while requisitos are missing; 400 invalid transition when they are all approved).
4. As the El Molino referente, publish a REFRIGERADO need: refused at N1, accepted after the raise.
5. As a donante, donate to the pool. As the admin, run a ronda at `/rondas` and open the score breakdown.
6. As the referente who got the proposal, accept it; deliver with the QR code from two windows.
7. Export the legajo (admin or referente) and show the event log.

### Safety (read before touching it)

**Never point this at production.** The team's `.env.local` points at the production R2 bucket and the
root `.env` may be production; the demo never reads either.

- It is a **dedicated compose project** (`hornero-demo`, override with `DEMO_PROJECT=hornero-<name>`) with its
  own volumes. Compose names volumes per project, so `demo-reset`'s `down -v` cannot touch the volumes of
  `make up`, `make up-local` or the Pi. Resetting rows instead is impractical: `organizacion_evento`
  (V014) and `actividad` (V004) are append-only by trigger, so their rows cannot be deleted.
- Compose runs with a scrubbed environment and only the generated, gitignored `.env.demo` (random JWT
  and database secrets, local MinIO with its own bucket `hornero-demo-images`, no Resend or Cloudflare
  credentials, `MAIL_LOG_ONLY`, retention, deletion and audit anchors off). Variables exported in your
  shell, such as `AWS_*`, cannot reach it.
- `demo-seed`, `demo-reset`, `demo-verify` and `demo-down` refuse unless: the BFF URL is `localhost`; the
  env file carries the demo marker; the project's database is `hornero_demo` and contains the
  `demo_marker` table (only `demo-up`, on a project it created, writes it); the published BFF port is the one
  in the URL; and bff and ms both report `http://minio:9000` as their storage endpoint (it prints only
  endpoint and bucket). `demo-up` refuses to adopt an existing project without that marker.
- `demo-reset` asks you to type the project name, lists the volumes it will drop, and never calls the
  bucket API. `DEMO_YES=1` skips the question.
- **Risky override.** `DEMO_ALLOW_REMOTE_BUCKET=I-UNDERSTAND-THIS-WRITES-TO-A-REAL-BUCKET make demo-seed`
  lets the seed upload its evidence PDFs to whatever bucket the stack uses. Do not use it with the
  production bucket. Objects uploaded that way are not deleted by `demo-reset` (it drops volumes only), so
  they stay as orphans.
