# Hornero — Setup & Deploy Guide

> **Note:** This project started as a polyrepo (each service had its own git repository).
> It was consolidated into this monorepo on 2026-06-08.
> The individual git histories were not migrated — only the source code was carried over.

Hornero is a monorepo composed of five services:

| Service | Stack | Port |
|---------|-------|------|
| `jar_hornero_ms` | Spring Boot 3.2.5 / Java 17 | 8081 |
| `ts_hornero_bff` | NestJS 11 / Node 20 | 3001 |
| `ts_hornero_astro` | Astro (SSR) — public site | 4321 |
| `ts_hornero_admin` | React/Vite SPA — panel for all authenticated roles | 5173 |
| `postgres` | PostgreSQL 16 | 5432 |

> `ts_hornero_app` (the original Next.js frontend) is deprecated, superseded by
> `ts_hornero_astro` + `ts_hornero_admin`. It is no longer referenced by the
> Makefile or docker-compose, but the code is still in the repo for now.

---

## Architecture

```
Browser
  │
  ├──► ts_hornero_astro  :4321   (public site — Astro SSR)
  │
  ├──► ts_hornero_admin  :5173   (admin/referente/donante panel — React/Vite SPA)
  │
  ▼
ts_hornero_bff  :3001   (NestJS BFF — auth proxy + aggregation)
  │
  ▼
jar_hornero_ms  :8081   (Spring Boot — domain logic, JWT issuer)
  │
  ▼
PostgreSQL      :5432
```

Images (org banners/profile pictures) are stored in an S3-compatible bucket
(Cloudflare R2 in production) — the BFF reads/writes it server-side, the
browser never touches it directly. See `.env.example` for the `AWS_*` vars.

---

## Seeded Credentials

Demo accounts exist **only with `SEED_DEMO_DATA=true`** — which `make up-local` sets for you, so
the local stack and e2e keep them. Production (`make up` / the Pi) creates no demo data.

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hornero.ar | Admin123! |
| Referente | referente@hornero.ar | Ref123! |
| Donante | donante@hornero.ar | Don123! |

Production needs a real super admin: set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`
(no defaults — the MS refuses to start without both). The password must follow the NIST
SP 800-63B policy (15–64 characters, not common, no email/name/"hornero"). An existing admin with
that email is never modified. See `docs/deploy-rpi-cloudflare.md` (A.4-ter) for retiring the
legacy `@hornero.ar` demo accounts.

To test real flows with real emails, use Gmail plus-addressing
(`usuario+donante@gmail.com`, `usuario+referente@gmail.com`) — all land in one inbox. Local and
e2e keep `MAIL_LOG_ONLY=true` (no mail is sent).

---

## Local Dev

Docker only — no local Java or Node required. Two modes, both full-stack
including Postgres:

### `make up` — prod-parity

Uses the root `.env` as-is. Whatever bucket/DB it points to is what you get —
use this to test against the real thing before deploying.

**Prerequisites:** Docker 24+ with Compose V2

```bash
cp .env.example .env
# Edit .env: set a real JWT_SECRET (min 32 random chars) — see below

make up
```

| Service | URL |
|---------|-----|
| Astro (public site) | http://localhost:4321 |
| Admin panel | http://localhost:5173 |
| BFF | http://localhost:3001 |
| BFF Swagger | http://localhost:3001/api/docs |
| MS | http://localhost:8081 |
| MS Swagger | http://localhost:8081/swagger-ui.html |

```bash
make down        # stop
docker compose down -v   # stop + delete DB volume
```

### `make up-local` — fast local, no real bucket

Same stack, but with dummy secrets and a local MinIO container instead of R2 —
never touches the real production bucket. Good for quick mockups/UI work.

```bash
cp .env.example .env.local
# In .env.local: set MAIL_LOG_ONLY=true (never send real email from local) and
# empty the AWS_* lines (the stack falls back to the local MinIO bucket).
# `make up-local` turns on SEED_DEMO_DATA, so SUPER_ADMIN_* can stay empty.

make up-local
```

---

## Environment Variables Reference

One root `.env` file is shared by every service in `docker-compose.yml`. Full
reference with comments: `.env.example`.

| Variable | Used by | Description |
|----------|---------|-------------|
| `JWT_SECRET` | MS + BFF | HS256 signing secret — must match in both services (min 32 chars) |
| `RESEND_API_KEY`, `OTP_FROM_EMAIL` | MS | OTP email delivery (Resend). Missing either → MS fails at startup unless `MAIL_LOG_ONLY=true` |
| `MAIL_LOG_ONLY` | MS | `true` logs OTP codes instead of sending (local dev only; default `false`) |
| `SEED_DEMO_DATA` | MS | `true` seeds demo users/orgs/necesidades/donaciones (set by `make up-local`; default `false`) |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | MS | Required (no defaults) unless `SEED_DEMO_DATA=true`. Password: NIST policy, ≥15 chars |
| `SERVER_PORT` | MS | HTTP port (default 8081) |
| `FRONTEND_URL` | BFF | Primary allowed CORS origin |
| `CORS_ORIGINS` | BFF | Full CORS allowlist — every browser origin calling the BFF with credentials |
| `NODE_ENV` | BFF, Astro | `production` sets `sameSite=none; secure` auth cookies (requires HTTPS) |
| `PUBLIC_BFF_URL` | Astro (build arg) | BFF URL baked into the SSR bundle — rebuild required to change |
| `PUBLIC_SPA_URL` | Astro (build arg) | Admin panel URL baked into the SSR bundle |
| `VITE_BFF_URL` | Admin (build arg) | BFF URL baked into the SPA bundle |
| `RESEND_API_KEY`, `CONTACTO_FROM_EMAIL`, `CONTACTO_TO_EMAIL` | Astro | Contact form mail delivery (Resend). Missing any → logged, not sent |
| `TURNSTILE_SECRET` | Astro | Server-side half of the contact form's bot check. Empty → gate is inert |
| `AWS_ENDPOINT_URL`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION` | BFF | S3-compatible bucket for images (Cloudflare R2 in prod) |
| `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | MS, Postgres | Database credentials (`DB_HOST`/`DB_PORT` are hardcoded to `postgres:5432` in Docker) |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Docker `postgres` service | Must match `DB_NAME`/`DB_USERNAME`/`DB_PASSWORD` |

Env file template: `.env.example`. Copy it to `.env` (prod-parity, `make up`) or to `.env.local`
(fast local, `make up-local`; see above).

---

## Deploy

Production runs on a Raspberry Pi behind a Cloudflare Tunnel — full runbook,
including the R2 bucket decision tree and backup guidance, in
[`docs/deploy-rpi-cloudflare.md`](docs/deploy-rpi-cloudflare.md).

Railway is no longer used for hosting.
