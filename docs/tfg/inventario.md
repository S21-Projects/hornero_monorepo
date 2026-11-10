# Inventario técnico (Entrega 4)

Fuente: lectura directa del worktree `hornero_app-tfg` (rama `tfg/entrega-4`). Las referencias son `ruta:línea` desde la raíz del repositorio. Lo que depende de configuración que no está en el repositorio (por ejemplo, ajustes reales del bucket en Cloudflare) se declara como no determinable.

---

## 1. Redis

Conclusión: el sistema no usa Redis. No existe ninguna configuración, dependencia ni servicio de Redis.

Evidencia:

- Búsqueda de `redis`, `ioredis`, `jedis`, `lettuce`, `cache-manager` y `keyv` (sin distinguir mayúsculas) sobre todo el repositorio, excluyendo `node_modules`, archivos `lock`, `ts_hornero_app`, `docs/tesis`, `odd` y `openspec`: las únicas coincidencias son dos menciones en documentación como opción futura (`docs/escalabilidad.md:55` y `docs/escalabilidad.md:72`) y un falso positivo de la palabra "redistribuye" (`jar_hornero_ms/src/main/java/org/example/config/DataInitializer.java:329`).
- Sin coincidencias de `redis` en `jar_hornero_ms/pom.xml`, `ts_hornero_bff/package.json`, `ts_hornero_astro/package.json`, `ts_hornero_admin/package.json`, `go_algorithms_worker/go.mod`, `docker-compose.yml` ni `Makefile` (`rg -c -i redis` no devolvió coincidencias en ninguno).
- `docker-compose.yml` no define un servicio de Redis (ver sección 3).

Qué usa el sistema en lugar de Redis, para cada uso que el TFG atribuye a Redis:

| Uso mencionado en el TFG | Implementación real | Fuente |
|---|---|---|
| OTP de verificación de correo | Hash BCrypt del código guardado en la tabla PostgreSQL `codigos_verificacion` | `jar_hornero_ms/src/main/java/org/example/auth/otp/CodigoVerificacion.java:17-21,36`; `.../auth/otp/OtpService.java:8,35` |
| Código de entrega (QR) | Hash BCrypt en la tabla PostgreSQL `codigos_entrega` | `jar_hornero_ms/src/main/java/org/example/donacion/entrega/CodigoEntrega.java:22-31,48-49` |
| Límite de frecuencia de OTP y de generación de códigos de entrega | Mapas en memoria del proceso (`ConcurrentHashMap`) | `.../auth/otp/OtpThrottle.java:31`; `.../donacion/entrega/CodigoEntregaThrottle.java:29` |
| Límite de frecuencia del BFF | `@nestjs/throttler` con almacenamiento por defecto (en memoria); la configuración no define `storage` | `ts_hornero_bff/src/auth/auth-throttler.config.ts:25-27`; `ts_hornero_bff/src/upload/upload.module.ts:26` |
| "Caché de cobertura" | No hay caché de cobertura. Lo más cercano: (a) `MapaOrganizacionesCache`, una instantánea en memoria (`volatile Snapshot`) del JSON público de pines del mapa, con TTL de 300 s (`app.mapa.cache-ttl-seconds`); (b) el déficit por radio se calcula en cada ronda con una consulta agrupada, sin caché; (c) el trabajador de Go carga el CSV de ReNaCoM y de vulnerabilidad una vez al arrancar | `jar_hornero_ms/src/main/java/org/example/organizacion/MapaOrganizacionesCache.java:20,23-24,34-46`; `jar_hornero_ms/src/main/resources/application.yml:73-75`; `jar_hornero_ms/src/main/java/org/example/asignacion/VulnerabilidadCalculator.java:47-58`; `go_algorithms_worker/internal/geo/deficit.go:60-109` |
| Caché de imágenes | Cabecera HTTP `Cache-Control: public, max-age=31536000, immutable` y regla de caché en Cloudflare; no hay caché del lado del servidor | `ts_hornero_bff/src/images/images.controller.ts:78-80`; `docs/deploy-rpi-cloudflare.md:56-77` |

Consecuencia señalada por el propio proyecto: los contadores en memoria impiden replicar servicios; `docs/escalabilidad.md:55` propone "PostgreSQL o Redis" como solución futura. La afirmación del TFG "Redis para OTP y caché de cobertura" no coincide con el código.

---

## 2. Librería de mapas por frontend

| Frontend | Librería | Versión declarada | Capa base de teselas | Fuente |
|---|---|---|---|---|
| `ts_hornero_astro` (sitio público) | Leaflet con `react-leaflet`; `react-leaflet-cluster` para agrupar pines | `leaflet ^1.9.4`, `react-leaflet ^5.0.0`, `react-leaflet-cluster 4.1.3` | OpenStreetMap: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | `ts_hornero_astro/package.json:21,24,25`; `ts_hornero_astro/src/components/islands/leaflet-map.tsx:235-237`; `.../MapaVulnerabilidadMap.tsx:175-180` |
| `ts_hornero_admin` (panel) | Leaflet con `react-leaflet` (selector de ubicación de organización) | `leaflet ^1.9.4`, `react-leaflet ^5.0.0` | OpenStreetMap, misma URL | `ts_hornero_admin/package.json:20,26`; `ts_hornero_admin/src/components/map/OrgLocationPicker.tsx:2-4,95-97` |
| `ts_hornero_app` (Next.js, obsoleto, sin referencias en Makefile ni compose) | Leaflet con `react-leaflet` | `leaflet ^1.9.4`, `react-leaflet ^5.0.0` | OpenStreetMap | `ts_hornero_app/package.json:15,19`; `ts_hornero_app/src/components/ui/leaflet-map.tsx:160-162` |

Notas:

- No hay MapLibre, Mapbox, Google Maps ni OpenLayers en ninguno de los `package.json` de los frontends.
- La política de seguridad de contenido del sitio Astro habilita los servidores de teselas de OSM (`ts_hornero_astro/src/lib/securityHeaders.ts:11`).
- La capa de calor `leaflet.heat` se descartó: la capa de densidad usa círculos translúcidos (`docs/mapa-vulnerabilidad.md:128-130`).
- El mapa de vulnerabilidad pinta la coropleta con un GeoJSON estático por departamento (`ts_hornero_astro/public/mapa/departamentos.geojson`, generado por `scripts/mapa/vulnerabilidad.sql`).

---

## 3. Contenedores de producción: puertos publicados y redes

No existe un archivo de compose separado para producción: hay un único `docker-compose.yml` en la raíz (`fd -g 'docker-compose*'` devuelve solo ese archivo). En producción la Pi corre `docker compose up --build -d` directamente (`docs/deploy-rpi-cloudflare.md:195,213`; `CLAUDE.md`, sección "Commands").

Todos los servicios usan la misma red de tipo bridge llamada `hornero` (`docker-compose.yml:282-284`). Volúmenes con nombre: `hornero_pgdata` y `hornero_minio` (`docker-compose.yml:286-288`).

Contenedores que levanta el despliegue por defecto (sin perfiles):

| Servicio | Imagen o build | Puerto publicado en el host | Red | Fuente |
|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `127.0.0.1:${DB_PORT:-5432}` a 5432 | `hornero` | `docker-compose.yml:10-31` |
| `ms` (Spring Boot) | build `./jar_hornero_ms` | `127.0.0.1:${SERVER_PORT:-8081}` a 8081 | `hornero` | `docker-compose.yml:33-113` |
| `worker` (Go) | build `./go_algorithms_worker` | ninguno (solo accesible dentro de la red `hornero`, `WORKER_URL: http://worker:8090`) | `hornero` | `docker-compose.yml:120-132`; `:67` |
| `bff` (NestJS) | build `./ts_hornero_bff` | `127.0.0.1:${BFF_PORT:-3001}` a 3001 | `hornero` | `docker-compose.yml:134-166` |
| `astro` (SSR) | build `./ts_hornero_astro` | `127.0.0.1:4321` a 4321 | `hornero` | `docker-compose.yml:168-203` |
| `admin` (nginx estático) | build `./ts_hornero_admin` | `127.0.0.1:5173` a 80 | `hornero` | `docker-compose.yml:205-223` |

Total: 6 contenedores en el despliegue por defecto. Todos los puertos publicados están enlazados a `127.0.0.1` (solo bucle local, no la LAN).

Contenedores definidos con perfil opcional (no se levantan por defecto):

| Servicio | Perfil | Imagen | Puertos | Fuente |
|---|---|---|---|---|
| `minio` | `minio` | `minio/minio:RELEASE.2025-09-07T16-13-09Z` | ninguno publicado | `docker-compose.yml:229-241` |
| `createbuckets` | `minio` | `minio/mc:RELEASE.2025-08-13T08-35-41Z` | ninguno | `docker-compose.yml:244-263` |
| `cloudflared` | `tunnel` | `cloudflare/cloudflared:2026.7.3` | ninguno | `docker-compose.yml:267-280` |

Dato a tener en cuenta sobre `cloudflared`: el runbook indica que el túnel corre como servicio systemd en el host y no dentro de compose, por lo que no se usa el perfil `tunnel` (`docs/deploy-rpi-cloudflare.md:45-51`). Los destinos del túnel son `localhost:4321`, `localhost:5173` y `localhost:3001` (`docs/deploy-rpi-cloudflare.md:41-43`). El comentario en `docker-compose.yml:177-178` (cloudflared alcanza astro "por nombre de servicio sobre la red del compose") contradice el runbook; para el despliegue real rige el runbook.

Otros elementos del despliegue:

- Política de reinicio `restart: unless-stopped` en todos los servicios principales (por ejemplo `docker-compose.yml:12,35,122,136,170,207`), incorporada en `c5a60de` (2026-10-19).
- Rotación de logs de 5 archivos de 10 MB por contenedor (`docker-compose.yml:1-7`).
- Respaldo de la base de datos: unidad systemd `deploy/systemd/hornero-backup.service` y su timer (`deploy/systemd/hornero-backup.timer`), ejecuta `scripts/backup/backup.sh`.
- Nombres públicos: `elhornero.org` (astro), `panel.elhornero.org` (admin), `api.elhornero.org` (bff) (`docs/deploy-rpi-cloudflare.md:11-15`).
- Este inventario describe lo que define el repositorio. Los contenedores efectivamente en ejecución en la Pi no se pueden verificar desde aquí.

---

## 4. Medio de almacenamiento del servidor

Lo que está documentado:

- La Raspberry Pi tiene solo microSD: "la Pi solo tiene microSD" (`docs/deploy-rpi-cloudflare.md:113,334`, "Opción 2 ... ELEGIDA (la Pi solo tiene microSD)").
- La base de datos vive en el volumen Docker `hornero_pgdata`, sobre la microSD (`docs/deploy-rpi-cloudflare.md:362-363,425`).
- El compose contiene un comentario con el mismo supuesto: "the Raspberry Pi runs on a microSD" (`docker-compose.yml:1-2`).
- `docs/escalabilidad.md:23,30` describe el estado actual como "1 Pi, microSD" y propone un SSD NVMe en la Pi 5 como mejora futura; `docs/escalabilidad.md:11` lista "disco SSD" entre las acciones pendientes. No hay evidencia en el repositorio de que el SSD ya esté instalado.
- El modelo de la Pi (Pi 5) aparece en `docs/escalabilidad.md:30`; el repositorio no documenta capacidad de la tarjeta ni su marca.

Lo que no se puede determinar desde el repositorio: el tipo y la capacidad reales del medio hoy en producción (si ya se migró a SSD) y el estado del desgaste de la tarjeta.

---

## 5. Almacenamiento de evidencias

### 5.1 Bucket y servicio

- Servicio de objetos: bucket compatible con S3; en producción, Cloudflare R2 (`CLAUDE.md`, sección "Object storage"; `docs/deploy-rpi-cloudflare.md:113-118`).
- Nombre del bucket de producción documentado: `hornero-images` (`docs/deploy-rpi-cloudflare.md:115`).
- Un solo bucket y un solo conjunto de credenciales (`AWS_*`) sirven imágenes públicas y evidencias. El BFF lee las variables `AWS_ENDPOINT_URL`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `AWS_DEFAULT_REGION` tanto para subir (`ts_hornero_bff/src/upload/upload.service.ts:12-24`) como para servir (`ts_hornero_bff/src/images/images.service.ts:11-21`). El microservicio lee las mismas variables solo para borrar `reclamo-evidencia/` (`jar_hornero_ms/src/main/resources/application.yml:107-120`).
- El bucket de respaldos es otro, separado y privado, según la política (`docs/politica-datos-y-respaldo.md:118`; `docs/acciones-pendientes-equipo.md:139`).
- El stack local del equipo apunta al mismo bucket de producción (`CLAUDE.md`, sección "Commands"; `docs/politica-datos-y-respaldo.md:97`).

### 5.2 Prefijos de claves

La clave se arma como `{prefijo}/{uuid aleatorio}.{extensión detectada}` (`ts_hornero_bff/src/upload/upload.service.ts:77`); no se envía ACL en el `PutObject` (`upload.service.ts:79-86`).

| Contenido | Prefijo | Formato de clave | Visibilidad en la aplicación | Fuente |
|---|---|---|---|---|
| Foto de perfil de organización | `org-profile/` | `org-profile/{orgId}/{uuid}.{ext}` | Pública vía `GET /images?key=` | `upload.service.ts:27-32` |
| Banner de organización | `org-banner/` | `org-banner/{orgId}/{uuid}.{ext}` | Pública vía `GET /images?key=` | `upload.service.ts:34-39` |
| Evidencia de acreditación | `org-evidencia/` | `org-evidencia/{orgId}/{uuid}.{ext}` (jpeg, png, webp o pdf) | Autenticada | `upload.service.ts:41-46` |
| Evidencia de reclamo | `reclamo-evidencia/` | `reclamo-evidencia/{orgId}/{userId}/{uuid}.{ext}` | Autenticada | `upload.service.ts:48-59` |

Límite de tamaño: 5 MB (`ts_hornero_bff/src/upload/upload.module.ts:19`). El tipo se determina por los bytes del archivo y no por el tipo declarado (`upload.service.ts:66-76`).

### 5.3 Cómo se sirven las evidencias

Evidencia de acreditación: `GET /evidencia-files/:orgId/:filename`

- Solo roles `REFERENTE` y `ADMINISTRADOR` (`ts_hornero_bff/src/evidencia-files/evidencia-files.controller.ts:37`).
- Antes de leer el objeto, el BFF consulta al microservicio, que exige que la clave tenga la forma `org-evidencia/{orgId}/{archivo}` con el `orgId` de la ruta y que exista una fila de evidencia con esa clave (`evidencia-files.controller.ts:51-56`; `jar_hornero_ms/src/main/java/org/example/acreditacion/AcreditacionService.java:504-523`). La propiedad de la organización la comprueba el controlador del microservicio antes de la llamada (`AcreditacionController.java:122-128`).
- Respuesta: `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, y los PDF con `Content-Disposition: inline` (`evidencia-files.controller.ts:59-68`).

Evidencia de reclamo: `GET /reclamo-files/:orgId/:solicitanteId/:filename`, solo `REFERENTE` y `ADMINISTRADOR`, con verificación contra el servicio de reclamos y `Cache-Control: private, no-store` (`ts_hornero_bff/src/reclamos/reclamo-files.controller.ts:31-59`).

### 5.4 ¿Es privado el bucket? ¿Puede alcanzarse una evidencia por una ruta pública?

Lo que el repositorio permite afirmar:

1. Documentación del diseño: el bucket R2 "queda privado, sin CORS ni acceso público"; el navegador nunca accede a R2 y pide `api.elhornero.org/images?key=...`, y el BFF lee de R2 con credenciales del lado del servidor (`docs/deploy-rpi-cloudflare.md:342-346`). El código no genera URL firmadas ni URL directas al bucket: una búsqueda de `presign`, `getSignedUrl` y `r2.dev` en `ts_hornero_bff/src`, `jar_hornero_ms/src/main`, `ts_hornero_admin/src` y `ts_hornero_astro/src` no encontró coincidencias.
2. La misma ruta pública que sirve imágenes lee del mismo bucket: `GET /images?key=` es `@Public()` y llama a `ImagesService.getObject(key)` con el bucket único (`ts_hornero_bff/src/images/images.controller.ts:57-82`). Por lo tanto, un objeto de evidencia es técnicamente alcanzable por esa ruta pública si no se lo bloquea. El bloqueo existe y es una lista de denegación por prefijo.
3. La lista de denegación (`images.controller.ts:21-55,70-74`) rechaza con 403 cualquier clave cuyo valor normalizado comience con `org-evidencia/` o `reclamo-evidencia/`. La normalización decodifica hasta 3 veces la URL, quita barras iniciales, resuelve `.` y `..`, y pasa a minúsculas. Pruebas automatizadas de la ruta incluyen clave simple, barra inicial, separador codificado, recorrido `..` y variación de mayúsculas (`ts_hornero_bff/src/images/images.controller.spec.ts:40-98`).
4. La caché de Cloudflare se aplica solo a la ruta `/images` (`docs/deploy-rpi-cloudflare.md:63-77`); las URL de evidencia deben responder sin `HIT`, y llevan `no-store`.

Conclusión técnica sobre alcance: en el código, una evidencia no es alcanzable por ninguna ruta pública con clave conocida porque `/images` la rechaza y las rutas de evidencia exigen autenticación y pertenencia. La protección de `/images` es una lista de denegación por prefijo sobre un bucket compartido, no una separación física de buckets; cualquier prefijo nuevo con contenido sensible quedaría público en esa ruta hasta agregarlo a la lista (`EVIDENCIA_PREFIXES`, `images.controller.ts:21`). Las claves incluyen un UUID aleatorio, de modo que adivinar una clave no es práctico, pero esto no sustituye la denegación.

Lo que no se puede determinar desde el repositorio:

- La configuración real del bucket en Cloudflare: si el acceso público (`r2.dev`) o un dominio personalizado está habilitado sobre el bucket `hornero-images`, la política de CORS vigente y los permisos del token de API. El runbook dice "Dejalo privado" (`docs/deploy-rpi-cloudflare.md:346`) pero eso es una instrucción, no una verificación. Si el bucket tuviera acceso público habilitado, las evidencias serían accesibles por la URL pública del bucket sin pasar por el BFF; eso solo se descarta consultando el panel de Cloudflare o ejecutando una solicitud sin credenciales contra la URL del bucket.
- La regla de caché de Cloudflare efectivamente creada (el runbook la describe, `docs/deploy-rpi-cloudflare.md:56-77`, pero no hay forma de verificarla desde el repositorio).
- Cifrado en reposo y retención de versiones del bucket: el repositorio no los configura.

### 5.5 Borrado y retención de evidencias

- Evidencia de reclamo: el microservicio la borra del bucket después de anonimizar al usuario y en un barrido nocturno de huérfanas, solo bajo el prefijo `reclamo-evidencia/` y solo con `EVIDENCIA_BORRADO_ENABLED=true` (`jar_hornero_ms/src/main/resources/application.yml:107-126`; `docs/politica-datos-y-respaldo.md:83-97`). Por defecto el borrado está apagado.
- Evidencia de acreditación (`org-evidencia/`): el repositorio no tiene ningún borrado automático para este prefijo (`docs/politica-datos-y-respaldo.md:84-85` aclara que el microservicio nunca toca ese prefijo).

---

## 6. Resumen de huecos entre el TFG y el código

| Afirmación del TFG o del encargo | Estado en el código |
|---|---|
| Redis para OTP y caché de cobertura | No se usa Redis; OTP y códigos de entrega en PostgreSQL con hash BCrypt; contadores y caché del mapa en memoria |
| Mapa | Leaflet con `react-leaflet` y teselas de OpenStreetMap en Astro y en el panel |
| Contenedores de producción | 6 por defecto (postgres, ms, worker, bff, astro, admin), todos en la red `hornero`, todos los puertos publicados en `127.0.0.1`, el worker sin puerto; MinIO, createbuckets y cloudflared son opcionales por perfil; el túnel real corre en el host |
| Almacenamiento del servidor | microSD documentada; SSD solo como mejora propuesta |
| Evidencias privadas | Servidas solo por rutas autenticadas del BFF; la ruta pública de imágenes las bloquea con lista de denegación; el carácter privado del bucket en Cloudflare no es verificable desde el repositorio |
