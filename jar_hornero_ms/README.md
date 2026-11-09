# jar_hornero_ms

Domain microservice of Hornero. It owns the business rules, the PostgreSQL schema and the JWT
issuer, and it is the real authorization authority of the system.

## Role in the chain

```
Browser -> ts_hornero_astro / ts_hornero_admin -> ts_hornero_bff :3001 -> jar_hornero_ms :8081 -> PostgreSQL :5432
                                                                              |
                                                                              +-> go_algorithms_worker :8090 (internal)
```

- Called only by the BFF (`JAVA_MS_URL`). In Docker the port is published on loopback only
  (`127.0.0.1:8081`); the browser never reaches it directly.
- Calls the Go worker over HTTP (`WORKER_URL`, `http://worker:8090` in Compose): `POST /v1/ronda` when an
  `ADMINISTRADOR` triggers `POST /api/rondas`, and `POST /v1/radio` to resolve the census radio of an
  organizacion. The MS starts without the worker; only rondas answer `503` while it is down.
- Issues the JWT (HS256, access token 15 min, refresh 7 days). `JWT_SECRET` must be identical in the MS
  and the BFF.

## Stack

Spring Boot 3.2.5, Java 17, Maven, Spring Data JPA (Hibernate), Spring Security, springdoc-openapi.

## Main modules

Source root: `src/main/java/org/example/`, one package per business area.

| Package | Responsibility |
|---|---|
| `auth`, `user` | Registration, login, OTP email verification, refresh rotation, password reset, user roles (`Administrador`, `Referente`, `Donante`) |
| `organizacion`, `reclamo`, `reporte` | Organizaciones, claims over unclaimed (ReNaCoM) organizaciones, community reports |
| `acreditacion`, `evidencia` | Accreditation levels (N1 to N3), evidence upload metadata and expiry, legajo |
| `necesidad`, `articulo` | Needs and the article catalogue |
| `donacion`, `asignacion` | Donations (direct and pooled), assignments, and `RondaController` / `RondaService` (rondas through the worker) |
| `auditoria`, `actividad` | Hash-chained accreditation event log and the append-only activity log |
| `idempotencia` | `Idempotency-Key` handling for business `POST` endpoints |
| `notificacion`, `mail` | Event emails and the admin daily digest (Resend, or log-only) |
| `config`, `common`, `domain` | Security configuration (`SecurityConfig`, `JwtAuthFilter`), schema checker (`EsquemaVerificador`), shared types |

Security rules: `/api/auth/**` and `GET` on `organizaciones`, `necesidades` and `donaciones` are public;
everything else needs a valid JWT. Keep these in sync with the BFF `RolesGuard` and the admin
`ProtectedRoute` (see the repository [`CLAUDE.md`](../CLAUDE.md)).

## Persistence

`spring.jpa.hibernate.ddl-auto=update` creates and widens tables from the entities. Changes that
`ddl-auto` cannot make (relaxing `NOT NULL`, widening `CHECK` constraints, triggers, indexes) are
hand-written idempotent scripts in [`../scripts/sql/`](../scripts/sql/README.md), applied with `make migrate`
from the repository root. At startup `EsquemaVerificador` reports any pending script, and the affected
feature degrades instead of the whole service failing.

## Run

The supported way is Docker from the repository root (`make up-local`, or `make up`); see the
[root README](../README.md). To run only the MS you need a reachable PostgreSQL and the variables below:

```bash
mvn spring-boot:run
```

- OpenAPI JSON: `http://localhost:8081/v3/api-docs` (public; also the Compose healthcheck, keep it public).
- Swagger UI: `http://localhost:8081/swagger-ui.html`.

## Tests

```bash
mvn test                                  # all tests
mvn test -Dtest=NecesidadServiceTest      # one class
mvn test -Dtest=NecesidadServiceTest#crea # one method
mvn -q test -Pcoverage                    # with JaCoCo: target/site/jacoco/index.html
```

`make coverage` at the repository root runs this profile together with the other services.

## Environment variables (names only)

Defined in the repository `.env.example` and wired in `docker-compose.yml` (service `ms`). Values are
never committed.

| Group | Variables |
|---|---|
| Server and database | `SERVER_PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` |
| Auth | `JWT_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SEED_DEMO_DATA` |
| Mail | `RESEND_API_KEY`, `MAIL_FROM_EMAIL` (falls back to `OTP_FROM_EMAIL`), `MAIL_LOG_ONLY`, `APP_PANEL_URL`, `PASSWORD_RESET_TTL_MINUTOS` |
| Worker | `WORKER_URL` |
| Scheduled jobs and retention | `RONDAS_AUTO_ENABLED`, `RONDAS_AUTO_CRON`, `NOTIFICACIONES_ENABLED`, `NOTIFICACIONES_DIGEST_CRON`, `ACTIVIDAD_RETENCION_DIAS`, `DONACIONES_*`, `DATOS_COORDENADAS_PRECISAS_DIAS` |
| Evidence storage and retention | `AWS_ENDPOINT_URL`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `EVIDENCIA_BORRADO_ENABLED`, `EVIDENCIA_BARRIDO_*`, `EVIDENCIA_RETENCION_*`, `EVIDENCIA_VIGENCIA_*`, `AUDITORIA_ANCLA_ENABLED`, `AUDITORIA_CADENA_CRON` |
| Misc | `DONANTE_PUBLICO` |

Without `SEED_DEMO_DATA=true` the MS refuses to start unless `SUPER_ADMIN_EMAIL` and
`SUPER_ADMIN_PASSWORD` are set. Evidence deletion and the audit anchor are opt-in (off by default); the
MS only deletes under the `reclamo-evidencia/` prefix.

## Related docs

- [`../docs/worker-asignacion.md`](../docs/worker-asignacion.md): how a ronda is scored and solved.
- [`../docs/tfg/reglas-negocio.md`](../docs/tfg/reglas-negocio.md): business rules extracted from this code.
- [`../docs/tfg/anexo-d-modelo-datos.md`](../docs/tfg/anexo-d-modelo-datos.md): data model.
- [`../docs/db-changes.md`](../docs/db-changes.md): schema changes log.
- [`../docs/security-access-token-httponly.md`](../docs/security-access-token-httponly.md): cookie and token posture.
- [`../docs/tfg/seguridad-c4.md`](../docs/tfg/seguridad-c4.md): audit hash chain.
