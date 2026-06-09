# Hornero — Setup & Deploy Guide

> **Note:** This project started as a polyrepo (each service had its own git repository).
> It was consolidated into this monorepo on 2026-06-08.
> The individual git histories were not migrated — only the source code was carried over.

Hornero is a monorepo composed of three services:

| Service | Stack | Port |
|---------|-------|------|
| `jar_hornero_ms` | Spring Boot 3.2.5 / Java 17 | 8081 |
| `ts_hornero_bff` | NestJS 11 / Node 20 | 3001 |
| `ts_hornero_app` | Next.js 16 / React 19 | 3000 |

---

## Architecture

```
Browser
  │
  ▼
ts_hornero_app  :3000   (Next.js frontend)
  │  NEXT_PUBLIC_BFF_URL
  ▼
ts_hornero_bff  :3001   (NestJS BFF — aggregates, auth proxy)
  │  JAVA_MS_URL
  ▼
jar_hornero_ms  :8081   (Spring Boot — domain logic, JWT issuer)
  │
  ▼
PostgreSQL      :5432
```

---

## Seeded Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hornero.ar | Admin123! |
| Referente | referente@hornero.ar | Ref123! |
| Donante | donante@hornero.ar | Don123! |

---

## Local Dev

Three modes available. All use the root `.env.*` file loaded automatically by the Makefile.

### Mode 1 — Docker Compose (full stack)

Everything runs in containers including Postgres. No local Java or Node required.

**Prerequisites:** Docker 24+ with Compose V2

```bash
cp .env.example .env
# Edit .env: set a real JWT_SECRET (min 32 random chars)

make up
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| BFF | http://localhost:3001 |
| BFF Swagger | http://localhost:3001/api/docs |
| MS | http://localhost:8081 |
| MS Swagger | http://localhost:8081/swagger-ui.html |

```bash
make down        # stop
make down -v     # stop + delete DB volume
```

---

### Mode 2 — Local processes + local Postgres

Services run on your machine; only Postgres runs in Docker.

**Prerequisites:** Java 17, Maven, Node 20, Docker

```bash
cp .env.local.example .env.local
# Edit .env.local: set a real JWT_SECRET

# One command (color-coded output, Ctrl+C kills all)
make start-local

# Or three terminals if you prefer
make dev-ms-local   # terminal 1 — also starts Postgres
make dev-bff-local  # terminal 2
make dev-app-local  # terminal 3
```

---

### Mode 3 — Local processes + Railway DB

Services run on your machine; DB is the deployed Railway instance.

**Prerequisites:** Java 17, Maven, Node 20

```bash
cp .env.desa.example .env.desa
# Fill in the DB_* vars from: Railway → your project → Postgres service → Variables

# One command
make start-desa

# Or three terminals
make dev-ms-desa
make dev-bff-desa
make dev-app-desa
```

---

## Environment Variables Reference

| Variable | Used by | Description |
|----------|---------|-------------|
| `JWT_SECRET` | MS + BFF | HS256 signing secret — must match in both services (min 32 chars) |
| `SERVER_PORT` | MS | HTTP port (default 8081) |
| `PORT` | BFF | HTTP port (default 3001) |
| `JAVA_MS_URL` | BFF | Internal URL of the MS |
| `FRONTEND_URL` | BFF | Allowed CORS origin |
| `NEXT_PUBLIC_BFF_URL` | App | BFF base URL — baked into the bundle at build time |
| `DB_HOST` | MS | Postgres host (`localhost` for local, `postgres` in Docker, Railway host in prod) |
| `DB_PORT` | MS | Postgres port (default 5432) |
| `DB_NAME` | MS | Database name |
| `DB_USERNAME` | MS | Database user |
| `DB_PASSWORD` | MS | Database password |
| `POSTGRES_DB/USER/PASSWORD` | Docker only | Used by the `postgres` Docker service |

Env file templates: `.env.example`, `.env.local.example`, `.env.desa.example`

---

## Deploy on Railway

Railway runs each service as an independent deployment within a project, using the `Dockerfile` in each service directory.

### 1. Create the project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select `hornero_monorepo`

### 2. Add PostgreSQL

Inside the project: **New** → **Database** → **PostgreSQL**

Railway provisions a managed Postgres instance and exposes these variables (available to reference from other services):
`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

### 3. Deploy each service

For each of the three services, click **New** → **GitHub Repo** → select `hornero_monorepo`, then in the service settings:

| Setting | MS | BFF | App |
|---------|----|-----|-----|
| **Root Directory** | `jar_hornero_ms` | `ts_hornero_bff` | `ts_hornero_app` |
| **Builder** | Dockerfile | Dockerfile | Dockerfile |

### 4. Set environment variables

Railway lets you reference another service's variables with `${{ServiceName.VAR}}`.

**MS service (`jar_hornero_ms`):**
```
JWT_SECRET=<your-secret>
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
```

**BFF service (`ts_hornero_bff`):**
```
JWT_SECRET=<same-secret-as-MS>
JAVA_MS_URL=http://<ms-private-domain>
FRONTEND_URL=https://<app-public-domain>
```

**App service (`ts_hornero_app`):**
```
NEXT_PUBLIC_BFF_URL=https://<bff-public-domain>
```

> **Private vs public domains**: for `JAVA_MS_URL` use the Railway private domain (Settings → Networking → Private Domain) so traffic stays internal and free. For `FRONTEND_URL` and `NEXT_PUBLIC_BFF_URL` use the public domains.

### 5. Deploy order

Deploy in this order to avoid startup failures:

1. **Postgres** (already running after step 2)
2. **MS** — needs Postgres
3. **BFF** — needs MS
4. **App** — needs BFF URL at build time (`NEXT_PUBLIC_BFF_URL` is baked in)
