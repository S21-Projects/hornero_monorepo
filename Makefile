.PHONY: up down up-local seed backup restore-check migrate e2e coverage mapa-datos mapa-fixture importar-renacom importar-poblacion mapa-radios

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

## Map data
# Regenerate the map data from the Censo 2022 radios parquet (cached, downloaded once):
#   go_algorithms_worker/data/{poblacion-radios,renacom-radio-2022,vulnerabilidad-radios}.csv
#   ts_hornero_astro/public/mapa/departamentos.geojson
# MAPA_ORGS = local JSON file or http(s):// URL of GET /organizaciones/mapa (default: the committed
# ReNaCoM fixture). Pointing it at a real BFF is an explicit operator decision, e.g.
#   MAPA_ORGS=http://localhost:3001/organizaciones/mapa make mapa-datos
# Needs the duckdb CLI. See scripts/mapa/README.md.
mapa-datos:
	@command -v duckdb >/dev/null || { echo "duckdb not found: install it (e.g. 'brew install duckdb')" >&2; exit 1; }
	scripts/mapa/fetch.sh
	duckdb < scripts/mapa/build.sql
	scripts/mapa/orgs.sh
	mkdir -p ts_hornero_astro/public/mapa
	duckdb < scripts/mapa/vulnerabilidad.sql

# Regenerate the committed ReNaCoM-only stand-in for /organizaciones/mapa from renacom.csv.
mapa-fixture:
	@command -v duckdb >/dev/null || { echo "duckdb not found: install it (e.g. 'brew install duckdb')" >&2; exit 1; }
	duckdb < scripts/mapa/fixture.sql

# Load the ReNaCoM comedores/merenderos into the DB as unclaimed organizaciones
# (estado SIN_RECLAMAR, origen RENACOM). Needs V007 applied first (`make migrate`) and
# renacom-radio-2022.csv (`make mapa-datos`). Backs up first; idempotent (a re-run inserts 0 rows).
# Local stack: make importar-renacom ENV_FILE=.env.local. See scripts/mapa/README.md.
importar-renacom: backup
	@command -v duckdb >/dev/null || { echo "duckdb not found: install it (e.g. 'brew install duckdb')" >&2; exit 1; }
	mkdir -p scripts/mapa/out
	duckdb < scripts/mapa/importar-renacom.sql
	$(PSQL) < scripts/mapa/out/importar-renacom.sql

# Reload poblacion_radio (population per census radio, the denominator of the live ronda
# vulnerability) from go_algorithms_worker/data/poblacion-radios.csv. Needs V011 applied first
# (`make migrate`). Backs up first; idempotent (truncate and reload in one transaction).
# Local stack: make importar-poblacion ENV_FILE=.env.local. See scripts/mapa/README.md.
importar-poblacion: backup
	scripts/mapa/importar-poblacion.sh | $(PSQL)

# Regenerate go_algorithms_worker/data/radios-2022.ndjson.gz, the simplified census radio polygons
# behind the worker's POST /v1/radio (reuses the cached radios parquet of `make mapa-datos`).
# Committed; regenerate only for a new census vintage or a different simplification tolerance.
# Needs the duckdb CLI. See scripts/mapa/README.md.
mapa-radios:
	@command -v duckdb >/dev/null || { echo "duckdb not found: install it (e.g. 'brew install duckdb')" >&2; exit 1; }
	scripts/mapa/fetch.sh
	duckdb < scripts/mapa/radios.sql
	@ls -l go_algorithms_worker/data/radios-2022.ndjson.gz
