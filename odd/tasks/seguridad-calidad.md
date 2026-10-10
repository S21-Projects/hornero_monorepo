# Feature: seguridad-calidad

Living guide for the final-delivery security and quality work. Check items off only when the
outcome and its checks were observed. Each task records route, evidence and commit.

## Objective

Close the security and validation gaps required by the course guide ("Seguridad" and
"Validación y calidad" sections) and show, per identified risk, which measure addresses it
and what evidence proves it.

## Problem / Why

A read-only audit on 2026-10-10 (branch `develop`, commit `da94f05`) found:

- Access and refresh JWTs are interchangeable (`JwtService.isTokenValid` only checks expiry;
  `JwtAuthFilter` accepts a refresh token as access with `ROLE_null`).
- No refresh-token revocation; logout only clears cookies.
- Hardcoded `JWT_SECRET` fallback in `application.yml`; mailer silently degrades to log-only
  when Resend config is missing.
- No rate limiting on login/register/refresh.
- No security headers (BFF, admin nginx, Astro); no CSRF defense with `sameSite=none` cookies.
- Backups are manual, on the same disk, never restore-tested; evidence files unbacked.
- No end-to-end test of the donation flow (BFF e2e is Nest boilerplate, no Playwright).

The guide requires measures "related to the identified risks", so a risk matrix ties it together.

## Already in place (no work needed, cite as evidence)

- Password hashing with BCrypt (`ApplicationConfig.java:13`, `AuthService.java:28`).
- Method-level `@PreAuthorize` on every non-public MS controller method.
- Ownership (IDOR) checks: necesidad, organizacion, donacion, entrega, acreditacion.
- httpOnly + secure cookies; role resolved via `GET /auth/me`, never from a cookie.
- Email verification by OTP sent through Resend (`mail/ResendClient.java`, `OtpEmailTemplate`),
  hashed codes, attempt throttle, resend endpoint, tests (`OtpServiceTest`, `OtpThrottleTest`).
- Delivery confirmation code: BCrypt-hashed, 10 min TTL, 5 attempts (`EntregaService`).
- MS global exception handler returns generic messages, no stack traces.
- Donation state machine (`TransicionesDonacion.java`) and line validations (`cantidad > 0`).
- Append-only accreditation event log (`OrganizacionEvento`).
- Unit test base: MS 67 test files, admin 78, Go 9, BFF 26 specs.
- Donation flow implemented in every layer: create → ronda (Go worker) → referente decision →
  `EN_CAMINO` → delivery code → `ENTREGADA`, plus admin override.

## Scope

**In scope (defined, list 1):** tasks S1–S11, B1–B3, Q1–Q3 below.

**Blocked on business definitions (list 2):** D1–D12 below. Do not implement until decided.

**Out of scope:** BFF public/admin split (parked), field-level PII encryption (pending D12).

## Constraints

- Three enforcement layers must stay in sync (MS `SecurityConfig`, BFF guards, admin routing).
- `JWT_SECRET` identical in MS and BFF.
- Git: local work only; commit only with explicit user permission per commit; never push, never
  open PRs (user rule).
- TDD: **on** — source `openspec/config.yaml` (`strict_tdd: true`). Runners: MS `mvn test`,
  BFF `npm test` / `npm run test:e2e`, admin `npm test` + `npm run build`, Go `go test ./...`.
  RED → GREEN → REFACTOR, evidence recorded per task.
- Native review (RDD): off (default). Ordinary checks apply.
- Delivery strategy: `ask-on-risk`; forecast ~1500 authored lines total across tasks.
- 2026-10-10: user approved commits; 8 thematic commits (shared files prevented one commit per task).
- B1–B3: build the mechanism now with configurable defaults; D11 later sets the real values.

## Tasks — defined (list 1)

### Security

- [x] **S1** Separate token types. Access tokens carry `type=access`; `JwtAuthFilter` rejects any
  token whose type is not access; `/api/auth/refresh` rejects any token whose type is not refresh;
  `@Valid` on `RefreshRequest`.
  - Acceptance: refresh token on a protected endpoint → 401; access token on `/refresh` → 401;
    existing login/refresh flow still works.
  - Checks: `mvn test` (new tests in `JwtServiceTest` / `JwtAuthFilter` / `AuthServiceTest`).
  - Done: MS `JwtService.isAccessToken`/`isRefreshToken`, filter + refresh use them, `@Valid` on
    `/refresh`, `/me` answers 401 (was 500) for a non-user principal. BFF `JwtStrategy` rejects
    tokens whose `type` is not `access` (layer sync). Deploy note: access tokens issued before
    this change lack `type` and get 401 once; the admin SPA auto-refreshes, so it is transparent.
- [x] **S2** Fail fast on missing secrets. Remove the `JWT_SECRET` fallback from
  `application.yml`; MS refuses to start without it (test profile keeps its own value). Mailer
  refuses to start without Resend config unless an explicit dev flag allows log-only.
  - Acceptance: `make up-local` still starts (`.env.local` provides values); missing var → clear
    startup error.
  - Done: `JwtService.validateSecret()` (blank or <32 bytes fails), `MailerConfig` fails unless
    Resend is configured or `MAIL_LOG_ONLY=true`; compose passes `MAIL_LOG_ONLY` (default false).
  - **USER ACTION:** add `MAIL_LOG_ONLY=true` to `.env.local.example` and your `.env.local`
    (edit blocked by permission rule) — done by user 2026-10-10. Pi `.env` must have `RESEND_API_KEY` + `OTP_FROM_EMAIL`.
- [x] **S3** Refresh-token persistence, rotation and revocation. Store refresh tokens (hashed,
  with `jti`) in DB; each refresh rotates (old one revoked); reuse of a revoked token revokes the
  whole family; BFF logout calls the MS to revoke.
  - Acceptance: logout → old refresh token rejected; replayed refresh token → 401.
  - Done: `RefreshToken` entity (`refresh_tokens`, jti only, family chain), `RefreshTokenService`
    (rotate, 30 s reuse grace for concurrent tabs, family revocation on theft, daily cleanup),
    `POST /api/auth/logout` (always 204), deactivating a user revokes all families, BFF logout
    revokes best-effort. Deploy: existing sessions must log in once (old tokens lack `jti`).
- [x] **S4** Rate limiting on `login`, `register`, `refresh`, `otp` in the BFF (keyed by
  `cf-connecting-ip`, fallback to socket IP).
  - Acceptance: N+1 attempts in the window → 429.
- [x] **S5** Security headers: `helmet` in the BFF; CSP/HSTS/X-Frame-Options/X-Content-Type-Options
  in admin `nginx.conf` and Astro.
  - Done with CSP in **Report-Only**. Follow-ups: (a) after deploy, browse every flow, clean
    console violations, switch to enforced `Content-Security-Policy`; replace Astro
    `script-src 'unsafe-inline'` with hashes/nonces; (b) DONE: `/nosotros` and `/contacto` now server-rendered, headers verified; (c) HSTS for the apex/panel belongs in Cloudflare; (d) admin CSP hardcodes
    `https://api.elhornero.org`.
- [x] **S6** CSRF defense in the BFF: reject state-changing requests whose `Origin`/`Referer` is
  not in the CORS allowlist (covers multipart uploads).
- [x] **S7** Upload validation by magic bytes (not client `mimetype`); reject unknown types instead
  of defaulting to `jpg`.
- [x] **S8** BFF `ValidationPipe` with `forbidNonWhitelisted: true`. Risk: frontends sending extra
  fields start getting 400 — verify admin flows before enabling.
- [x] **S9** Remove `/h2-console/**` from `permitAll` (H2 is test-scope only) and set
  `show-sql: false` outside dev.
- [x] **S10** BFF exception filter returns generic messages for unknown/upstream errors (no raw
  axios messages).
- [x] **S11** Add `@Roles` to `OrganizacionesController` `POST /`, `GET /mia`, `PATCH /:id`
  (layer sync with MS).

### Backups

- [x] **B1** Automated daily `pg_dump` on the Pi (cron/systemd timer) with retention rotation.
  Retention values depend on **D11**.
- [x] **B2** Offsite copy of DB dumps (destination depends on **D11**; R2 is the candidate since it
  already holds images).
- [x] **B3** Restore drill documented and executed once against a scratch DB; runbook in
  `docs/deploy-rpi-cloudflare.md` with roles (who can access, who restores).

  - Done (mechanism, local drill): `scripts/backup/{backup,restore-check,common}.sh` (`pg_dump -Fc`,
    retention 14 d, AES-256 + PBKDF2 encrypted offsite to a separate bucket via `amazon/aws-cli`,
    refuses the images bucket), `deploy/systemd/hornero-backup.{service,timer}`, `make backup` /
    `make restore-check`, runbook Parte C in `docs/deploy-rpi-cloudflare.md`.
  - **USER ACTIONS (Pi):** install the timer; create a private R2 backup bucket + scoped token +
    lifecycle rule; fill `BACKUP_*` in `.env` (+ lines in `.env.example`, edit blocked for us);
    keep the passphrase off the Pi; run `make restore-check` on the Pi (also on a downloaded `.enc`).
  - Still open in D11: real RPO/RTO/retention values and the `TBD (D11)` roles table.
    Residual: R2 images/evidence not covered.

### Quality

- [x] **Q1** (Decision 2026-10-10: API-level tests against `make up-local`, no browser.) End-to-end test of the donation flow against the docker stack: register/verify donor
  → create donation → (pool: ronda) → referente accepts → `EN_CAMINO` → delivery code → `ENTREGADA`;
  plus exceptional paths (rejection, cancel, wrong code, foreign user → 403).
- [x] **Q2** BFF tests with real guards (no mocked `RolesGuard`) for role matrix per endpoint.
- [x] **Q3** Risk matrix doc (`docs/seguridad-matriz-riesgos.md`): asset → threat → measure →
  evidence (test/file), linking every task above.

### Business rules (from decisions)

- [x] **N1** (from D1) Reject a DIRECTA donation when the necesidad's organization is at N0, in
  `DonacionService.crear`; make sure rondas never assign pool donations to necesidades of N0
  organizations. Tests in MS + an e2e exceptional case.
  - Done: `crear` (DIRECTA) → 409 `ORGANIZACION_NO_APROBADA` for N0/null before any write. Rondas
    already excluded N0 (`RondaService.esCandidataElegible`). `nivel` is the authority: `estado` is
    projected from it (N1+ → APROBADA), so no extra estado check.
  - Follow-ups (optional): public `GET /necesidades` still lists necesidades of orgs lowered to N0;
    admin SPA doesn't map `ORGANIZACION_NO_APROBADA` to a friendly message.

- [x] **N2** (from D5) Feature flag `app.donaciones.donante-publico` (env `DONANTE_PUBLICO`,
  default false), enforced in the MS: public donation reads mask `donanteName`/`donanteId` unless
  the flag is on or the caller is the receiving org's referente, the donor or an admin. BFF
  forwards the session token on those public routes when present. Astro renders masked donors
  anonymously. Tests in MS, BFF and e2e.
  - Done: `DonanteVisibilidad` policy (one SecurityContext read, referente org ids loaded once per
    request), applied to `findAll`/`findByOrganizacion`/`findById`. Pool donation without an org
    → only donor and admin. **USER ACTION:** add `DONANTE_PUBLICO=false` to `.env.example`.

- [x] **N3** (from D2) Daily job moves `ABIERTA`/`EN_PROGRESO` necesidades past
  `fechaVencimiento` to `VENCIDA`; DIRECTA donation creation rejects a necesidad that is not
  open or is past its date (409, independent of the job's timing). In-flight donations are left
  untouched (default; revisit with D4). Tests in MS + e2e.
  - Done: `VencimientoNecesidadesJob` (cron 00:05 Buenos Aires + catch-up on startup, one bulk
    UPDATE), `crear` → 409 `NECESIDAD_NO_DISPONIBLE`; date == today still valid. The `Clock` bean
    moved from UTC to `America/Argentina/Buenos_Aires` (also affects ronda day logic).
  - Findings: `fechaVencimiento` optional and past dates accepted on create; public/admin listings
    still show `VENCIDA`; `actualizar` has no transition validation (handled in N4).

- [x] **N4** (from D2, user 2026-10-10) Referente can relaunch an expired necesidad from `/needs`:
  explicit "Relanzar" action on `VENCIDA` necesidades, requires a new future `fechaVencimiento`,
  goes back to `ABIERTA`, and respects the open-necesidades cap of the org's level. `actualizar`
  must not allow `ABIERTA` with a past date (the job would re-expire it immediately).
  - Done: `POST /necesidades/{id}/relanzar` (VENCIDA only, date strictly future, level cap,
    resets `fechaPublicacion`); PATCH can't leave VENCIDA (`NECESIDAD_VENCIDA_USAR_RELANZAR`) nor
    open with a past date; create rejects past dates; public listings hide VENCIDA (owner/admin
    still see them; BFF forwards the session token on the public GET); admin "Relanzar" button,
    donate form hidden for non-open necesidades.
  - Left alone: CUMPLIDA → ABIERTA via PATCH skips the cap check; an ABIERTA past-date necesidad
    stays listed until the nightly job runs (donations already refused).

## Business definitions pending (list 2)

Each item needs a team decision before related work starts. Record the decision and date here.

- [x] **D1** Can donors donate to an organization not yet approved? (today: yes)
  - Decided 2026-10-10 (user): **no**. The organization needs at least one approval level
    (`nivel` ≥ N1; N0 = REGISTRADA is not approved). Implementation: task **N1** below.
- [x] **D2** Can donors donate to a necesidad that is closed or expired? Who/what moves a
  necesidad to `VENCIDA`? (today: not validated, nothing sets it)
  - Decided 2026-10-10 (user): expired necesidades are taken down; `fechaVencimiento` is their
    TTL. Implementation: task **N3**. Verified gap: `EstadoNecesidad.VENCIDA` exists but nothing
    sets it; rondas already skip past-date necesidades; DIRECTA creation checks neither date nor
    estado.
- [ ] **D3** Quantity ceiling: can a donation exceed what the necesidad requests?
- [ ] **D4** Stale donations: do `OFRECIDA`/`EN_CAMINO` donations expire after some time?
- [x] **D5** Which donor data is public? (today `GET /donaciones/{id}` exposes donor name)
  - Decided 2026-10-10 (user): donor identity is visible only to the receiving organization (plus
    the donor and admins). Public display stays possible behind a feature flag, **off** by
    default. Implementation: task **N2**.
- [ ] **D6** Which events send email, and to whom? (offered, accepted, delivered, org approved…)
  Note: `Mailer` only exposes `enviarOtp`; needs generalizing.
- [ ] **D7** Rondas: manual only, or also scheduled?
- [ ] **D8** Password policy (min 6 today) and password reset flow.
- [ ] **D9** Deactivated user: immediate cut-off (DB check per request) or wait for 15 min token
  expiry?
- [ ] **D10** Audit scope: which actions get logged (logins, admin actions, state changes)?
- [ ] **D11** Backup policy: RPO, RTO, retention, offsite destination, who has access/restores.
- [ ] **D12** PII retention and deletion (Ley 25.326); encryption of donor addresses/coordinates.

## Progress log

| Date | Task | Route | Evidence | Commit |
|------|------|-------|----------|--------|
| 2026-10-10 | — | — | Document created from audit | — |
| 2026-10-10 | N4 | MS+BFF+admin delegated | RED: MS compile error; BFF 6 fail (admin detail guard written with its test, no RED). GREEN: `mvn test` 586/586; BFF 300/300 (3 reruns), tsc ok; admin 409/409 + build; astro build; `make e2e` 51/51 | (this commit) |
| 2026-10-10 | N3 | MS delegated | RED: compile error on new tests; then 36 errors (self-invoked @Transactional), fixed. GREEN: `mvn test` 566/566; `make e2e` 51/51; startup catch-up logged 1 necesidad expired | (this commit) |
| 2026-10-10 | Q2 fix | inline (1 test file) | `role-matrix.spec.ts` flaked ~1/8 runs ("socket hang up", supertest opening a server per request); listen once on port 0 → 25/25 green runs, tsc ok | (this commit) |
| 2026-10-10 | N2 | MS+BFF+astro+admin delegated | RED: MS compile error, BFF 8 fail (no e2e RED captured). GREEN: `mvn test` 558/558; BFF 295/295, tsc ok; admin 399/399 + build; astro build; `make e2e` 50/50 | (this commit) |
| 2026-10-10 | N1 | MS delegated | RED: DonacionServiceTest 2 fail; e2e 1 fail (201 vs 409). GREEN: `mvn test` 544/544; `make e2e` 44/44 | (this commit) |
| 2026-10-10 | B1–B3 + S5b | delegated | RED: restore-check on garbage/truncated dump exits 1. GREEN: shellcheck clean; local backup + `make restore-check` OK (14 tables); encrypted round trip OK, wrong passphrase refused; upload tested against local MinIO only; astro build + headers on both pages | (this commit) |
| 2026-10-10 | Q3 | inline (1 doc) | `docs/seguridad-matriz-riesgos.md`: 21 risks, every cited evidence file verified to exist | 89c0599 |
| 2026-10-10 | F1 | MS delegated | RED: new lockout integration tests 6/7 fail; e2e `5c` "Expect test to fail" after rebuild. GREEN: 7/7 targeted, `mvn test` 541/541, `make e2e` 43/43. Files: EntregaService, OtpService, EntregaServiceLockoutIntegrationTest, OtpServiceLockoutIntegrationTest, e2e/tests/03-exceptional-paths.e2e.ts | 0bfe751 |
| 2026-10-10 | Q1 | e2e delegated | `make up-local` healthy; `make e2e` 43/43 (1 `it.fails` = bug F1), ~66 s (mostly login throttle wait), 3 reruns green on same DB. RED: lockout test failed on first run (400 instead of 429), probe confirmed. Files: e2e/ (package.json, tsconfig, vitest.config, .gitignore, README, src/client|global-setup|fixtures.ts, tests/01–05), Makefile (`e2e` target), CLAUDE.md (1 line) | bb161d6 |
| 2026-10-10 | Q2 | BFF delegated (test only) | Mutation RED (removed/widened `@Roles` → fail). GREEN: `role-matrix.spec.ts` 15/15; `npm test` 287/287; `tsc` ok. 62 routes: 15 public, 2 any-auth (`GET /` scaffold, `/auth/me`), 45 role-restricted. Note: `GET /donaciones/:id/asignaciones` open to all roles, ownership enforced in MS | b89218c |
| 2026-10-10 | S3 | MS+BFF delegated | RED: MS compile error, BFF 3 fail. GREEN: `mvn test` 534/534; BFF `npm test` 272/272 (3 reruns green), `tsc` ok. Files — MS: auth/RefreshToken, RefreshTokenRepository, RefreshTokenService, JwtService, AuthService, AuthController, user/UsuarioService + 3 new tests, AuthServiceTest/JwtServiceTest/UsuarioServiceTest. BFF: auth.service(.spec).ts, auth.controller.ts. Docs: security-access-token-httponly.md | 1901288 |
| 2026-10-10 | S4+S6+S5+S8b | BFF/admin/astro delegated | RED: missing-module failures per suite. GREEN: BFF `npm test` 269/269, `tsc` ok, `npm run build` ok, real boot checked (helmet headers, foreign-Origin POST 403, 6th login 429); `nginx -t` ok; astro build ok. Files — S8b: usuarios/dto/toggle-activo.dto(.spec).ts, usuarios.controller/service. S4: auth/auth-throttler.config.ts, guards/client-ip-throttler.guard(.spec).ts, auth.throttling.spec.ts, auth.controller.ts, auth.module.ts, package(-lock).json (shared with S5). S6: common/allowed-origins(.spec).ts, common/origin-check.middleware(.spec).ts. S5: app.setup(.spec).ts, main.ts, admin security-headers.conf + nginx.conf + Dockerfile, astro src/lib/securityHeaders.ts + src/middleware.ts | 1901288 (S4) / a5a6816 (S8b) / 6eba20f (S5, S6) |
| 2026-10-10 | S11+S10+S8+S7 | BFF delegated | RED per task (S11 3 fail, S10 4 fail, S8 2 fail, S7 3 fail + missing module). GREEN: `npm test` 233/233, `tsc --noEmit` ok. Lint baseline already failing (241 pre-existing errors), not a gate. Files — S11: organizaciones.controller.ts, organizaciones.roles.spec.ts. S10: common/axios-exception.filter(.spec).ts. S8: common/validation(.spec).ts, main.ts (DTO cross-check: all admin/seed payloads covered). S7: upload/image-type(.spec).ts, upload.service(.spec).ts, upload.module.ts | a5a6816 |
| 2026-10-10 | S2+S9 | MS delegated | RED: compile failure on new tests. GREEN: `mvn test` 506/506; `docker compose config -q` ok. Files S2: application.yml (jwt+mail), JwtService, MailerConfig, test application.yml, docker-compose.yml, README.md, docs/otp-email-validation.md, JwtSecretValidationTest, MailerConfigTest. S9: SecurityConfig, application.yml (show-sql, split with `git add -p`), SecurityConfigH2ConsoleTest | baf387d |
| 2026-10-10 | S1 | MS delegated (4 src files + tests); BFF inline (1 file) | RED: new MS tests 5 fail/2 error, BFF spec 2 fail. GREEN: MS `mvn test` 497/497; BFF `npm test` 190/190, `tsc --noEmit` ok | pending user permission |

## Next step

All defined tasks done. Remaining: user actions on the Pi (deploy, backup setup, restore drill), CSP enforcement after deploy, and decisions D1–D12. Commits at the end, one per task (user decision 2026-10-10).
