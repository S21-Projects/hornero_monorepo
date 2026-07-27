.PHONY: up down dev dev-ms dev-bff dev-astro dev-admin dev-app \
        postgres-up postgres-down \
        dev-ms-local dev-bff-local dev-astro-local dev-admin-local \
        dev-ms-desa  dev-bff-desa  dev-astro-desa  dev-admin-desa \
        start-local start-desa \
        seed

# Default env file — override with: make <target> ENV_FILE=.env.local
ENV_FILE ?= .env
-include $(ENV_FILE)

# Dev-server ports (override in the env file)
ASTRO_PORT ?= 4321
ADMIN_PORT ?= 5173

export

## Docker targets

up:
	docker compose up --build

down:
	docker compose down

## Local Postgres only (for make dev-*-local)

postgres-up:
	docker compose up postgres -d

postgres-down:
	docker compose stop postgres

## Local dev — generic (run each in its own terminal)

dev: dev-ms dev-bff dev-astro dev-admin

dev-ms:
	cd jar_hornero_ms && mvn spring-boot:run

dev-bff:
	cd ts_hornero_bff && npm install && npm run start:dev

dev-astro:
	cd ts_hornero_astro && npm install && npm run dev -- --port $(ASTRO_PORT)

dev-admin:
	cd ts_hornero_admin && npm install && npm run dev -- --port $(ADMIN_PORT)

# Legacy Next.js front — superseded by dev-astro + dev-admin
dev-app:
	cd ts_hornero_app && npm install && PORT=$(APP_PORT) npm run dev

## Local dev — local Postgres via Docker (.env.local)

dev-ms-local:
	$(MAKE) postgres-up
	$(MAKE) dev-ms ENV_FILE=.env.local

dev-bff-local:
	$(MAKE) dev-bff ENV_FILE=.env.local

dev-astro-local:
	$(MAKE) dev-astro ENV_FILE=.env.local

dev-admin-local:
	$(MAKE) dev-admin ENV_FILE=.env.local

## Local dev — Railway DB (.env.desa)

dev-ms-desa:
	$(MAKE) dev-ms ENV_FILE=.env.desa

dev-bff-desa:
	$(MAKE) dev-bff ENV_FILE=.env.desa

dev-astro-desa:
	$(MAKE) dev-astro ENV_FILE=.env.desa

dev-admin-desa:
	$(MAKE) dev-admin ENV_FILE=.env.desa

## One-command start (all services via concurrently)

start-local: postgres-up
	npx --yes concurrently \
	  --names "MS,BFF,ASTRO,ADMIN" \
	  --prefix-colors "blue,yellow,green,magenta" \
	  "$(MAKE) dev-ms ENV_FILE=.env.local" \
	  "$(MAKE) dev-bff ENV_FILE=.env.local" \
	  "$(MAKE) dev-astro ENV_FILE=.env.local" \
	  "$(MAKE) dev-admin ENV_FILE=.env.local"

start-desa:
	npx --yes concurrently \
	  --names "MS,BFF,ASTRO,ADMIN" \
	  --prefix-colors "blue,yellow,green,magenta" \
	  "$(MAKE) dev-ms ENV_FILE=.env.desa" \
	  "$(MAKE) dev-bff ENV_FILE=.env.desa" \
	  "$(MAKE) dev-astro ENV_FILE=.env.desa" \
	  "$(MAKE) dev-admin ENV_FILE=.env.desa"

## Seed
seed:
	cd ts_hornero_app && npx tsx ../scripts/seed.ts
