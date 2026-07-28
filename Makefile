.PHONY: up down up-local seed

## Docker only — two modes, both full-stack including Postgres.
## The Pi runs docker compose directly, not through this Makefile
## (see docs/deploy-rpi-cloudflare.md).

# Prod-parity: uses root .env as-is (whatever bucket/DB it points to).
up:
	docker compose up --build

down:
	docker compose --profile minio down

# Fast local: local Postgres + local MinIO bucket instead of R2, dummy
# secrets. Never touches the real production bucket.
up-local:
	docker compose --env-file .env.local --profile minio up --build

## Seed
seed:
	cd ts_hornero_bff && npx tsx ../scripts/seed.ts
