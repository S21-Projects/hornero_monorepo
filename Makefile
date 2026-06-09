.PHONY: up down dev dev-ms dev-bff dev-app \
        postgres-up postgres-down \
        dev-ms-local dev-bff-local dev-app-local \
        dev-ms-desa  dev-bff-desa  dev-app-desa  \
        start-local start-desa \
        seed

# Default env file — override with: make <target> ENV_FILE=.env.local
ENV_FILE ?= .env
-include $(ENV_FILE)
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

dev: dev-ms dev-bff dev-app

dev-ms:
	cd jar_hornero_ms && mvn spring-boot:run

dev-bff:
	cd ts_hornero_bff && npm install && npm run start:dev

dev-app:
	cd ts_hornero_app && npm install && npm run dev

## Local dev — local Postgres via Docker (.env.local)

dev-ms-local:
	$(MAKE) postgres-up
	$(MAKE) dev-ms ENV_FILE=.env.local

dev-bff-local:
	$(MAKE) dev-bff ENV_FILE=.env.local

dev-app-local:
	$(MAKE) dev-app ENV_FILE=.env.local

## Local dev — Railway DB (.env.desa)

dev-ms-desa:
	$(MAKE) dev-ms ENV_FILE=.env.desa

dev-bff-desa:
	$(MAKE) dev-bff ENV_FILE=.env.desa

dev-app-desa:
	$(MAKE) dev-app ENV_FILE=.env.desa

## One-command start (all services via concurrently)

start-local: postgres-up
	npx --yes concurrently \
	  --names "MS,BFF,APP" \
	  --prefix-colors "blue,yellow,green" \
	  "$(MAKE) dev-ms ENV_FILE=.env.local" \
	  "$(MAKE) dev-bff ENV_FILE=.env.local" \
	  "$(MAKE) dev-app ENV_FILE=.env.local"

start-desa:
	npx --yes concurrently \
	  --names "MS,BFF,APP" \
	  --prefix-colors "blue,yellow,green" \
	  "$(MAKE) dev-ms ENV_FILE=.env.desa" \
	  "$(MAKE) dev-bff ENV_FILE=.env.desa" \
	  "$(MAKE) dev-app ENV_FILE=.env.desa"

## Seed
seed:
	cd ts_hornero_app && npx tsx ../scripts/seed.ts
