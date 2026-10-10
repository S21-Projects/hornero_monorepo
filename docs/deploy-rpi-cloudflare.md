# Deploy en Raspberry Pi con Cloudflare Tunnel

Runbook para levantar el stack migrado (Astro + Admin SPA + BFF + MS + Postgres)
en una Raspberry Pi, expuesto a internet mediante un Cloudflare Tunnel.

- **Rama:** `feat/spa-scaffold-auth` (contiene los tres fronts + BFF + MS).
- **Dominio:** `elhornero.org`.

## Topología

| Hostname público            | Servicio (contenedor) | Tipo                          |
| --------------------------- | --------------------- | ----------------------------- |
| `elhornero.org`             | `astro:4321`          | Astro SSR (público)           |
| `panel.elhornero.org`       | `admin:80`            | Admin SPA (nginx estático)    |
| `api.elhornero.org`         | `bff:3001`            | BFF (API)                     |
| —                           | `ms:8081`             | interno, sin exponer          |
| —                           | `postgres:5432`       | interno, sin exponer          |

`cloudflared` corre dentro de la misma red del compose, así que en el dashboard
de Cloudflare el "service" de cada hostname es el **nombre del contenedor**.

---

## Parte A — Pasos manuales (lo que NO se automatiza)

Estos pasos los hacés vos a mano: tocan el dashboard de Cloudflare, secretos, y
decisiones de infraestructura.

### A.1 — Token del túnel (Cloudflare)

1. Cloudflare **Zero Trust → Networks → Tunnels**.
2. Abrí (o creá) tu túnel → pestaña de instalación → copiá el **token**
   (la cadena larga después de `--token`). Ese valor va en `TUNNEL_TOKEN`.

### A.2 — Public Hostnames (Cloudflare)

En el túnel → pestaña **Public Hostname**, creá tres entradas:

| Subdomain | Domain          | Service (Type: HTTP) |
| --------- | --------------- | -------------------- |
| *(vacío)* | `elhornero.org` | `localhost:4321`     |
| `panel`   | `elhornero.org` | `localhost:5173`     |
| `api`     | `elhornero.org` | `localhost:3001`     |

> **El túnel corre como servicio systemd en el host, NO dentro del compose.**
> Por eso los services apuntan a `localhost:<puerto>` y no a nombres de
> contenedor: `cloudflared` no está en la red del compose, pero sí alcanza los
> puertos que el compose publica en el host. En consecuencia, **no se usa el
> profile `tunnel`** — levantar ese contenedor con el mismo token agregaría un
> segundo connector al túnel y Cloudflare repartiría el tráfico entre ambos,
> con fallos intermitentes en el que no puede resolver los nombres de servicio.

Cloudflare crea los registros DNS (CNAME al túnel) automáticamente. No hace falta
abrir ningún puerto en el router: el túnel sale desde la Pi hacia Cloudflare.

### A.3 — Archivo `.env` en la Pi

Creá `/…/hornero_app/.env` (NO se commitea) con:

```bash
# Debe ser IDÉNTICO entre MS y BFF. Mínimo 32 chars aleatorios.
JWT_SECRET=<secreto-largo-aleatorio>

# Fronts — se HORNEAN en build. Rebuild obligatorio si cambian.
PUBLIC_BFF_URL=https://api.elhornero.org
PUBLIC_SPA_URL=https://panel.elhornero.org
VITE_BFF_URL=https://api.elhornero.org

# CORS del BFF — los dos orígenes de navegador que le pegan.
CORS_ORIGINS=https://elhornero.org,https://panel.elhornero.org
FRONTEND_URL=https://elhornero.org

# Base de datos
DB_NAME=hornero
DB_USERNAME=hornero
DB_PASSWORD=<password-fuerte>
POSTGRES_DB=hornero
POSTGRES_USER=hornero
POSTGRES_PASSWORD=<mismo-password-fuerte>

# Bucket — Cloudflare R2 (elegido: la Pi solo tiene microSD, ver Parte B / Opción 2).
AWS_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_S3_BUCKET_NAME=hornero-images
AWS_ACCESS_KEY_ID=<r2-access-key>
AWS_SECRET_ACCESS_KEY=<r2-secret>
AWS_DEFAULT_REGION=auto

# Cloudflare Tunnel
TUNNEL_TOKEN=<token-de-A.1>
```

> ⚠️ `PUBLIC_BFF_URL`, `PUBLIC_SPA_URL` y `VITE_BFF_URL` se compilan dentro del
> bundle en el **build**. Si las cambiás, hay que `docker compose build` de nuevo;
> reiniciar no alcanza.

### A.3-bis — Pre-deploy: migración del esquema del pool de donaciones (slice 5b)

Antes de levantar la nueva imagen del MS con soporte para donaciones `FONDO_COMUN`
(`tesis-core-features` slice 5b), correr el script hand-written que relaja
`donaciones.necesidad_id` a nullable — ver `scripts/sql/README.md` y `docs/db-changes.md`
para el detalle completo. Es seguro correrlo antes del deploy: el código viejo nunca escribe
`NULL` en esa columna.

Con el Makefile alcanza con `make migrate`: hace el backup en `backups/` y aplica, en orden,
todos los `scripts/sql/V*.sql` (son idempotentes). A mano, lo equivalente es:

```bash
docker compose exec -T postgres pg_dump -U "$DB_USERNAME" "$DB_NAME" | gzip > backup_$(date +%F).sql.gz
docker compose exec -T postgres psql -U "$DB_USERNAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  < scripts/sql/V001__donaciones_necesidad_id_nullable.sql
docker compose exec -T postgres psql -U "$DB_USERNAME" -d "$DB_NAME" -c '\d donaciones'
```

Confirmar que `necesidad_id` figura como nullable en la salida de `\d donaciones`, y registrar
"Applied to" en `docs/db-changes.md`. Si este paso se salta, el MS sigue arrancando y las
donaciones `DIRECTA` funcionan normalmente — el `EsquemaVerificador` interno detecta la columna
todavía `NOT NULL` y hace que crear una donación `FONDO_COMUN` responda `503 ESQUEMA_PENDIENTE`
en vez de romper con un 500 de violación de constraint.

### A.3-ter — Limpieza de datos pre-catálogo (feature catalogo-articulos)

La feature `catalogo-articulos` agrega artículos (`Articulo`), líneas de donación
(`DonacionLinea`) y artículos de necesidad (`NecesidadArticulo`) al dominio. Los datos que
hoy viven en la DB de producción de la Pi son de prueba, no reales (decisión 1 del documento de
la feature), y quedaron creados **antes** de este cambio: ninguna necesidad ni donación vieja
tiene artículos/líneas asociados. Esta limpieza es **una acción manual del operador**, nunca
ejecutada por el agente — el agente sólo documenta el procedimiento.

**Esto borra toda la base** (usuarios, organizaciones, necesidades, donaciones — todo), así que
sólo corresponde hacerla mientras la Pi no tenga datos reales de usuarios/organizaciones. Si en
algún momento la Pi pasa a tener datos reales, esta opción deja de ser válida y hay que escribir
un script de migración/backfill en su lugar (similar a `scripts/sql/`), no recrear el volumen.

Pasos, a correr por SSH en la Pi, desde la carpeta del repo:

1. **Backup primero, sin excepción.**
   ```bash
   make backup
   ```
   Deja un `hornero-<fecha>.dump` en `backups/` — conservarlo hasta confirmar que el reseed
   salió bien (más sobre backups en la Parte C).

2. **Confirmar el nombre exacto del volumen de Postgres** (depende del nombre del proyecto
   compose, normalmente el nombre de la carpeta del repo en la Pi):
   ```bash
   docker volume ls | grep pgdata
   ```
   En este repo el volumen se declara como `hornero_pgdata` en `docker-compose.yml`, así que
   Docker Compose lo nombra `<nombre-del-proyecto>_hornero_pgdata` (p. ej. `hornero_app_hornero_pgdata`
   si la carpeta se llama `hornero_app`). Usar el nombre que devuelva el comando anterior, no
   adivinarlo.

3. **Bajar los contenedores y borrar el volumen** (paso destructivo — requiere confirmación
   explícita del operador antes de correrlo; no automatizar):
   ```bash
   docker compose down
   docker volume rm <nombre-exacto-del-volumen-del-paso-2>
   ```

4. **Levantar de nuevo** — Hibernate recrea el esquema (`ddl-auto=update`) y `DataInitializer`
   reseedea desde cero, ya con artículos coherentes en cada necesidad/donación seedeada:
   ```bash
   docker compose up --build -d
   ```

5. **Verificar** que el reseed incluyó artículos (`GET /api/articulos`, `GET /api/necesidades`,
   `GET /api/donaciones` deben traer artículos/líneas en cada registro), y que el sitio público
   vuelve a mostrar datos.

**Rollback**: si algo sale mal, restaurar el dump del paso 1 (`pg_restore`, ver C.5) contra el
volumen recién recreado, antes de levantar el MS. Para dumps viejos `.sql.gz`: `gunzip` + `psql`.

### A.4 — Levantar (en la Pi)

El túnel ya corre aparte como servicio systemd, así que el stack se levanta sin
profiles:

```bash
git checkout develop
# crear el .env de A.3
docker compose up --build -d
docker compose ps                          # postgres, ms, worker, bff, astro, admin healthy
systemctl status cloudflared --no-pager    # el túnel, aparte del compose
```

El servicio `worker` (motor de asignación en Go) no publica puertos: el MS lo llama por la red
interna en `http://worker:8090` (`WORKER_URL`, ya definido en `docker-compose.yml`). Si el worker
está caído, el MS arranca igual y solo `POST /api/rondas` responde 503. Para chequearlo:

```bash
docker compose exec -T worker wget -qO- http://localhost:8090/healthz   # ok
```

Opcional: con el CSV de población del INDEC, el déficit de cobertura deja de ser neutral. Montar el
archivo en el servicio `worker` y apuntar `POBLACION_CSV` a esa ruta (ver el comentario del servicio
en `docker-compose.yml`). Sin él, todas las organizaciones reciben déficit neutral.

Verificar que los tres puertos publicados responden antes de probar por el dominio:

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:4321        # astro
curl -s -o /dev/null -w '%{http_code}\n' localhost:5173        # admin
curl -s -o /dev/null -w '%{http_code}\n' localhost:3001/api/docs  # bff
```

> Con MinIO self-host en vez de R2: `docker compose --profile minio up --build -d`.

### A.4-bis — Probar en local ANTES de subir (mismo stack, sin túnel)

`docker compose up` (sin profiles) levanta EXACTAMENTE el mismo stack migrado que
la Pi, pero sin `cloudflared` ni MinIO. Los fronts se buildean con las URLs
`localhost` por defecto, así que probás todo en tu máquina:

```bash
docker compose up --build          # = make up
# Astro:  http://localhost:4321
# Admin:  http://localhost:5173
# BFF:    http://localhost:3001  (Swagger en /api/docs)
```

> Con secretos de prueba y MinIO local en vez de R2: `make up-local` (usa `.env.local`).
> Contra esa base, los scripts se aplican con `make migrate ENV_FILE=.env.local`.

### A.5 — Verificar

1. `https://elhornero.org` carga el front público (Astro).
2. `https://api.elhornero.org/api/docs` responde (Swagger del BFF).
3. `https://panel.elhornero.org` carga el login del panel.
4. Login con un usuario admin → el panel resuelve el rol (`GET /auth/me`).
5. Una organización con imagen muestra el banner (valida el bucket).

---

## Parte B — Resolver el bucket S3

### Cómo funciona hoy

El BFF (`ts_hornero_bff/src/images` y `/upload`) usa un cliente **S3-compatible**
(`@aws-sdk/client-s3`) con `forcePathStyle: true` y `region: 'auto'`. Lee estas
env vars:

| Var                     | Qué es                                   |
| ----------------------- | ---------------------------------------- |
| `AWS_ENDPOINT_URL`      | Endpoint del proveedor S3-compatible     |
| `AWS_S3_BUCKET_NAME`    | Nombre del bucket                        |
| `AWS_ACCESS_KEY_ID`     | Access key                               |
| `AWS_SECRET_ACCESS_KEY` | Secret key                               |
| `AWS_DEFAULT_REGION`    | Región (o `auto`)                        |

**Dato clave:** las imágenes viven en el bucket; Postgres solo guarda la *key*
(`bannerKey`, `profileImageKey`, etc.). Mover el compute de Railway a la Pi **no
toca el bucket**. La única pregunta es si la Pi puede **alcanzar** ese endpoint.

### Árbol de decisión

Mirá el `AWS_ENDPOINT_URL` que tenías en Railway (Variables del servicio BFF):

```
¿El endpoint es una URL pública de internet?
│
├─ SÍ  (r2.cloudflarestorage.com, s3.amazonaws.com, backblazeb2.com,
│       un MinIO con dominio público, etc.)
│   └─► OPCIÓN 1: No migrás nada. Copiás las mismas AWS_* al .env de la Pi.
│       El bucket no le importa dónde corre el compute. FIN.
│
└─ NO  (un host interno de Railway, tipo *.railway.internal, solo alcanzable
        dentro de la red privada de Railway)
    └─► La Pi no puede llegar. Elegí OPCIÓN 2 o 3 y migrá los objetos.
```

> Cómo saberlo rápido: si desde tu máquina (fuera de Railway) el endpoint
> resuelve y responde, es público → Opción 1. Si es `*.railway.internal` o solo
> anda dentro de Railway, hay que migrar.

### Opción 1 — Seguir con el bucket actual (recomendada si es pública)

Cero migración. Copiá al `.env` de la Pi los cinco valores `AWS_*` tal cual los
tenías en Railway. Las keys en Postgres siguen apuntando a los mismos objetos.
Listo.

### Opción 2 — Cloudflare R2 ← ELEGIDA (la Pi solo tiene microSD)

Encaja natural: ya estás en Cloudflare, es S3-compatible, `region: 'auto'` (que
el código ya usa por defecto) es justo la convención de R2, `forcePathStyle`
funciona, y R2 no cobra egress. Y al tener solo microSD, mantiene las imágenes
**fuera** del único punto de falla: si la SD muere, reflasheás y redeployás sin
perder fotos.

> **R2 queda privado — sin CORS ni acceso público.** El navegador nunca le pega a
> R2: pide `api.elhornero.org/images?key=…`, el BFF lee de R2 server-side (con
> credenciales) y streamea. No necesitás bucket público ni dominio custom en R2.

1. Cloudflare **R2 → Create bucket** (ej. `hornero-images`). Dejalo **privado**.
2. **R2 → Manage API Tokens → Create** (permiso Object Read & Write) → guardá
   Access Key ID y Secret.
3. El endpoint es `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
4. Poné los valores en el `.env` (bloque "Bucket — Cloudflare R2" de la Parte A.3).
5. **Solo si migrás de un bucket viejo con imágenes** — copiá los objetos con
   **rclone** (conserva las keys exactas, así las referencias de Postgres siguen
   válidas):
   ```bash
   # rclone config → dos remotes S3: "railway" (origen) y "r2" (destino)
   rclone sync railway:<bucket-viejo> r2:hornero-images --progress
   ```

Con el `.env` seteado, el deploy default (`docker compose up --build -d`) ya usa
R2 — no arranca ningún MinIO.

> ⚠️ **La DB sigue en la microSD.** R2 salva las imágenes, pero Postgres vive en
> el volumen `hornero_pgdata` de la Pi. Si la SD muere, perdés los datos igual.
> Los dumps periódicos y la copia offsite cifrada están en la **Parte C**.

### Opción 3 — Tu propio bucket en la Pi con MinIO (OPT-IN)

> No recomendada con solo microSD (pone imágenes + DB en el mismo punto de falla).
> Queda documentada por si en el futuro sumás un SSD/HDD por USB.

Todo dentro de la Pi, sin depender de nadie. El `docker-compose.yml` ya incluye
dos servicios **detrás del profile `minio`**: `minio` (servidor S3-compatible) y
`createbuckets` (init que crea el bucket al arrancar). No arrancan en el deploy
default — se activan sumando el profile: en la Pi `docker compose --profile
tunnel --profile minio up --build -d`, o solo `--profile minio` para probar
local. MinIO queda **interno**: el navegador nunca lo toca, el BFF lee/escribe
por la red del compose (`http://minio:9000`).

El BFF ya trae los `AWS_*` con default a MinIO, así que **por defecto ya usa el
bucket local**. Solo tenés que fijar las credenciales en el `.env`:

```bash
# Credenciales de MinIO (usuario/clave root del servidor).
MINIO_ROOT_USER=hornero
MINIO_ROOT_PASSWORD=<password-fuerte-de-minio>

# El BFF hereda estos por default; si querés, podés dejarlos explícitos:
AWS_ENDPOINT_URL=http://minio:9000
AWS_S3_BUCKET_NAME=hornero-images
AWS_ACCESS_KEY_ID=hornero               # = MINIO_ROOT_USER
AWS_SECRET_ACCESS_KEY=<mismo que MINIO_ROOT_PASSWORD>
AWS_DEFAULT_REGION=auto
```

Con eso, `docker compose up --build -d` levanta MinIO, crea el bucket
`hornero-images` y el BFF ya guarda/sirve imágenes ahí. Sin migración si es un
deploy nuevo.

**Persistencia (IMPORTANTE):** el volumen `hornero_minio` guarda los bytes.
- Por defecto es un volumen Docker (vive en el disco de la Pi).
- Si el disco es **microSD**, apuntá el volumen a un **SSD/HDD por USB**: en la
  sección `volumes:` de MinIO reemplazá `hornero_minio:/data` por un bind
  `/mnt/ssd/minio:/data`. Las SD se desgastan con escrituras.
- **Backups tuyos:** `mc mirror` a otro destino, o snapshot del directorio del
  volumen. Nadie los hace por vos.

**Consola de MinIO** (`:9001`): queda sin exponer (más seguro). Para entrar,
port-forward por SSH desde tu máquina:
```bash
ssh -L 9001:localhost:9001 pi@<ip-de-la-pi>
# luego abrí http://localhost:9001 con MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
```

**Si venías de un bucket viejo con imágenes**, migrá los objetos (conserva las
keys, así Postgres sigue apuntando bien):
```bash
# rclone config → remote "railway" (origen) y "minio" (destino, S3, endpoint http://<ip>:9000)
rclone sync railway:<bucket-viejo> minio:hornero-images --progress
```

---

## Parte C — Backups y restauración

La DB vive en el volumen `hornero_pgdata`, sobre la microSD de la Pi: **sin backup, si la SD
muere se pierde todo**. El mecanismo está en `scripts/backup/` y los valores de negocio
(RPO/RTO, retención, destino, responsables) están pendientes de la decisión **D11**; hoy corre
con los defaults documentados abajo.

| Archivo                                 | Qué hace                                                              |
| --------------------------------------- | --------------------------------------------------------------------- |
| `scripts/backup/backup.sh`              | `pg_dump -Fc`, verifica el archivo, copia cifrada offsite (opcional), poda local |
| `scripts/backup/restore-check.sh`       | Restaura un dump en un Postgres descartable y corre chequeos          |
| `deploy/systemd/hornero-backup.{service,timer}` | Ejecuta `backup.sh` todos los días 03:15 (`Persistent=true`)  |

Formato: dump en formato custom (`-Fc`, comprimido, verificable con `pg_restore --list`,
restaurable de forma selectiva). `make backup` llama al mismo script; los dumps viejos
`.sql.gz` se restauran con `gunzip | psql` como antes.

### C.1 — Variables (en el `.env` de la Pi)

| Variable                       | Default        | Para qué                                                    |
| ------------------------------ | -------------- | ----------------------------------------------------------- |
| `BACKUP_RETENTION_DAYS`        | `14`           | Días de retención local (`0` = no podar)                    |
| `BACKUP_S3_BUCKET`             | *(vacío)*      | Si está seteado, activa la copia offsite cifrada            |
| `BACKUP_S3_ENDPOINT`           | —              | Endpoint S3/R2 del bucket de backups                        |
| `BACKUP_AWS_ACCESS_KEY_ID` / `BACKUP_AWS_SECRET_ACCESS_KEY` | — | Credenciales **propias** del bucket de backups |
| `BACKUP_PASSPHRASE`            | —              | Frase de cifrado (obligatoria con `BACKUP_S3_BUCKET`)       |
| `BACKUP_S3_PREFIX`             | `hornero/`     | Prefijo de las keys                                         |

Opcionales: `BACKUP_DIR`, `BACKUP_AWS_CLI_IMAGE`, `BACKUP_AWS_DOCKER_ARGS`
(ver cabecera de `backup.sh`). `chmod 600 .env`: ahí viven la passphrase y las keys.

### C.2 — Instalar el timer

En la Pi, desde el repo (el usuario debe estar en el grupo `docker`):

```bash
# 1. Ajustar User= y las rutas /home/pi/hornero_app en el .service
sudo cp deploy/systemd/hornero-backup.service deploy/systemd/hornero-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hornero-backup.timer

# 2. Probar una corrida ya mismo y mirar el resultado
sudo systemctl start hornero-backup.service
journalctl -u hornero-backup.service -n 20 --no-pager
systemctl list-timers hornero-backup.timer
ls -l backups/
```

### C.3 — Copia offsite cifrada (opcional hasta que D11 defina el destino)

1. Crear un bucket **distinto** del de imágenes (ej. `hornero-backups`), **privado**.
   `backup.sh` se niega a correr si `BACKUP_S3_BUCKET` es igual a `AWS_S3_BUCKET_NAME`:
   las imágenes pueden ser públicas, los dumps tienen datos personales (Ley 25.326).
2. R2 → Manage API Tokens → crear un token **solo para ese bucket** (Object Read & Write) y
   usarlo en `BACKUP_AWS_*`. No reutilizar las credenciales de `AWS_*`.
3. Generar la passphrase (`openssl rand -base64 32`) y **guardarla fuera de la Pi** (gestor de
   contraseñas / otra persona del equipo). Si la Pi muere, la passphrase tiene que sobrevivir:
   sin ella los dumps cifrados no se pueden abrir.
4. Completar `BACKUP_S3_*`, `BACKUP_AWS_*` y `BACKUP_PASSPHRASE` en el `.env` y repetir la prueba
   de C.2. Cada dump se cifra con `openssl enc -aes-256-cbc -pbkdf2` y se sube con la imagen
   `amazon/aws-cli` (no requiere instalar nada en el host) a `s3://<bucket>/hornero/`.
5. **Retención remota:** no la hace el script. Configurarla en el bucket: R2 → bucket →
   Settings → Object lifecycle rules → eliminar objetos con prefijo `hornero/` después de N días
   (sugerido 30, a definir en D11).

### C.4 — Simulacro de restauración (restore drill)

Un backup que nunca se restauró no es un backup. Correr el simulacro después de instalar el
timer y cada vez que cambie el esquema o la passphrase:

```bash
make restore-check                                  # el dump más nuevo de backups/
make restore-check DUMP=backups/hornero-<fecha>.dump
BACKUP_PASSPHRASE=… make restore-check DUMP=hornero-<fecha>.dump.enc   # bajado del bucket
```

Levanta un Postgres descartable (misma imagen que el compose, sin puertos publicados, se borra
al terminar), restaura ahí, cuenta filas de `usuarios`, `organizaciones`, `necesidades`,
`donaciones` y `refresh_tokens` y termina con `RESULT: OK` o un código de salida distinto de
cero. **Nunca toca la DB real.** Registrar fecha y resultado de cada simulacro en
`docs/seguridad-matriz-riesgos.md` o donde defina D11.

### C.5 — Restauración real

Solo ante pérdida o corrupción de datos. Implica downtime del MS (el sitio público y el login
dejan de responder datos) hasta terminar.

```bash
cd /…/hornero_app
# 0. Validar primero el dump a restaurar
make restore-check DUMP=<dump>

# 1. Cortar escrituras y tomar un backup del estado actual (por si la restauración empeora)
docker compose stop ms
scripts/backup/backup.sh            # pre-restore: anotar el nombre del archivo

# 2. Si el dump es .enc, descifrarlo (la passphrase se pide por stdin, no queda en el historial)
read -rs BACKUP_CRYPTO_PASS; export BACKUP_CRYPTO_PASS
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_CRYPTO_PASS \
  -in hornero-<fecha>.dump.enc -out hornero-<fecha>.dump
unset BACKUP_CRYPTO_PASS

# 3. Restaurar sobre la DB real (reemplaza los objetos existentes)
docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --exit-on-error' \
  < hornero-<fecha>.dump

# 4. Levantar el MS y verificar (Hibernate completa lo que falte del esquema)
docker compose start ms
docker compose ps
# login en https://panel.elhornero.org y revisar organizaciones / necesidades
rm -f hornero-<fecha>.dump          # borrar el dump descifrado si no estaba en backups/
```

Si la restauración falla a mitad de camino, volver al estado previo con el dump del paso 1.
Los refresh tokens restaurados pueden estar revocados o vencidos: los usuarios solo tendrán
que volver a iniciar sesión.

### C.6 — Roles y accesos

| Rol / decisión                                | Responsable | Estado       |
| --------------------------------------------- | ----------- | ------------ |
| Quién guarda la passphrase (y su copia fuera de la Pi) | TBD (D11) | TBD (D11) |
| Quién tiene acceso al bucket de backups (token R2)     | TBD (D11) | TBD (D11) |
| Quién puede ejecutar una restauración real             | TBD (D11) | TBD (D11) |
| Quién corre el simulacro y con qué frecuencia          | TBD (D11) | TBD (D11) |
| RPO / RTO objetivo                                     | TBD (D11) | TBD (D11) |
| Retención local / remota                               | 14 d / 30 d (defaults provisorios) | TBD (D11) |

### C.7 — Riesgo residual

- **Imágenes (y futuras evidencias) en R2 no están cubiertas** por este mecanismo: solo se
  respalda Postgres. Si alguien borra o sobrescribe objetos en `hornero-images`, no hay copia.
  Opciones, no implementadas: activar el versionado/replicación del bucket, o un
  `aws s3 sync` periódico hacia el bucket de backups.
- El timer y el dump corren en la misma Pi: si la Pi se pierde antes de la copia offsite
  (o sin offsite configurado), se pierde hasta 24 h de datos. El RPO real depende de D11.
- La passphrase está en el `.env` de la Pi para poder automatizar: protege el bucket frente a
  una filtración del lado de Cloudflare, no frente a un atacante con acceso a la Pi.

---

## Troubleshooting

- **Login falla con error de CORS** → revisá que `CORS_ORIGINS` liste EXACTO
  `https://elhornero.org` y `https://panel.elhornero.org` (sin `/` final, con
  `https`). Reiniciá el BFF tras cambiarlo.
- **Cookies no persisten** → con `NODE_ENV=production` el BFF setea
  `sameSite=none; secure`. Requiere HTTPS, que lo da Cloudflare en el borde. Si
  probás por `http://localhost` directo no van a pegar; probá siempre por el
  dominio.
- **Imágenes rotas (404 en `/images?key=...`)** → problema de bucket:
  endpoint/credenciales mal, o los objetos no se migraron. Ver Parte B.
- **El build del MS muere / se cuelga** → Maven come RAM. En Pi de <4GB puede dar
  OOM. Soluciones: agregar swap, o buildear las imágenes en otra máquina con
  `docker build --platform linux/arm64` y pushearlas a un registry.
- **Todas las imágenes base son multi-arch (arm64)**, así que corren en Pi de 64
  bits sin cambios.
