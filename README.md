# Hornero — Local Setup Guide

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
```

---

## Seeded Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hornero.ar | Admin123! |
| Referente | referente@hornero.ar | Ref123! |
| Donante | donante@hornero.ar | Don123! |

---

## Path A — Docker Compose (recommended)

### Prerequisites
- Docker 24+ with Compose V2 (`docker compose` not `docker-compose`)

### Steps

```bash
# 1. Copy the environment template and fill in your JWT secret
cp .env.example .env
# Edit .env: set a real JWT_SECRET (at least 32 random chars)

# 2. Boot everything
docker compose up --build
```

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| BFF | http://localhost:3001 |
| BFF API docs (Swagger) | http://localhost:3001/api/docs |
| Microservice | http://localhost:8081 |
| MS Swagger UI | http://localhost:8081/swagger-ui.html |

### Stopping

```bash
docker compose down
# To also remove volumes:
docker compose down -v
```

---

## Path B — Local Dev (no Docker)

Open **three terminals**, one per service.

### Terminal 1 — Spring Boot MS

```bash
cd jar_hornero_ms

# Required environment variables
export SERVER_PORT=8081
export JWT_SECRET=change-me-use-a-long-random-secret-min-32-chars

mvn spring-boot:run
```

> The MS uses an H2 in-memory database — no external DB required.

### Terminal 2 — NestJS BFF

```bash
cd ts_hornero_bff

# Copy and fill the env file (JAVA_MS_URL, PORT, FRONTEND_URL)
cp .env.example .env

npm install
npm run start:dev
```

### Terminal 3 — Next.js Frontend

```bash
cd ts_hornero_app

# NEXT_PUBLIC_BFF_URL is baked into the bundle at build time.
# For local dev, Next.js reads it from .env.local:
echo "NEXT_PUBLIC_BFF_URL=http://localhost:3001" > .env.local

npm install
npm run dev
```

---

## Environment Variables Reference

| Variable | Service | Description | Default |
|----------|---------|-------------|---------|
| `SERVER_PORT` | MS | HTTP port | 8081 |
| `JWT_SECRET` | MS | HS256 signing secret (min 32 chars) | _required_ |
| `PORT` | BFF | HTTP port | 3001 |
| `JAVA_MS_URL` | BFF | Base URL of the MS | http://localhost:8081 |
| `FRONTEND_URL` | BFF | Allowed CORS origin | http://localhost:3000 |
| `NEXT_PUBLIC_BFF_URL` | Frontend | BFF base URL (baked at build time) | http://localhost:3001 |

See `.env.example` at the root for a ready-to-copy template.
