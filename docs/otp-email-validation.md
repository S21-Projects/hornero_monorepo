# Email Verification via OTP — Shipped Design

> This document replaces an earlier plan (SMTP + `activo` gating + Next.js
> frontend) that was never implemented. What actually shipped is described
> below; it targets `ts_hornero_admin` (not the deprecated `ts_hornero_app`)
> and uses `emailVerificado` as a new, independent field — it does **not**
> touch `activo`, and registration keeps issuing tokens immediately
> (soft gate, not a blocking gate).

## Summary

New Usuario rows start with `emailVerificado = false`. Registration issues a
6-digit OTP (BCrypt-hashed, 15-min TTL) via Resend and still returns tokens
immediately — the session is never blocked on verification. `emailVerificado`
becomes `true` once the user submits the correct code via
`POST /api/auth/verify-otp`. Two endpoints in the MS gate content-producing
writes (`POST /api/necesidades`, `POST /api/donaciones`) on the DB value of
`emailVerificado`, never the JWT claim (which can be stale for up to 15
minutes).

Pre-existing Usuario rows are grandfathered to `emailVerificado = true` via a
DDL column default (`boolean not null default true`) — no blocking migration,
compatible with `spring.jpa.hibernate.ddl-auto=update`.

## Architecture

```
register ─→ AuthService.register ─→ save Usuario(emailVerificado=false)
                  │                        │
                  │                        └─→ OtpService.issue(email)
                  │                              ├ 6 digits (SecureRandom)
                  │                              ├ BCrypt hash → codigos_verificacion
                  │                              └ ResendClient.send(RestClient POST)
                  └─→ tokens issued anyway (soft gate — session not blocked)

POST /verify-otp {email, codigo} ─→ throttle ─→ BCrypt.matches ─→ emailVerificado=true
                                                 └─ fresh tokens + updated claim returned directly

POST /necesidades / POST /donaciones ─→ VerificacionService.requireVerified(userId)
                                          └─ reads the DB, throws 403 EMAIL_NO_VERIFICADO
```

## Endpoints

```
POST /api/auth/verify-otp  {email, codigo} → 200 {accessToken, refreshToken, user}
                                            | 400 CODIGO_INVALIDO
                                            | 410 CODIGO_EXPIRADO
                                            | 429 DEMASIADOS_INTENTOS
POST /api/auth/resend-otp  {email}         → 204 | 429 ESPERA_ANTES_DE_REENVIAR
```

Both live under `/api/auth/**`, already `permitAll` in `SecurityConfig` — no
security-matcher change needed, the gate is a business rule on an
already-authenticated write, not a URL pattern. `resend-otp` always returns
204 regardless of whether the email exists (no enumeration oracle).

## Rate limiting

In-memory (`OtpThrottle`), keyed by normalized email: max 3 resends per 15
minutes, 60-second cooldown between requests, swept periodically via
`@Scheduled`. Per-IP keying was rejected — every request arrives from the BFF
container, so `getRemoteAddr()` is constant at the MS; per-IP would require
the BFF forwarding `X-Forwarded-For` and the MS trusting it (deferred to a
future version).

## Mail transport

`ResendClient` uses Spring's `RestClient` (already available via
`spring-boot-starter-web`, no new dependency) to POST to the Resend API.
`MailerConfig` fails startup when `RESEND_API_KEY` / `OTP_FROM_EMAIL` are absent,
unless `MAIL_LOG_ONLY=true` explicitly opts into a log-only mailer (local dev), mirroring the pattern in
`ts_hornero_astro/src/lib/mailer.ts`. `OTP_FROM_EMAIL` is a dedicated env var,
distinct from `CONTACTO_FROM_EMAIL` used by the contact form.

## Three-layer enforcement (per CLAUDE.md)

| Layer | Change |
|---|---|
| MS `SecurityConfig` | None — new routes fall under existing `/api/auth/**` permitAll |
| BFF `RolesGuard`/`JwtStrategy` | `JwtStrategy.validate()` forwards `emailVerificado`; two new `@Public()` proxy routes |
| SPA `ProtectedRoute` | New `requireVerified` prop, checked **before** `requireValidated` |

## SPA gate ordering

`ProtectedRoute` evaluates, in order: role matrix → `requireVerified` (→
`/verify-email`) → `requireValidated` for REFERENTE (→ `/pending-validation`).
The two gates are independent and never merged — `emailVerificado` comes from
`GET /auth/me`, org validation from `GET /organizaciones/mia`.

`requireVerified` is applied to REFERENTE and ADMINISTRADOR route groups.
It is intentionally **not** applied to Donante-only routes or the shared
`/prefs` route: the Donante-facing "must verify" UX is out of scope pending
explicit user sign-off (see Open Items below). The MS-side 403 gate on
`POST /api/donaciones` is live regardless.

## Open items / deferred work

- **Donante-facing verification UX** (blocking donation submission in the
  SPA) is deferred. The MS already rejects `POST /api/donaciones` with 403
  `EMAIL_NO_VERIFICADO` for unverified donantes — that enforcement is live —
  but no SPA screen/messaging was built for it. Needs product sign-off on
  placement/component before implementing.
- Per-IP throttling (currently email-only keying).
- `docker-compose.yml` env wiring for `RESEND_API_KEY`/`OTP_FROM_EMAIL`, and
  documenting both vars in `.env.example`/`.env.local.example`, were not
  completed in this batch (local sandbox permissions blocked touching those
  files) — must be done by whoever merges this before deploying, or the
  mailer silently falls back to log-only in every environment.
