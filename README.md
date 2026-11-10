# Hornero

Plataforma web para organizar donaciones de alimentos hacia comedores y merenderos comunitarios de
Argentina. Es el código del Trabajo Final de Grado "Hornero" (sistema de acreditación, asignación
priorizada y trazabilidad de donaciones).

- Las **organizaciones** (comedores, merenderos, copas de leche) publican sus **necesidades**.
- Los **donantes** realizan **donaciones**, de forma directa a una organización o a un fondo común.
- Los **administradores** validan y acreditan a las organizaciones por niveles (N1, N2, N3) a partir de
  evidencias auditadas, y conservan un legajo con bitácora inmutable por organización.
- Las donaciones al fondo común se asignan mediante **rondas**: un trabajador en Go (`go_algorithms_worker`)
  resuelve un problema de asignación (algoritmo húngaro) con puntajes de cercanía, necesidad, espera y
  cumplimiento. Detalle en [`docs/worker-asignacion.md`](docs/worker-asignacion.md).

El sitio público de producción está en <https://elhornero.org>.

> Idioma: este README está en español. Los demás README y `CLAUDE.md` están en inglés. Los términos de
> dominio (organizaciones, necesidades, donaciones, ronda, acreditación, legajo) se mantienen en español,
> igual que en el código.

---

## Arquitectura

```
Navegador
  ├──► ts_hornero_astro  :4321   sitio público anónimo (Astro SSR)
  └──► ts_hornero_admin  :5173   panel autenticado, todos los roles (React/Vite SPA)
              │
              ▼
       ts_hornero_bff    :3001   BFF (NestJS): proxy de autenticación y agregación
              │
              ▼
       jar_hornero_ms    :8081   microservicio (Spring Boot): lógica de dominio, emisor de JWT
         │          │
         ▼          └──► go_algorithms_worker :8090   (interno, sin puerto en el host)
     PostgreSQL :5432          solo se invoca desde el MS en POST /api/rondas
```

- El microservicio es la autoridad real de autorización; el BFF y el panel aplican controles adicionales.
- El worker es interno: no publica puerto en el host y solo lo llama el MS por HTTP
  (`WORKER_URL=http://worker:8090`). Si está caído, el MS arranca y atiende todo lo demás; solo la
  ronda responde `503`.
- Las imágenes y evidencias se guardan en un bucket compatible con S3 (Cloudflare R2 en producción,
  MinIO en local). Solo el BFF y el MS lo acceden, desde el servidor.

## Servicios

| Servicio | Tecnología | Puerto | README |
|---|---|---|---|
| `jar_hornero_ms` | Spring Boot 3.2.5, Java 17, Maven | 8081 | [README](jar_hornero_ms/README.md) |
| `ts_hornero_bff` | NestJS 11, Node 20 | 3001 | [README](ts_hornero_bff/README.md) |
| `ts_hornero_admin` | React 19, Vite 8, TypeScript 6 | 5173 | [README](ts_hornero_admin/README.md) |
| `ts_hornero_astro` | Astro 7 (SSR), Node 22 | 4321 | [README](ts_hornero_astro/README.md) |
| `go_algorithms_worker` | Go 1.26 | 8090 (interno) | [README](go_algorithms_worker/README.md) |
| `postgres` | PostgreSQL 16 | 5432 (solo loopback) | — |

Las versiones provienen de `pom.xml`, `package.json`, `go.mod` y los `Dockerfile` de cada servicio.

## Mapa del repositorio

| Ruta | Contenido |
|---|---|
| `jar_hornero_ms/`, `ts_hornero_bff/`, `ts_hornero_admin/`, `ts_hornero_astro/`, `go_algorithms_worker/` | Los cinco servicios de aplicación |
| `e2e/` | Pruebas de extremo a extremo a nivel API, escenarios manuales y datos de demostración ([README](e2e/README.md)) |
| `scripts/` | `demo/` (stack de demostración), `sql/` (cambios de esquema idempotentes), `backup/` (respaldo y simulacro de restauración), `mapa/` (datos del mapa de vulnerabilidad), `seed.ts` |
| `deploy/systemd/` | Unidades systemd de respaldo y copia de evidencias para la Raspberry Pi |
| `docs/` | Documentación técnica; `docs/tfg/` y `docs/tesis/` agrupan el material de la tesis |
| `bruno/` | Colección de [Bruno](https://www.usebruno.com/) para probar el BFF a mano ([README](bruno/README.md)) |
| `claude_design/` | Maquetas JSX/CSS de referencia. **No** están conectadas a la aplicación |
| `openspec/`, `odd/` | Artefactos de proceso de desarrollo (especificaciones y listas de tareas) |
| `docker-compose.yml`, `Makefile` | Orquestación del stack y atajos de comandos |

---

## Inicio rápido para evaluadores: stack de demostración

La forma más corta de ver el sistema funcionando es el stack de demostración. Es un proyecto de Docker
Compose propio (`hornero-demo`), con volúmenes propios, MinIO local, secretos aleatorios generados en
`.env.demo` (ignorado por git) y datos ficticios. No lee `.env` ni `.env.local`, no usa servicios externos
y se niega a operar contra un destino que no sea `localhost`.

### Requisitos previos

- Docker con Compose V2 y `make`.
- `openssl` (el script lo usa para generar los secretos) y Node.js 20 o superior (la carga de datos usa `tsx` desde `e2e/`).
- Los puertos 3001, 8081, 5173, 4321 y 5432 del equipo deben estar libres: si hay otro stack en marcha, deténgalo antes (`make down`).

### Pasos

```bash
make demo-up      # primera vez: genera .env.demo, construye y levanta el stack, aplica scripts/sql/V*.sql
make demo-seed    # carga los datos ficticios (unos 2 minutos: el registro tiene límite de tasa) e imprime los accesos
```

Direcciones:

| Qué | URL |
|---|---|
| Sitio público y mapa | <http://localhost:4321> |
| Panel (todos los roles) | <http://localhost:5173> |
| BFF y su Swagger | <http://localhost:3001>, <http://localhost:3001/api/docs> |

### Accesos ficticios

Todas las cuentas usan la misma contraseña, que existe solo dentro del stack de demostración
(definida en `scripts/demo/demo.sh`): `Luna-Pampa-Rio-2026!`

| Rol | Correo | Detalle |
|---|---|---|
| Administrador | `admin.demo@example.com` | audita evidencias, ejecuta rondas |
| Referente | `referente.naranjos@example.com` | Comedor Los Naranjos (N3) |
| Referente | `referente.sol@example.com` | Merendero Sol de Barrio (N2) |
| Referente | `referente.molino@example.com` | Copa de Leche El Molino (N1, con evidencia N2 pendiente y observada) |
| Donante | `donante.ana@example.com` | — |
| Donante | `donante.luis@example.com` | — |

### Otros comandos de la demostración

```bash
make demo-verify EMAIL=nuevo@example.com   # marca como verificada una cuenta registrada durante la demo
                                           # (el correo OTP nunca se envía: el stack usa MAIL_LOG_ONLY)
make demo-reset   # vuelve al estado inicial: borra los volúmenes del proyecto demo y vuelve a cargar los datos
make demo-down    # detiene el stack conservando los datos
```

`make demo-reset` pide escribir el nombre del proyecto antes de borrar. El guion sugerido para recorrer la
demostración y el modelo de seguridad completo están en la sección "Demo for recording" de
[`e2e/README.md`](e2e/README.md).

---

## Desarrollo local

Solo con Docker: no hay modo de desarrollo nativo con recarga en caliente. Hay dos modos de stack completo.

```bash
cp .env.example .env.local   # en .env.local: MAIL_LOG_ONLY=true y vaciar las variables AWS_* (se usa MinIO local)
make up-local                # stack rápido: MinIO local y SEED_DEMO_DATA=true (cuentas y datos de ejemplo)

cp .env.example .env         # completar JWT_SECRET (mínimo 32 caracteres aleatorios), ver el archivo
make up                      # equivalente a producción: usa .env tal cual
```

`make down` detiene el stack (`docker compose down -v` borra también el volumen de la base). Todas las
variables están documentadas con comentarios en [`.env.example`](.env.example); los archivos `.env*` reales
están ignorados por git y no deben subirse.

Con `make up-local` la base queda con cuentas de ejemplo (`SEED_DEMO_DATA=true`), que son las que usan las
pruebas e2e. Para el recorrido de evaluación se recomienda el stack de demostración de la sección anterior.

### Otros atajos del `Makefile`

| Comando | Qué hace |
|---|---|
| `make seed` | ejecuta `scripts/seed.ts` contra el BFF |
| `make backup` | `pg_dump` verificado de la base en ejecución hacia `backups/` |
| `make restore-check` | restaura un respaldo en un contenedor Postgres descartable y lo verifica |
| `make migrate` | respaldo y luego aplica `scripts/sql/V*.sql` en orden (idempotente) |
| `make coverage` | cobertura de líneas de los cuatro servicios con pruebas |
| `make escenario ESC=fondo-comun N=5` | deja el stack local en un estado conocido para pruebas manuales |
| `make mapa-datos`, `make importar-renacom`, `make importar-poblacion`, `make mapa-radios` | datos del mapa de vulnerabilidad (ver [`scripts/mapa/README.md`](scripts/mapa/README.md)) |

---

## Pruebas

No hay un comando agregado en la raíz; se ejecutan por servicio desde su directorio:

| Servicio | Comando |
|---|---|
| `jar_hornero_ms` | `mvn test` |
| `ts_hornero_bff` | `npm test` (Jest); `npm run test:e2e` para las pruebas e2e del propio BFF |
| `ts_hornero_admin` | `npm test` (Vitest); `npm run lint`; `npm run build` ejecuta además `tsc -b` |
| `go_algorithms_worker` | `go test ./...` |
| `ts_hornero_astro` | no tiene pruebas automáticas; `npm run build` verifica que compile |

`make coverage` corre las suites unitarias con cobertura y muestra un resumen por servicio (informe sin
umbrales; ver [`docs/validacion-calidad.md`](docs/validacion-calidad.md)).

**Pruebas e2e a nivel API** (`make e2e`): ejercen el flujo completo de donaciones contra el stack real
(BFF, MS, Postgres, worker). Requieren que el stack ya esté en marcha con datos de ejemplo, es decir,
`make up-local` en otra terminal; no funcionan contra `make up` (sin cuentas de ejemplo) ni contra el
stack de demostración (usa otras cuentas). Detalles en [`e2e/README.md`](e2e/README.md).

---

## Documentación de la tesis

| Ubicación | Propósito |
|---|---|
| [`docs/tfg/RESUMEN.md`](docs/tfg/RESUMEN.md) | Resumen de la Entrega 4: tareas, estado y archivos |
| [`docs/tfg/reglas-negocio.md`](docs/tfg/reglas-negocio.md) | Reglas de negocio extraídas del código |
| [`docs/tfg/inventario.md`](docs/tfg/inventario.md) | Inventario técnico del sistema |
| [`docs/tfg/anexo-d-modelo-datos.md`](docs/tfg/anexo-d-modelo-datos.md) | Anexo D: diccionario de datos y modelo entidad-relación |
| [`docs/tfg/anexo-e-pruebas.md`](docs/tfg/anexo-e-pruebas.md) | Anexo E: evidencia de pruebas y cobertura |
| [`docs/tfg/seguridad-c1.md`](docs/tfg/seguridad-c1.md) a [`seguridad-c5.md`](docs/tfg/seguridad-c5.md) | Seguridad: hash de contraseñas, sesiones, evidencias, auditoría, respaldo |
| [`docs/tfg/seguridad-dependencias.md`](docs/tfg/seguridad-dependencias.md) | Auditoría de dependencias y secretos |
| [`docs/tfg/prueba-restauracion.md`](docs/tfg/prueba-restauracion.md) | Procedimiento y registro del simulacro de restauración |
| [`docs/tfg/cronograma-real.md`](docs/tfg/cronograma-real.md) | Cronograma real a partir del historial de git |
| [`docs/tfg/revision-word.md`](docs/tfg/revision-word.md) | Revisión del documento Word contra el código |
| [`docs/tfg/diagramas/`](docs/tfg/diagramas/) | Diagramas PlantUML y PNG: ER, despliegue, secuencia de reasignación |
| [`docs/tesis/diagramas/`](docs/tesis/diagramas/) | Diagramas de la tesis por tipo: `arquitectura`, `casos-uso`, `despliegue`, `estructura`, `secuencia`, `ui` |
| [`docs/tesis/documento.md`](docs/tesis/documento.md) | Borrador del documento de tesis |

Otras referencias técnicas en `docs/`: [`worker-asignacion.md`](docs/worker-asignacion.md) (algoritmo de
ronda), [`mapa-vulnerabilidad.md`](docs/mapa-vulnerabilidad.md),
[`security-access-token-httponly.md`](docs/security-access-token-httponly.md),
[`politica-datos-y-respaldo.md`](docs/politica-datos-y-respaldo.md),
[`db-changes.md`](docs/db-changes.md).

---

## Despliegue

Producción se ejecuta en una Raspberry Pi 5 con Docker Compose, detrás de un túnel de Cloudflare, con
imágenes en Cloudflare R2. Los servicios solo escuchan en loopback; el túnel (un `cloudflared` en el
host) apunta a esos puertos. El procedimiento completo, el modelo de respaldo y las unidades systemd
están en [`docs/deploy-rpi-cloudflare.md`](docs/deploy-rpi-cloudflare.md). Los secretos de producción no
forman parte del repositorio: se configuran en el archivo `.env` del servidor a partir de
[`.env.example`](.env.example).

Railway ya no se utiliza.

## Historial

El proyecto comenzó como varios repositorios independientes y se unificó en este monorepo el 2026-06-08.
Los historiales individuales no se migraron; solo se trasladó el código fuente.

## Licencia

[MIT](LICENSE), Copyright (c) 2026 S21-Projects.
