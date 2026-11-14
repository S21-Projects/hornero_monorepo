# Mapa de vulnerabilidad en la Raspberry Pi

Guía para dejar producción (Pi + Cloudflare Tunnel) con los datos del ReNaCoM y del Censo 2022
cargados, de modo que `/mapa` muestre información. Complementa `docs/deploy-rpi-cloudflare.md`
(se asume hecha la Parte A hasta A.4) y `scripts/mapa/README.md` (detalle del pipeline).

## Qué viene ya en el repo y qué hay que cargar

| Dato | Dónde vive | Cómo llega a producción |
| --- | --- | --- |
| Coropletas por departamento (`departamentos.geojson`) | `ts_hornero_astro/public/mapa/`, versionado | Se copia al build de Astro (`docker compose up --build`) |
| Polígonos de radios censales (`radios-2022.ndjson.gz`) | `go_algorithms_worker/data/`, versionado | Horneado en la imagen del worker |
| Comedores del ReNaCoM como organizaciones `SIN_RECLAMAR` | Tabla `organizaciones` | **`make importar-renacom`** (una vez) |
| Población por radio censal | Tabla `poblacion_radio` | **`make importar-poblacion`** (una vez) |

El mapa público dibuja los puntos y conteos en vivo desde `GET /organizaciones/mapa` (organizaciones
`APROBADA` o `SIN_RECLAMAR` con coordenadas). Sin `importar-renacom` las coropletas se ven, pero no
hay comedores en el mapa. Sin `importar-poblacion`, las rondas calculan el déficit como `NEUTRAL`.

No hace falta correr `make mapa-datos` ni `make mapa-radios` en la Pi: sus salidas están versionadas,
descargan un parquet de ~65 MB y hacen operaciones espaciales pesadas sobre 66.502 radios.

## Requisitos en la Pi

- Stack levantado (`docker compose up --build -d`, A.4 del runbook) y `postgres` sano.
- El código a desplegar ya mergeado en la rama que corre la Pi (`git pull`).
- CLI de `duckdb` en el host, solo para `importar-renacom`. Tiene build linux-arm64; la extensión
  `spatial` se descarga sola en la primera corrida (requiere internet). **No verificado en la Pi.**
  Si no se puede instalar, ver la alternativa del paso 3.

```bash
# Instalar duckdb (arm64) en la Pi
curl -fsSL https://install.duckdb.org | sh
# o bajar el zip linux-arm64 desde https://duckdb.org/docs/installation y dejar el binario en el PATH
duckdb --version
```

## Pasos

Todos se corren desde la raíz del repo en la Pi. Cada target `make` de base de datos hace antes un
backup (`make backup`, a `backups/`) y usa el `.env` raíz por defecto.

1. **Actualizar el código y levantar.**

   ```bash
   cd ~/hornero_app
   git pull
   docker compose up --build -d
   docker compose ps          # postgres, ms, bff, astro, admin, worker en healthy/running
   ```

2. **Aplicar el esquema.** Crea la columna `origen` de organizaciones (V007) y la tabla
   `poblacion_radio` (V011), entre otros. Idempotente.

   ```bash
   make migrate
   docker compose restart ms  # para que el chequeo de esquema del arranque vea los cambios
   ```

3. **Cargar los comedores del ReNaCoM.** Idempotente: una segunda corrida inserta 0 filas.

   ```bash
   make importar-renacom
   ```

   Alternativa sin duckdb en la Pi: generar el SQL en la laptop y aplicarlo a mano (esto se saltea
   el backup automático, así que hacelo antes).

   ```bash
   # laptop
   mkdir -p scripts/mapa/out && duckdb < scripts/mapa/importar-renacom.sql
   scp scripts/mapa/out/importar-renacom.sql pi@<pi>:~/hornero_app/scripts/mapa/out/
   # Pi
   make backup
   docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' \
     < scripts/mapa/out/importar-renacom.sql
   ```

4. **Cargar la población por radio.** Solo usa `psql` dentro del contenedor.

   ```bash
   make importar-poblacion
   ```

5. **Esperar la caché.** El MS cachea `/organizaciones/mapa` 300 s; los comedores nuevos aparecen
   en hasta 5 minutos (o reiniciar `ms`).

## Verificar

```bash
# Filas cargadas
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "select estado, count(*) from organizaciones group by estado;"'      # SIN_RECLAMAR > 0
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "select count(*), sum(habitantes) from poblacion_radio;"'            # > 0

# API y página
curl -s http://localhost:3001/organizaciones/mapa | head -c 300        # lista con comedores
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4321/mapa   # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4321/mapa/departamentos.geojson  # 200
```

Después, en el navegador: `https://elhornero.org/mapa` muestra las coropletas, los comedores y el
detalle al elegir un departamento.

## Opcional: recalcular las coropletas con datos reales

El `departamentos.geojson` versionado se calculó con el fixture del ReNaCoM. Para que refleje las
organizaciones y necesidades reales de producción, en la laptop (con duckdb):

```bash
MAPA_ORGS=https://<bff-de-produccion>/organizaciones/mapa make mapa-datos
git add ts_hornero_astro/public/mapa/departamentos.geojson go_algorithms_worker/data/*.csv
git commit -m "chore(mapa): refresh vulnerability map data"
```

Y en la Pi: `git pull && docker compose up --build -d astro`. Apuntar `MAPA_ORGS` a producción es
una decisión explícita del operador (ver `docs/mapa-vulnerabilidad.md`).

## Problemas comunes

- `duckdb not found`: falta el CLI en el host (ver Requisitos) o usar la alternativa del paso 3.
- `relation "poblacion_radio" does not exist` o error de columna `origen`: falta `make migrate`.
- El mapa no muestra comedores: revisar el conteo `SIN_RECLAMAR`, esperar la caché de 5 minutos y
  confirmar que `PUBLIC_BFF_URL` del build de Astro apunta al BFF público (se hornea en el build).
