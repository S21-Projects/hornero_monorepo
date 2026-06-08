.PHONY: up down dev dev-ms dev-bff dev-app seed

# Load .env if it exists; fall back silently so targets still run without it
-include .env
export

## Docker targets

up:
	docker compose up --build

down:
	docker compose down

## Local dev targets (run each in its own terminal)

dev: dev-ms dev-bff dev-app

dev-ms:
	cd jar_hornero_ms && mvn spring-boot:run

dev-bff:
	cd ts_hornero_bff && npm install && npm run start:dev

dev-app:
	cd ts_hornero_app && npm install && npm run dev

## Seed
seed:
	cd ts_hornero_app && npx tsx ../scripts/seed.ts
