# Spec: reclamo-reporte-limites (new capability)

Per-user pending caps and rolling-window rate limits for reclamos (claims) and reportes (reports),
derived from persisted rows. Keywords MUST/SHOULD follow RFC 2119.

## Requirements

### R1. Claim pending cap
The MS MUST reject with HTTP 409 and code `LIMITE_RECLAMOS_PENDIENTES` any claim attempt by a
referente who already has `app.reclamo.pendientes-max` (default 5) claims in `PENDIENTE`. The check
MUST live in the shared reclamable validation so it applies to both claim creation and the
evidence-upload preflight (`verificarReclamable`). It does not depend on how many organizations the
user already manages (the existing organizations cap counts organizations, not pending claims).

### R2. Claim rate window
On claim creation only, the MS MUST reject with HTTP 429 and code `DEMASIADOS_RECLAMOS` when the
referente already has `app.reclamo.diario-max` (default 5) claims with
`creadoEn >= now - app.reclamo.window-hours` (default 24 h). All claim states count (including
withdrawn and rejected). Claims older than the window MUST NOT count. This check MUST run last,
after all other claim validations, and MUST NOT run in the evidence-upload preflight.

### R3. Persistent report window
The report rate limit MUST be derived from persisted report rows (`creadoEn >= now - window` by
reportante), not from process memory, so it survives MS restarts. Values and codes are unchanged:
`app.reporte.diario-max` (20), `app.reporte.window-hours` (24), HTTP 429 `DEMASIADOS_REPORTES`;
pending cap 10 with 409 `LIMITE_REPORTES_PENDIENTES` is unchanged. The in-memory `ReporteThrottle`
MUST be removed.

### R4. Configurability
Limits MUST be read from `app.reclamo.pendientes-max`, `app.reclamo.diario-max`,
`app.reclamo.window-hours` and the existing `app.reporte.*` keys, with the defaults above, and
changeable without code changes (restart required).

### R5. Documented burst overshoot
Limits are check-then-insert without locking. Concurrent simultaneous submissions MAY exceed a cap
by a small number of rows. This is accepted and MUST be documented (code comment on the checks).
Attempts that never persist a row are not counted.

### R6. Admin messages
The admin SPA claim error mapper MUST show a specific, user-friendly message for
`LIMITE_RECLAMOS_PENDIENTES` (409) and `DEMASIADOS_RECLAMOS` (429). The 409 code MUST be matched by
code before the generic `/pendiente/` message fallthrough so it is not swallowed.

### R7. No access-rule change
No route, role, guard or JWT behavior changes. The BFF passes status and code through unchanged.

## Scenarios

**S1. Pending cap on create (R1)**
Given a referente with 5 `PENDIENTE` claims and the default cap
When they create a claim on another reclamable organization
Then the response is 409 `LIMITE_RECLAMOS_PENDIENTES` and no claim is persisted.

**S2. Pending cap on evidence preflight (R1)**
Given the same referente
When the evidence-upload preflight `verificarReclamable` runs
Then it fails with 409 `LIMITE_RECLAMOS_PENDIENTES`.

**S3. Claim window exceeded (R2)**
Given a referente with 5 claims created within the last 24 h, none `PENDIENTE` (e.g. withdrawn or rejected)
When they create another claim
Then the response is 429 `DEMASIADOS_RECLAMOS`.

**S4. Old claims do not count (R2)**
Given a referente with 5 claims all created more than 24 h ago
When they create a claim
Then it succeeds.

**S5. Preflight ignores the window (R2)**
Given the referente of S3
When the evidence-upload preflight runs
Then it does not fail with `DEMASIADOS_RECLAMOS`.

**S6. Report window survives restart (R3)**
Given a reportante with 20 report rows created within the last 24 h and a freshly started service (no in-memory state)
When they create a report
Then the response is 429 `DEMASIADOS_REPORTES`.

**S7. Admin messages (R6)**
Given an API error with status 409 and code `LIMITE_RECLAMOS_PENDIENTES`, or status 429 and code `DEMASIADOS_RECLAMOS`
When the claim error mapper handles it
Then it returns the dedicated message for that code (not the generic pending-claim message).

R4 and R5 are verified by inspection (properties and comment), not by dedicated tests.
