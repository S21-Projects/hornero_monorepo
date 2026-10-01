.PHONY: up down up-local seed backup migrate

## Docker only — two modes, both full-stack including Postgres.
## The Pi runs docker compose directly, not through this Makefile
## (see docs/deploy-rpi-cloudflare.md).

# Compose invocation for the DB helpers below. Defaults to the prod-parity
# root .env; use `make migrate ENV_FILE=.env.local` against the local stack.
ENV_FILE ?= .env
COMPOSE = docker compose --env-file $(ENV_FILE)
PSQL = $(COMPOSE) exec -T postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -v ON_ERROR_STOP=1'

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

## Database
# Gzipped pg_dump of the running postgres container into backups/.
backup:
	@mkdir -p backups
	$(COMPOSE) exec -T postgres sh -c 'pg_dump -U "$$POSTGRES_USER" "$$POSTGRES_DB"' \
		| gzip > backups/hornero_$$(date +%Y%m%d_%H%M%S).sql.gz
	@ls -1t backups | head -1

# Backup first, then apply every scripts/sql/V*.sql in order. Each script is
# idempotent (see scripts/sql/README.md), so re-running is safe. Restart the
# ms container afterwards so its startup schema check sees the new schema.
migrate: backup
	@for f in $$(ls scripts/sql/V*.sql | sort); do \
		echo "applying $$f"; \
		$(PSQL) < $$f || exit 1; \
	done
