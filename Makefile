.PHONY: up down up-local seed backup restore-check migrate e2e coverage

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
# secrets. Never touches the real production bucket. SEED_DEMO_DATA=true (shell env wins over
# --env-file) keeps the demo accounts/orgs/necesidades local without editing .env.local.
up-local:
	SEED_DEMO_DATA=true docker compose --env-file .env.local --profile minio up --build

## End-to-end (API level) — needs the stack already running: `make up-local` in another terminal.
e2e:
	cd e2e && npm install --no-audit --no-fund && npm test

## Coverage (report-only, no thresholds; outputs are gitignored). Runs each service's unit
## suite with coverage and prints one line-coverage summary per service. See docs/validacion-calidad.md.
coverage:
	cd jar_hornero_ms && mvn -q test -Pcoverage
	cd ts_hornero_bff && npx jest --coverage --coverageReporters=text-summary --coverageReporters=json-summary --coverageReporters=html
	cd ts_hornero_admin && npx vitest run --coverage
	cd go_algorithms_worker && go test -coverprofile=coverage.out ./...
	@echo ""
	@echo "== Line coverage summary =="
	@awk -F, 'NR>1 {m+=$$8; c+=$$9} END {printf "ms     (JaCoCo lines)       %.1f%%  (%d/%d)\n", 100*c/(m+c), c, m+c}' jar_hornero_ms/target/site/jacoco/jacoco.csv
	@node -e "const s=require('./ts_hornero_bff/coverage/coverage-summary.json').total.lines; console.log('bff    (jest lines)         '+s.pct.toFixed(1)+'%  ('+s.covered+'/'+s.total+')')"
	@node -e "const s=require('./ts_hornero_admin/coverage/coverage-summary.json').total.lines; console.log('admin  (vitest v8 lines)    '+s.pct.toFixed(1)+'%  ('+s.covered+'/'+s.total+')')"
	@cd go_algorithms_worker && go tool cover -func=coverage.out | awk '/^total:/ {printf "worker (go statements)      %s\n", $$3}'
	@echo "HTML reports: jar_hornero_ms/target/site/jacoco/index.html, ts_hornero_bff/coverage/, ts_hornero_admin/coverage/"

## Seed
seed:
	cd ts_hornero_bff && npx tsx ../scripts/seed.ts

## Database
# pg_dump (custom format) of the running postgres into backups/, verified and
# pruned by BACKUP_RETENTION_DAYS; also makes the encrypted offsite copy when
# BACKUP_S3_BUCKET is configured. Same script the systemd timer runs
# (deploy/systemd/), see docs/deploy-rpi-cloudflare.md.
backup:
	@ENV_FILE=$(ENV_FILE) scripts/backup/backup.sh

# Restore drill: restore DUMP (default: newest in backups/, .dump or .dump.enc)
# into a throwaway postgres container and sanity-check it. Never touches the
# real DB. Usage: make restore-check [DUMP=backups/hornero-....dump]
restore-check:
	@ENV_FILE=$(ENV_FILE) scripts/backup/restore-check.sh $(DUMP)

# Backup first, then apply every scripts/sql/V*.sql in order. Each script is
# idempotent (see scripts/sql/README.md), so re-running is safe. Restart the
# ms container afterwards so its startup schema check sees the new schema.
migrate: backup
	@for f in $$(ls scripts/sql/V*.sql | sort); do \
		echo "applying $$f"; \
		$(PSQL) < $$f || exit 1; \
	done
