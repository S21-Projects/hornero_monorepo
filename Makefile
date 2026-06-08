.PHONY: up down dev dev-ms dev-bff dev-app seed

## Docker targets

# Build images and start all services
up:
	docker compose up --build

# Stop and remove containers (keeps volumes)
down:
	docker compose down

## Local dev targets (run each in its own terminal)

# Start all local dev servers sequentially (for quick one-liner; prefer 3 terminals)
dev: dev-ms dev-bff dev-app

dev-ms:
	cd jar_hornero_ms && mvn spring-boot:run

dev-bff:
	cd ts_hornero_bff && npm install && npm run start:dev

dev-app:
	cd ts_hornero_app && npm install && npm run dev

## Seed target — registers referentes, creates orgs, and validates them as admin
# Requires: make dev (or equivalent stack running at BFF_URL, default http://localhost:3001)
# Config: BFF_URL=http://... SEED_COUNT=3 (max 5)
seed:
	cd ts_hornero_app && npx tsx ../scripts/seed.ts
