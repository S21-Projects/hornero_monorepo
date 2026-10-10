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
- Uses the demo accounts seeded by the MS `DataInitializer` (donante, referente, referente2,
  referente3, admin) and the seeded needs/articulos. It does not reset the DB: every run creates
  fresh donations tagged with a unique marker and never relies on absolute counts.

## Notes

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
