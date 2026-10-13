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
  - **USER ACTION:** add `MAIL_LOG_ONLY=true` to your `.env.local` (`.env.local.example` was removed 2026-10-13; `.env.local` is a copy of `.env.example`)
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

- [x] **N8** (from D8) Password policy per NIST SP 800-63B-4 at registration (MS authority, BFF DTO
  and admin register form mirror it): length 15–64 characters, ≤ 72 UTF-8 bytes (BCrypt limit),
  no composition rules, reject passwords in a bundled common/breached blocklist (≥ top 3000,
  ASVS 6.2.4) and passwords containing the email local part or "hornero". Existing users are not
  forced to change. Seeds/demo accounts must comply.
  - Done: `PasswordPolicy` (MS authority) — 15–64 code points, ≤ 72 bytes, blocklist of 5,553
    entries ≥ 15 chars from SecLists (MIT, attribution in the file header), repetitive/sequential
    and personal-data checks; codes `PASSWORD_DEMASIADO_CORTA|LARGA`, `PASSWORD_COMUN`,
    `PASSWORD_CONTIENE_DATOS_PERSONALES`. BFF DTO mirrors length; BFF filter now relays DTO
    validation messages (was a generic "Bad Request"). Admin register form shows the rule.
    `scripts/seed.ts` referentes now use `comedor-solidario-cordoba`; DataInitializer demo
    accounts unchanged. RF draft delivered to the user for the thesis.
- [x] **N9** (from D9) Deactivating a user cuts access immediately: the MS rejects any request
  whose token belongs to an inactive user (401 `USUARIO_INACTIVO`); refresh families already
  revoked (S3). Check BFF paths that answer without calling the MS.
- [x] **N7** (from D7) Optional scheduled ronda: `app.rondas.auto.enabled` (default false) + cron
  property; runs the same ronda as the manual trigger with a system actor; skips cleanly when
  the worker is down.
  - Done N9: `JwtAuthFilter` checks `existsByIdAndActivoTrue` per request → 401 `USUARIO_INACTIVO`
    on protected routes, anonymous on public ones; BFF `/auth/me` and uploads verify against the
    MS first; admin SPA skips refresh and shows "Tu cuenta fue desactivada" on /login.
  - Done N7: `RondaAutomaticaJob` (`RONDAS_AUTO_ENABLED`, default false; `RONDAS_AUTO_CRON`,
    default 06:00 Buenos Aires), `Ronda.origen` MANUAL/AUTOMATICA, `ejecutadaPor` nullable.
    **USER ACTION (Pi):** `make migrate` (V002) before enabling; add the two vars to `.env.example`.
  - Caveat: e2e registration throttle (3/min) can carry over between back-to-back `make e2e`
    runs; full run ~3 min.

- [x] **N10** (from D10) Activity log: `actividad` table + recording service (insert-only, no
  update/delete, input sanitized against log injection), hooks at the events above, admin
  query endpoint + screen, Docker `logging` max-size/max-file on every service, and stop the
  plaintext OTP log line in log-only mail mode. Inventory of today's coverage: see D10.
  - Done: `actividad` package (immutable entity, 38 `TipoActividad` values stored as text, no
    CHECK constraint), `registrar` (same tx) vs `registrarAislado` (REQUIRES_NEW, never throws)
    for failure/security events, `TextoSeguro` against log injection, BFF forwards `X-Client-IP`
    via an axios interceptor, `GET /api/actividad` (admin, paginated) + admin `/actividad`
    screen, retention job (`ACTIVIDAD_RETENCION_DIAS`, default 365, provisional pending D12),
    Docker log rotation (10m × 5) on every service, OTP no longer logged, null actors fixed in
    `OrganizacionEvento`. Doc: `docs/registro-actividades.md`; R18 residual → B.
  - Not done: `motivo` input in the admin UI for (de)activation; screen shows user id, not name;
    no DB-level immutability (trigger / insert-only role); uploads not recorded (documented).
  - **USER ACTION:** add `ACTIVIDAD_RETENCION_DIAS=365` to `.env.example` (optional).

- [x] **N11** Idempotency (user decision 2026-10-10: **mandatory**, "like transactions").
  `Idempotency-Key` header per draft-ietf-httpapi-idempotency-key-header-07 (expired I-D, de facto
  industry practice): required on every business `POST` that creates or triggers something (not
  the `/auth/*` endpoints); stored in the MS (`idempotency_keys`, per user + operation, request
  fingerprint, cached status/body, 24 h expiry); replay → original response; in-flight → 409;
  other payload → 422; missing → 400. BFF forwards it (CORS allowed header). Admin sends a stable
  key per logical submission. Plus `@Version` optimistic locking on Donacion, Necesidad,
  Organizacion (concurrent different operations → 409) with `scripts/sql/V003` initializing the
  version column. Breaking for old open admin tabs and the Bruno collection (accepted).
  - Done: `@Idempotente` on 9 POSTs (donaciones, necesidades, relanzar, organizaciones,
    evidencias, entrega codigo/verificar, rondas, articulos); filter after Spring Security,
    SHA-256 fingerprint over method + URI + canonical JSON, stale EN_PROCESO takeover after 2 min,
    5xx/401/403/429 release the key, daily purge; BFF forwards key + relays `Idempotent-Replayed`,
    CORS allowedHeaders explicit; admin `useIdempotencyKey` per submission + axios fallback;
    `@Version` → 409 `CONFLICTO_CONCURRENTE`; V003 applied locally.
  - Found while verifying: `make seed` broken by the S4 register throttle (seed now waits out 429s)
    and org creation with an existing name → 500 on the unique slug (fixed: `-2`, `-3` suffix;
    `DataIntegrityViolationException` → 409 `CONFLICTO_DATOS`; seed skips orgs already owned).
  - **USER ACTION (Pi):** `make migrate` (V002 + V003) right after deploy; reload open admin tabs.

### Follow-ups (2026-10-12, branch `feat/seguridad-mejoras`)

- [x] **M1** `/actividad`: show actor name/email instead of the user id.
- [x] **M2** Admin: optional `motivo` field when activating/deactivating a user (API accepts it).
- [x] **M3** Public necesidad listings hide necesidades of organizations at N0.
- [x] **M4** `CUMPLIDA` → `ABIERTA` via PATCH enforces the open-necesidades cap of the level.
- [x] **M5** Admin donation form maps `ORGANIZACION_NO_APROBADA` (and other donation 409 codes) to
  friendly Spanish messages.
- [x] **M6** `actividad` immutable at DB level (trigger rejecting UPDATE/DELETE except the retention
  purge), via `scripts/sql/V004`.
- [x] **M7** Admin surfaces `Idempotent-Replayed: true` (e.g. "Esta operación ya se había
  registrado").
- Evidence 2026-10-12: `mvn test` 721/721; admin 475/475 + build + lint; `make e2e` 78/78 (M3/M4
  e2e cases, no e2e RED observed; unit RED for M3/M4, admin RED for M5). M6 verified on local
  Postgres: UPDATE/DELETE/TRUNCATE rejected, DELETE with `hornero.purga_actividad` allowed
  (rolled back), real retention job purged a probe row. **USER ACTION (Pi):** `make migrate`
  applies V004 (start the MS once first so `actividad` exists).

- [x] **N12** (from D4) Stale donations job + `estadoDesde` + admin "estancada" flag (branch
  `feat/donaciones-estancadas`).
  - Done: `Donacion.cambiarEstado` keeps `estadoDesde`; `DonacionesEstancadasJob` (00:15 BA + startup
    catch-up, per-row tx + lock, conflicts skipped); asignacion expiry reuses RECHAZADA via shared
    `devolverAlFondo`; actividad types `DONACION_VENCIDA`, `DONACION_PROPUESTA_VENCIDA`,
    `DONACIONES_ESTANCADAS_PROCESADAS`; `/donaciones/activas` exposes `estancada`, `diasEnEstado`,
    `estancadas=true` filter; admin badge + toggle; V005 backfills `estado_desde`.
  - Evidence: RED per layer; `mvn test` 762/762, BFF 343/343 + tsc, admin 479/479 + build + lint,
    `make e2e` 79/79. Local DB: first boot cancelled 3 old DIRECTA offers and expired 2 proposals.
  - **Deploy warning:** on the Pi, the first boot of this MS runs the catch-up job on real data.

- [x] **N14** Generalize `Mailer` (template per message) + password reset: generic response,
  random single-use token (hashed, 30 min), auth rate limits, NIST policy on the new password,
  revoke all refresh families on reset, actividad records. Branch `feat/mails-reset`.
  - Done: `Mailer.enviar(MensajeCorreo)` + templates, async `mailExecutor`, `MAIL_FROM_EMAIL`
    (falls back to `OTP_FROM_EMAIL`), `APP_PANEL_URL`; `POST /auth/password/olvido` (always 202,
    generic) and `/restablecer` (SHA-256-hashed 256-bit token, 30 min, atomic single use, N8
    policy before consuming, revokes refresh families, marks email verified, "password changed"
    mail); throttles 3/min and 5/min; admin pages; daily token purge 03:45.
  - Fix after review (inline): `/restablecer` was wrapped in PublicOnlyRoute, so a browser with a
    session lost the token on redirect; now unguarded (router test RED → GREEN).
  - Residual: an access token issued before the reset stays valid until it expires (≤ 15 min);
    refresh families are revoked.
  - Evidence: `mvn test` 795/795; BFF 359/359 + tsc; admin 501/501 + build + lint; `make e2e`
    85/85 (happy path covered by MS integration test with a capturing Mailer; no prod backdoor).
- [x] **N13** Event notifications per D6 (after-commit async, failures to actividad) + admin daily
  digest.
  - Done: domain events + `@TransactionalEventListener(AFTER_COMMIT)` on `mailExecutor`, 10
    templates (`NotificacionesEmailTemplates`), verified + active recipients only, failures →
    `NOTIFICACION_FALLIDA` (masked), successes not recorded, ronda proposals summarized per
    referente, admin digest 08:00 BA (skipped when empty), kill switch `NOTIFICACIONES_ENABLED`.
    Doc: `docs/notificaciones-email.md`. Evidence: `mvn test` 867/867 (AFTER_COMMIT RED proven by
    swapping to @EventListener), `make e2e` 85/85.
  - Found: with a Resend key present, `MAIL_LOG_ONLY=true` is ignored, so the local stack sends
    real mail — including to seeded demo addresses on `@hornero.ar` (confirmed in the Resend
    dashboard 2026-10-12: e2e + manual runs mailed donante/referente/admin@hornero.ar).
  - Fixed: `MAIL_LOG_ONLY=true` now always wins over a configured key (RED: test hit Resend with
    401; GREEN: `mvn test` 868/868); local MS rebuilt and logs log-only mode.
  - Resolved 2026-10-12 (user): `hornero.ar` does not resolve (no MX/A/NS) — nothing was
    delivered. Production moves to real users: `SEED_DEMO_DATA` (default false; `make up-local`
    sets true) gates demo users/orgs/necesidades/donaciones; without demo data the MS requires
    `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` (NIST policy) and never overwrites an existing
    admin. Evidence: `mvn test` 876/876, `make e2e` 85/85, one-off container without SUPER_ADMIN_*
    refused to boot. **USER ACTION (Pi):** set SUPER_ADMIN_*, deploy, deactivate legacy
    `@hornero.ar` accounts; test with Gmail plus-addressing.

- [x] **N15** (from D12) Admin anonymization of a user; coordinate coarsening job; 90-day purge of
  `emailIntento`; D11 values in the runbook.
  - Done: `POST /usuarios/{id}/anonimizar` (admin, idempotent; `.invalid` placeholder email,
    unusable password, sessions/OTP/reset/idempotency rows removed; guards: self, last admin,
    referente with orgs); `CoordenadasMinimizacionJob` (2 decimals HALF_UP, terminal > 30 d);
    `EmailIntentoPurgaJob` + V006 trigger allowing only `email_intento → NULL` under the purge
    setting (verified in psql); runbook D11 values. Evidence: `mvn test` 913/913, BFF 363/363,
    admin 512/512 + build + lint, `make e2e` 95/95.
  - Residual: two admins anonymizing each other at the same instant could leave zero active
    admins (no lock).

- [x] **N16** Evidence for the guide's "Validación y calidad" section: coverage reports per
  service (JaCoCo for the MS, jest/vitest coverage, `go test -cover`), a `make coverage` target,
  and `docs/validacion-calidad.md` (Spanish) mapping each guide bullet to concrete tests/results,
  with the normal vs exceptional scenario matrix. Branch `feat/validacion-calidad`.
- [x] **N17** Close the M3 gap: `GET /necesidades/{id}` of an N0 organization only for its owner
  and admins.
  - Done N17: `findById` → 404 for N0/null-level orgs except owner/admin; BFF forwards the token on
    the detail GET (RED: 3 MS + 2 BFF + 1 e2e).
  - Done N16: JaCoCo behind `-Pcoverage`, admin `@vitest/coverage-v8` (vitest 4.1.9 → 4.1.11 patch
    bump), `make coverage`; `docs/validacion-calidad.md` (37 cited test files verified to exist).
    Numbers 2026-10-13: MS 920 tests / 90.7 % lines; BFF 365 / 95.8 %; admin 513 / 79.7 %; Go 56
    / 66.7 % statements; e2e 95.

- [x] **N18** CSP readiness (S5 follow-up): CSP origins derived from build/runtime config instead
  of the hardcoded `api.elhornero.org`, a `CSP_MODE` switch (`report-only` default | `enforce`)
  for admin nginx and Astro, and a headless-browser sweep of the local stack collecting CSP
  violations to fix them before the user enforces in production. Branch `feat/csp`.
  - Done: admin CSP rendered at container start (nginx envsubst template + entrypoint script; API
    origin from `VITE_BFF_URL`); `CSP_MODE` runtime switch for admin and Astro (anything but
    `enforce` → report-only); Astro hashes every inline script per response, `'unsafe-inline'`
    removed from `script-src` (inline `onerror` handlers replaced); Playwright sweep with CSP
    enforced over public pages and all three roles → 0 violations; `make e2e` 95/95.
  - Residual: `style-src 'unsafe-inline'` (React/Leaflet inline styles).
  - Follow-ups found by the sweep (not CSP): React hydration error #418 on a public Astro page;
    direct loads of protected admin URLs redirect to the role home (deep links) — investigate.

- [x] **N19** Direct loads of protected admin URLs redirect to the role home instead of the
  requested screen (breaks deep links, including N13 email links). Root-cause and fix.
- [x] **N20** React hydration error #418 on a public Astro page. Root-cause and fix.
  - Done N19: auth store started 'unauthenticated' until AuthInitializer's effect ran (child
    effects first) → guard sent to /login → PublicOnlyRoute to role home. Store now seeds
    'loading' from `session_hint`; login returns to `state.from` validated by `safeRedirectPath`
    (also fixed an open redirect in verify-email: `//evil.com` passed `startsWith('/')`).
    Playwright: deep links land on the requested screen for all roles; anonymous → login → back.
  - Done N20: `NeedsBoard` formatted date-only `fechaVencimiento` via `new Date()` → UTC server vs
    UTC-3 browser mismatch (and an off-by-one day on screen). `formatFechaISO` reads calendar
    fields. Clean console in both time zones; page shows padded dates (01/11/2026).
  - Evidence: admin 534/534 + build + lint, astro build, `make e2e` 95/95.

### Map branch integration (2026-10-13)

`feat/mapa-vulnerabilidad` (0603b6e, rebased on 9e0bd51 by the other agent; conflicts in
ProtectedRoute/login resolved in favour of develop's `safeRedirectPath`) reviewed read-only and
merged `--no-ff` (72e18a7). Merged tree == branch tip; re-run on it: MS 1040/1040, BFF 415/415,
admin 596/596, Go ok, `make e2e` 95/95. Review verdict: merge with follow-ups:

- [ ] **P1** Claim outcome notifications (approved/rejected) via N13 domain events.
- [ ] **P2** R2 evidence files of claims survive anonymization (pending user decision).
- [x] **P3** Claims spam limits: cap of pending claims per user; persistent (not in-memory) throttle.
  - Done (SDD `reclamos-limites`, branch `feat/reclamos-limites`): every limit is a count over rows
    that already exist, so nothing is lost on restart and there is no schema change. Claims: 5
    pending max (409 `LIMITE_RECLAMOS_PENDIENTES`, also in the evidence preflight) and 5 created per
    rolling 24 h, any state (429 `DEMASIADOS_RECLAMOS`, creation only). Reports: the in-memory
    `ReporteThrottle` is gone; 20 per 24 h now counts persisted rows (429 `DEMASIADOS_REPORTES`,
    code unchanged). Keys `app.reclamo.*` / `app.reporte.*` in `application.yml` (restart to change).
    Admin mapper shows dedicated messages for both new claim codes.
  - Accepted: check-then-insert without a lock, so concurrent submissions may overshoot a cap by a
    few rows (documented in the code); a 429 on creation leaves the already-uploaded evidence
    objects orphaned in the bucket.
  - Evidence: MS `mvn test` 1039/1039, admin `npm test` 597/597 + `npm run build` + lint clean (3
    pre-existing warnings in gitignored `coverage/`). 5 new tests (3 claims, 1 reports, 1 mapper).
    `make e2e` not run (P4).
- [x] **P4** e2e coverage for claims, reports, cascades, anonymization of claims/reports, public map.
  - Done (branch `feat/e2e-reclamos-mapa`): `e2e/tests/12-reclamos-reportes.e2e.ts`, 7 tests: claim + 403s,
    approve (rival claim rejected, org reports discarded), reject, report + marcar-inactiva (pending
    claim rejected), anonymization (pending claim/report closed, phone/message/evidence/detalle scrubbed),
    anonymous `/organizaciones/mapa`. No API creates SIN_RECLAMAR orgs, so the file imports its own
    through the compose Postgres (`psql`, `importUnclaimedOrg` in `e2e/src/fixtures.ts`) and deletes the
    previous run's `e2e-` rows first, keeping the org cap and the 5/24 h claim window free on reruns.
    The new limits are not exercised (user: no excessive tests).
  - Evidence: passed on first run (covers existing behavior, no product bug found; the only initial
    failure was a test typo, `/auth/me` shape). `make e2e` 102/102 twice in a row, `tsc --noEmit` ok.
- [ ] **P5** CC-BY attribution (INDEC; Rodriguez & de Grande / CONICET) on `/mapa`; record the
  ReNaCoM data license.
  - Done (branch `feat/mapa-atribucion`): sources paragraph on `/mapa` crediting INDEC and
    Rodriguez & de Grande (CONICET) with a CC BY 4.0 link and "processed by Hornero", plus ReNaCoM
    with a link to its CONICET record; "Attribution and licenses" in `docs/mapa-vulnerabilidad.md`.
    Evidence: astro build ok (Astro has no test runner). **Open:** the ReNaCoM record's license
    could not be read (repository unreachable 2026-10-13); copy it into the doc to close P5.
- [x] **P6** Nits: in-memory TTL cache for `/organizaciones/mapa`; redundant unique on `origen_id`;
  approved-claim org leaves the map until validated (user question).
  - Decided 2026-10-13 (user): keep the current behavior — `/mapa` shows APROBADA and SIN_RECLAMAR
    only, so an org whose claim was approved leaves the map until validated. Showing PENDIENTE orgs
    with a label is under team evaluation (`docs/acciones-pendientes-equipo.md`).
  - Done (branch `feat/mapa-nits`): `MapaOrganizacionesCache` (TTL 300 s,
    `app.mapa.cache-ttl-seconds` / `APP_MAPA_CACHE_TTL_SECONDS`, injected `Clock`, synchronized reload)
    now fronts `GET /organizaciones/mapa`; `unique = true` removed from `Organizacion.origenId` and
    `V010__organizaciones_origen_id_unique_dedup.sql` drops the duplicate constraint by column
    (V007 partial index stays; no `EsquemaVerificador` check, cleanup only). Docs: `db-changes.md`,
    `acciones-pendientes-equipo.md`. Evidence: `mvn test` 1040 green (1 new test, RED then GREEN);
    `make migrate ENV_FILE=.env.local` twice, second run clean; psql shows only
    `ux_organizaciones_origen_id` for origen_id (0 UNIQUE constraints on that column); `make e2e` 102/102.
    **Open:** the "approved-claim org leaves the map until validated" question is a user decision.

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
- [x] **D3** Quantity ceiling: can a donation exceed what the necesidad requests?
  - Closed 2026-10-10 (user): not applicable — necesidades select articulos without quantities
    (catalog decision 6), so there is nothing to cap against.
- [x] **D4** Stale donations: do `OFRECIDA`/`EN_CAMINO` donations expire after some time?
  - Decided 2026-10-12 (user approved proposal): reassignment stays out of scope (decision
    2026-09-20). Daily job, configurable windows: DIRECTA `OFRECIDA` without answer 7 d → auto
    `CANCELADA` (SISTEMA, motivo "sin respuesta"); pool asignacion `PROPUESTA` unanswered 3 d →
    treated as rejected (existing return-to-pool path); `ACEPTADA`/`EN_CAMINO` 14 d and
    `PENDIENTE_CONFIRMACION` 7 d → flagged "estancada" for the admin (no auto-cancel). Needs an
    `estadoDesde` timestamp. Task **N12**.
- [x] **D5** Which donor data is public? (today `GET /donaciones/{id}` exposes donor name)
  - Decided 2026-10-10 (user): donor identity is visible only to the receiving organization (plus
    the donor and admins). Public display stays possible behind a feature flag, **off** by
    default. Implementation: task **N2**.
- [x] **D6** Which events send email, and to whom? (offered, accepted, delivered, org approved…)
  - Decided 2026-10-12 (user approved proposal): donante — donation accepted/rejected,
    auto-cancelled (N12), delivery confirmed; referente — new direct donation, new pool proposal,
    org approved/rejected, level changed, evidence observed; admin — one daily digest (pending
    orgs + stale donations). Sent after commit, async; failures recorded in actividad, no retries;
    no subscription preferences. Password reset approved too (OWASP Forgot Password Cheat Sheet).
    Tasks **N14** (Mailer + reset) then **N13** (notifications). Resend domain verification in
    progress by the user.
  Note: `Mailer` only exposes `enviarOtp`; needs generalizing.
- [x] **D7** Rondas: manual only, or also scheduled?
  - Decided 2026-10-10 (user): manual stays the default; an optional scheduled job can be
    enabled by config. Task **N7**.
- [x] **D8** Password policy (min 6 today) and password reset flow.
  - Decided 2026-10-10 (user): follow a standard, validated at registration, documented as a
    functional requirement. Standard: NIST SP 800-63B-4 §3.1.1.2 (single-factor: min 15 chars,
    allow ≥ 64, no composition rules, blocklist of common/compromised passwords, no forced
    rotation), consistent with OWASP ASVS 5.0 V6.2 (6.2.1, 6.2.4, 6.2.5, 6.2.9). Task **N8**.
    Reset flow: not decided yet.
- [x] **D9** Deactivated user: immediate cut-off (DB check per request) or wait for 15 min token
  expiry?
  - Decided 2026-10-10 (user): immediate — the next request with the old token fails. Task **N9**.
- [x] **D10** Audit scope: which actions get logged (logins, admin actions, state changes)?
  - Decided 2026-10-10 (user): append-only `actividad` table (actor, rol, accion, entidad,
    antes/despues, motivo, ip, ocurridoEn) for security events (login ok/fail, lockouts, refresh
    reuse, logout), every ADMIN write, and donacion/necesidad state transitions; reads, 403 and
    429 stay log-only; admin screen with filters; Docker log rotation; retention tied to D12.
    Never store passwords, tokens, OTP/delivery codes. Reference: OWASP ASVS 5.0 V16
    (16.2.1, 16.2.5, 16.3.1–16.3.3, 16.4.1–16.4.2). Task **N10** (after N8, N9, N7).
- [x] **D11** Backup policy: RPO, RTO, retention, offsite destination, who has access/restores.
  - Decided 2026-10-13: RPO 24 h, RTO 4 h, retention 14 d local / 30 d R2, restore drill once per
    term; people for each role still to be named by the team. Doc: `docs/politica-datos-y-respaldo.md`.
- [x] **D12** PII retention and deletion (Ley 25.326); encryption of donor addresses/coordinates.
  - Decided 2026-10-13: right to erasure by admin-run anonymization (keep donations/actividad
    without identifying data); no field encryption — coarsen terminal donations' coordinates to
    2 decimals after 30 d; actividad 365 d; failed-login `emailIntento` 90 d. Task **N15**.

## Progress log

| Date | Task | Route | Evidence | Commit |
|------|------|-------|----------|--------|
| 2026-10-13 | P4 | e2e delegated (writer) | New tests passed on first run (existing behavior). `make e2e` 102/102 twice in a row (baseline 95), `tsc --noEmit` ok. Files: e2e/tests/12-reclamos-reportes.e2e.ts, e2e/src/fixtures.ts (psql helpers), e2e/README.md | (pending commit) |
| 2026-10-10 | — | — | Document created from audit | — |
| 2026-10-10 | N11 + slug fix | MS+BFF+admin+e2e delegated; seed 429 retry inline | RED per part. GREEN: `mvn test` 700/700; BFF 341/341, tsc ok; admin 460/460 + build + lint; `make e2e` 76/76; `make seed` exit 0 on 3 consecutive runs | (these commits) |
| 2026-10-10 | N10 | MS+BFF+admin+infra delegated; compose env wiring inline | RED for hooks/BFF/admin (core service + TextoSeguro written before tests, no RED). GREEN: `mvn test` 675/675; BFF 334/334, tsc ok; admin 442/442 + build + lint; compose config ok; `make e2e` 67/67 twice | (this commit) |
| 2026-10-10 | N9+N7 | MS+BFF+admin delegated | RED: MS 2/7 new tests (then 10 WebMvcTests needed a repo mock), compile error for N7; BFF 8 fail; admin 2 fail. GREEN: `mvn test` 631/631; BFF 316/316, tsc ok; admin 432/432 + build; `make e2e` 61/61 | (this commit) |
| 2026-10-10 | N8 | MS+BFF+admin delegated | RED: MS compile error, admin 4 fail, BFF DTO 2/7 fail. GREEN: `mvn test` 613/613; BFF 308/308, tsc ok; admin 427/427 + build; `make e2e` 53/53 (after e2e cleanup fix) | (this commit) |
| 2026-10-10 | e2e fix | inline | D1/D2 e2e left APROBADA orgs (rechazar needs PENDIENTE) → referente3 hit the 3-org cap. `retireOrg` lowers to N0 then rejects; `retireLeftoverOrgs` heals old runs. `make e2e` 53/53 twice in a row | (separate commit) |
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
