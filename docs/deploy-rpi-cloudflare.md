# Deploy en Raspberry Pi con Cloudflare Tunnel

Runbook para levantar el stack migrado (Astro + Admin SPA + BFF + MS + Postgres)
en una Raspberry Pi, expuesto a internet mediante un Cloudflare Tunnel.

- **Rama:** `feat/spa-scaffold-auth` (contiene los tres fronts + BFF + MS).
- **Dominio:** `elhornero.com`.

## Topología

| Hostname público            | Servicio (contenedor) | Tipo                          |
| --------------------------- | --------------------- | ----------------------------- |
| `elhornero.com`             | `astro:4321`          | Astro SSR (público)           |
| `panel.elhornero.com`       | `admin:80`            | Admin SPA (nginx estático)    |
| `api.elhornero.com`         | `bff:3001`            | BFF (API)                     |
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
| *(vacío)* | `elhornero.com` | `astro:4321`         |
| `panel`   | `elhornero.com` | `admin:80`           |
| `api`     | `elhornero.com` | `bff:3001`           |

Cloudflare crea los registros DNS (CNAME al túnel) automáticamente. No hace falta
abrir ningún puerto en el router: el túnel sale desde la Pi hacia Cloudflare.

### A.3 — Archivo `.env` en la Pi

Creá `/…/hornero_app/.env` (NO se commitea) con:

```bash
# Debe ser IDÉNTICO entre MS y BFF. Mínimo 32 chars aleatorios.
JWT_SECRET=<secreto-largo-aleatorio>

# Fronts — se HORNEAN en build. Rebuild obligatorio si cambian.
PUBLIC_BFF_URL=https://api.elhornero.com
PUBLIC_SPA_URL=https://panel.elhornero.com
VITE_BFF_URL=https://api.elhornero.com

# CORS del BFF — los dos orígenes de navegador que le pegan.
CORS_ORIGINS=https://elhornero.com,https://panel.elhornero.com
FRONTEND_URL=https://elhornero.com

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

### A.4 — Levantar (en la Pi)

El túnel vive en el profile `tunnel` (no arranca sin él):

```bash
git checkout feat/spa-scaffold-auth
# crear el .env de A.3
docker compose --profile tunnel up --build -d
docker compose logs -f cloudflared   # verificar "Registered tunnel connection"
```

> Con MinIO self-host en vez de R2: `docker compose --profile tunnel --profile minio up --build -d`.

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

> Ojo: `make start-local` y `make dev-*-local` NO cambiaron — siguen levantando el
> Next.js viejo (`ts_hornero_app`), no Astro/Admin. Para probar el stack que vas a
> deployar, usá `docker compose up` (o `make up`), no `make start-local`.

### A.5 — Verificar

1. `https://elhornero.com` carga el front público (Astro).
2. `https://api.elhornero.com/api/docs` responde (Swagger del BFF).
3. `https://panel.elhornero.com` carga el login del panel.
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
> R2: pide `api.elhornero.com/images?key=…`, el BFF lee de R2 server-side (con
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
> Hacé dumps periódicos a otro lado (ej. a R2 o a tu máquina):
> ```bash
> docker compose exec -T postgres pg_dump -U hornero hornero | gzip > hornero_$(date +%F).sql.gz
> ```

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

## Troubleshooting

- **Login falla con error de CORS** → revisá que `CORS_ORIGINS` liste EXACTO
  `https://elhornero.com` y `https://panel.elhornero.com` (sin `/` final, con
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
