# Design: Claim evidence deletion (evidencia-borrado, P2)

## Technical Approach

Proposal approach A. The MS gets its own S3 client behind a narrow port, `EvidenciaAlmacen`,
scoped to `reclamo-evidencia/`. Two consumers use it:

1. **Anonymization path.** `UsuarioAnonimizacionService.anonimizar` copies the user's claim
   evidence keys before `ReclamoOrganizacion::anonimizar` clears them, then publishes
   `EvidenciaReclamoLiberadaEvento` inside the transaction. `EvidenciaBorradoListener`
   (`@TransactionalEventListener(AFTER_COMMIT)`, no `fallbackExecution`) hands the work to a small
   dedicated executor. The task lists `reclamo-evidencia/`, keeps the keys that belong to this
   user, merges them with the captured keys, deletes them, and records a count-only actividad
   through `registrarAislado`.
2. **Nightly sweep.** `EvidenciaHuerfanaBarridoJob` follows the `CoordenadasMinimizacionJob`
   template: Buenos Aires cron, `@EventListener(ApplicationReadyEvent)` catch-up, and the injected
   `Clock`. It deletes unreferenced, pattern-matching keys older than the grace period, up to a
   per-run cap. A kill switch can turn it off.

Wiring is conditional. A factory `@Bean` builds the S3 adapter only when the endpoint, bucket and
both credentials are non-blank. Otherwise it returns a no-op adapter and logs one startup
warning. H2 `@SpringBootTest` suites and `mvn test` therefore never touch S3. This change makes
no schema change and no access-rule change. The BFF, Astro and the Go worker are not modified.

## Architecture Decisions

### Decision: AWS SDK v2 dependency set

**Choice**: Import `software.amazon.awssdk:bom` in `<dependencyManagement>` through a new
`<aws.sdk.version>` property. Pin the latest 2.x patch at apply time, at or above `2.30.0` (the
SDK supports Java 8+, so Java 17 works). Add `software.amazon.awssdk:s3`, excluding
`netty-nio-client` and `apache-client`, and add `software.amazon.awssdk:url-connection-client`.
**Alternatives considered**: Default transitive HTTP clients (Netty and Apache add several MB for
a few calls a day on a Pi); Spring Cloud AWS (another starter and auto-configuration layer that
the no-op fallback would have to fight); MinIO Java SDK (a vendor client, while R2 is the
production target).
**Rationale**: This is the smallest footprint. `UrlConnectionHttpClient` is synchronous and has
no extra dependencies, which is enough for list and delete calls.

### Decision: S3 client configuration mirrors the BFF

**Choice**: `S3Client.builder()` with:
- `.endpointOverride(URI.create(endpoint))`
- `.region(Region.of(region))`, where `region` defaults to `auto`
- `.forcePathStyle(true)`
- `.credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(id, secret)))`
- `.httpClient(UrlConnectionHttpClient.create())`
- `.requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)` and
  `.responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)`

**Alternatives considered**: The default credentials chain (it would also probe instance metadata
and profiles, and it is implicit); virtual-host addressing (MinIO on `http://minio:9000` requires
path style).
**Rationale**: These are the same settings as `ts_hornero_bff/src/upload/upload.service.ts`
(`forcePathStyle`, region `auto`, explicit endpoint). `WHEN_REQUIRED` avoids the default
integrity checksums of SDK 2.30+ on optional operations, which some S3-compatible providers have
rejected. `DeleteObjects` still sends the checksum it requires. Manual MinIO verification covers
this setting.

### Decision: Conditional bean through a factory method, not `@ConditionalOnProperty`

**Choice**: `EvidenciaAlmacenConfig#evidenciaAlmacen(...)` reads `app.evidencia.s3.*` with empty
defaults. If any of endpoint, bucket, access key or secret is blank, it logs
`WARN [evidencia] object storage not configured: claim evidence will not be deleted` and returns
`EvidenciaAlmacenNoOp`. Otherwise it returns `EvidenciaAlmacenS3`, built with an
`S3Client`. The `S3Client` is closed on shutdown (`destroyMethod = "close"` on the adapter, which
delegates the close).
**Alternatives considered**: `@ConditionalOnProperty`. Compose passes empty strings, and an empty
property still counts as present, so the S3 bean would be created with blank values.
**Rationale**: An explicit blank check matches how the env vars actually arrive. It also yields
one bean of the port type, so injection sites stay simple.

### Decision: Port shape, scoped to claim evidence

**Choice**: See Interfaces. The port has `disponible()`, `listar()` (always the
`reclamo-evidencia/` prefix, with full `ListObjectsV2` pagination via
`listObjectsV2Paginator(...).contents()`), and `borrar(Collection<String>)`. `borrar` batches by
1000 (the `DeleteObjects` limit) with `quiet(true)` and returns deleted and failed counts from the
per-key `errors()`. The S3 adapter rejects any key outside `reclamo-evidencia/` with
`IllegalArgumentException` before calling S3.
**Alternatives considered**: A generic `listar(prefix)` or `borrar(prefix)`, which would let a
future caller sweep `org-evidencia/` by mistake; single `DeleteObject` calls (N round trips).
**Rationale**: The proposal requires that nothing outside `reclamo-evidencia/` is touched. A port
that cannot express another prefix enforces that at the boundary, with the key pattern checked as
a second guard.

### Decision: Find a user's objects with one full listing plus a pattern filter

**Choice**: The listener calls `listar()` and keeps the keys where
`ClaveEvidenciaReclamo.referenteId(key) == userId`. It unions those with the captured keys, which
pass through the same filter.
**Alternatives considered**: A delimiter fan-out, which lists the common prefixes
`reclamo-evidencia/{org}/` and then lists each `.../{userId}/`. That takes N+1 requests and stays
cheaper only if the evidence set grows very large. The other option was relying on captured keys
plus the sweep alone, which leaves stray uploads for 7 or more days.
**Rationale**: There are at most 3 keys per claim and few claims, so a single paginated listing
is a handful of requests. It reuses the same port call as the sweep and also catches stray
uploads (the P3 429 path) immediately. Revisit the fan-out if the listing exceeds about 10k keys.

### Decision: Shared key pattern

**Choice**: Move `ReclamoService.OBJECT_KEY_PATTERN` into a new final class
`org.example.reclamo.ClaveEvidenciaReclamo`. It exposes `PREFIJO = "reclamo-evidencia/"`,
`PATRON`, and `Optional<Long> referenteId(String key)`. `ReclamoService` uses `PATRON` with no
behavior change.
**Alternatives considered**: Duplicating the regex in the listener and the job, which would let
the copies drift.
**Rationale**: One definition of a valid claim key for validation, authorization and deletion.

### Decision: Event, listener and executor

**Choice**:
- The event is `record EvidenciaReclamoLiberadaEvento(Long usuarioId, List<String> keys)`, with
  the list copied through `List.copyOf`.
- It is published only when the user is a `Referente`. Only referentes file claims, and the stray
  objects live under their id.
- The listener runs on a dedicated `evidenciaExecutor`, a Spring `ThreadPoolTaskExecutor` with
  core 1, max 1, queue 50, daemon threads and the name prefix `evidencia-`.
- When `app.evidencia.async=false`, the bean is a same-thread executor (`Runnable::run`). The
  test `application.yml` sets it to `false`.
- A `TaskRejectedException` or any other `RuntimeException` raised on submit is logged and
  swallowed, as in `NotificacionListener`.

**Alternatives considered**: Reusing `mailExecutor`, which couples evidence deletion to mail
naming, mail pool sizing and the `NOTIFICACIONES_ENABLED` semantics. Running synchronously on the
request thread would add S3 latency, and the risk of a timeout, to the admin's response.
**Rationale**: This follows the existing N13 shape. A rolled-back anonymization publishes nothing
that gets delivered. The request thread never waits on R2. Tests stay deterministic, and unit
tests pass `Runnable::run` directly.

### Decision: Actividad types and detail format (counts only)

**Choice**: Add two `TipoActividad` values under "System housekeeping":
- `EVIDENCIA_RECLAMO_BORRADA` (per user)
- `EVIDENCIA_HUERFANA_BORRADA` (sweep summary)

There is no DB CHECK constraint on `accion` (no `scripts/sql` entry), so no migration is needed.
Every record is `.sistema()`, because the executor thread has no SecurityContext and the
anonymizing admin is already the actor of `USUARIO_ANONIMIZADO`. Records go through
`registrarAislado`. Formats:

| Case | Record |
|------|--------|
| Per-user success, n > 0 | `entidad("USUARIO", userId)`, detalle `"{n} archivos de evidencia de reclamos borrados"` |
| Per-user, n = 0 and no failures | nothing recorded (debug log only) |
| Per-user partial failure | `.fallo()`, detalle `"{ok} archivos borrados, {err} pendientes para el barrido"` |
| Per-user exception | `.fallo()`, detalle `"borrado de evidencia fallido ({ExceptionSimpleName}); lo reintenta el barrido"` |
| Sweep, deleted > 0 | `entidad("RECLAMO_EVIDENCIA", null)`, detalle `"{n} archivos de evidencia huérfanos borrados"` |
| Sweep, 0 deleted | nothing recorded; failures are logged at WARN only (as specified) |

`userId` is the entity id, which matches the existing `USUARIO_ANONIMIZADO` row, and the
anonymized account holds no personal data. Keys, org ids and paths never go into any field or log
line. Logs carry counts and exception class names only.
**Alternatives considered**: One type with a mode in the detail (harder to filter in the admin
log); recording the admin as the actor (needs the context propagated across threads).
**Rationale**: Closed enum (N10), filterable by kind, and compliant with the spec's "counts only".

### Decision: Sweep algorithm

**Choice**: `EvidenciaHuerfanaBarridoJob.ejecutar()` returns the deleted count.
1. If `!enabled` or `!almacen.disponible()`, return 0 with no listing.
2. `objetos = almacen.listar()`.
3. `referenciadas = reclamoRepository.findAllEvidenciaKeys()` (new JPQL
   `select k from ReclamoOrganizacion r join r.evidenciaKeys k`) as a `HashSet`. It is loaded once,
   after the listing, so it is never older than the listing.
4. `corte = clock.instant().minus(Duration.ofDays(graciaDias))`.
5. The candidates are the objects with `PATRON.matcher(key).matches()`,
   `ultimaModificacion.isBefore(corte)` and `!referenciadas.contains(key)`, sorted by
   `ultimaModificacion` ascending then key, limited to `maxPorCorrida`.
6. `ResultadoBorrado r = almacen.borrar(candidatos)`. Any `RuntimeException` is logged at WARN
   and the method returns 0.
7. If `r.borrados() > 0`, log at INFO and record `EVIDENCIA_HUERFANA_BORRADA`. If
   `r.fallidos() > 0`, log at WARN.

There is no `@Transactional` on the job (the N3 pitfall); the repository read uses its own
read-only transaction.

The schedule is `${app.evidencia.barrido.cron:0 50 3 * * *}` in zone
`America/Argentina/Buenos_Aires`, plus an `ApplicationReadyEvent` catch-up.
**Alternatives considered**: Checking the DB once per key (N queries); deleting by age alone
without the reference check (would destroy live evidence); a bucket lifecycle rule (cannot know
which keys are referenced).
**Rationale**: One set load fits easily in memory at this scale. The grace period covers the race
in which an upload has happened but its claim row is not committed yet. The cap and the kill
switch bound the damage after a DB restore.

### Decision: Configuration property names

```yaml
app:
  evidencia:
    async: true
    s3:
      endpoint: ${AWS_ENDPOINT_URL:}
      bucket: ${AWS_S3_BUCKET_NAME:}
      region: ${AWS_DEFAULT_REGION:auto}
      access-key-id: ${AWS_ACCESS_KEY_ID:}
      secret-access-key: ${AWS_SECRET_ACCESS_KEY:}
    barrido:
      enabled: ${EVIDENCIA_BARRIDO_ENABLED:true}
      gracia-dias: ${EVIDENCIA_BARRIDO_GRACIA_DIAS:7}
      max-por-corrida: ${EVIDENCIA_BARRIDO_MAX:500}
      cron: ${EVIDENCIA_BARRIDO_CRON:0 50 3 * * *}
```

These go in `jar_hornero_ms/src/main/resources/application.yml`. The project uses YAML, not the
`application.properties` named in the proposal. Every `@Value` also carries a default, because
the test `application.yml` replaces the main one. The test `application.yml` adds only
`app.evidencia.async: false`. The `s3.*` values stay absent, which selects the no-op adapter.

## Data Flow

```
Admin ─► BFF ─► MS UsuarioAnonimizacionService.anonimizar  (@Transactional)
                 │  keys = copy(reclamos.flatMap(evidenciaKeys))   ◄─ before anonimizar()
                 │  publish EvidenciaReclamoLiberadaEvento(userId, keys)
                 │  reclamos.forEach(anonimizar)  ...  COMMIT
                 ▼ (AFTER_COMMIT only)
          EvidenciaBorradoListener ─► evidenciaExecutor
                 │  listar() ─filter referenteId==userId─┐
                 │  keys     ─filter pattern+userId──────┴─► union ─► borrar() ─► S3 DeleteObjects
                 ▼
          ActividadService.registrarAislado (count / fallo)

Scheduler 03:50 BA + startup ─► EvidenciaHuerfanaBarridoJob
          enabled && disponible? ─► listar() ─► load referenced set ─► filter
          (pattern, age > grace, unreferenced) ─► cap ─► borrar() ─► summary actividad if > 0
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `jar_hornero_ms/pom.xml` | Modify | AWS BOM in `dependencyManagement`; `s3` (excluding netty and apache) and `url-connection-client` |
| `jar_hornero_ms/src/main/java/org/example/reclamo/ClaveEvidenciaReclamo.java` | Create | Prefix, pattern, `referenteId(key)` |
| `jar_hornero_ms/src/main/java/org/example/reclamo/ReclamoService.java` | Modify | Use `ClaveEvidenciaReclamo.PATRON` (no behavior change) |
| `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaAlmacen.java` | Create | Port, plus the `ObjetoAlmacenado` and `ResultadoBorrado` records |
| `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaAlmacenS3.java` | Create | S3 adapter (pagination, 1000-key batches, prefix guard) |
| `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaAlmacenNoOp.java` | Create | `disponible()=false`, empty list, zero result |
| `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaAlmacenConfig.java` | Create | Conditional adapter factory, startup warning, `evidenciaExecutor` |
| `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaReclamoLiberadaEvento.java` | Create | Event record |
| `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaBorradoListener.java` | Create | AFTER_COMMIT deletion and actividad |
| `jar_hornero_ms/src/main/java/org/example/evidencia/EvidenciaHuerfanaBarridoJob.java` | Create | Nightly sweep and catch-up |
| `jar_hornero_ms/src/main/java/org/example/user/UsuarioAnonimizacionService.java` | Modify | Inject `ApplicationEventPublisher`; capture the keys before line 103; publish for `Referente` |
| `jar_hornero_ms/src/main/java/org/example/domain/ReclamoOrganizacion.java` | Modify | `anonimizar` Javadoc: the objects are deleted after commit by `EvidenciaBorradoListener` |
| `jar_hornero_ms/src/main/java/org/example/domain/ReclamoOrganizacionRepository.java` | Modify | `findAllEvidenciaKeys()` |
| `jar_hornero_ms/src/main/java/org/example/actividad/TipoActividad.java` | Modify | `EVIDENCIA_RECLAMO_BORRADA`, `EVIDENCIA_HUERFANA_BORRADA` |
| `jar_hornero_ms/src/main/resources/application.yml` | Modify | `app.evidencia.*` block |
| `jar_hornero_ms/src/test/resources/application.yml` | Modify | `app.evidencia.async: false` |
| `jar_hornero_ms/src/test/java/org/example/evidencia/EvidenciaAlmacenEnMemoria.java` | Create | In-memory fake (`Map<String, Instant>`, optional forced failure) |
| `jar_hornero_ms/src/test/java/org/example/evidencia/EvidenciaBorradoListenerTest.java` | Create | Listener unit tests |
| `jar_hornero_ms/src/test/java/org/example/evidencia/EvidenciaHuerfanaBarridoJobTest.java` | Create | Sweep unit tests |
| `jar_hornero_ms/src/test/java/org/example/user/UsuarioAnonimizacionServiceTest.java` | Modify | Pass the mock publisher; assert the captured keys in the event |
| `ts_hornero_admin/src/lib/domain-ui.ts` | Modify | Labels: `'Evidencia de reclamos borrada'`, `'Evidencia huérfana borrada (automático)'` |
| `ts_hornero_admin/src/lib/domain-ui.actividad.test.ts` | Modify | Add both types to `MS_TIPOS` |
| `docker-compose.yml` | Modify | `ms` environment: same 5 `AWS_*` lines and defaults as `bff`, plus `EVIDENCIA_BARRIDO_ENABLED/_GRACIA_DIAS/_MAX/_CRON` |
| `docs/politica-datos-y-respaldo.md` | Modify | §1.6: move the evidence item out of "out of scope"; describe the deletion and the sweep; add a retention row |
| `docs/registro-actividades.md` | Modify | Document both new types (system actor, counts only) |
| `docs/deploy-rpi-cloudflare.md` | Modify | Restore note: set `EVIDENCIA_BARRIDO_ENABLED=false` **before** starting `ms` on a restored DB (the startup catch-up runs immediately) until reconciled; R2 tokens are scoped per bucket, so a separate MS token only separates revocation |
| `CLAUDE.md` | Modify | Object storage section: the MS now deletes claim evidence (`reclamo-evidencia/` only) |

Compose lines for `ms`:

```yaml
      # Claim evidence deletion (anonymization + nightly sweep). Same bucket and credentials as
      # the bff; only reclamo-evidencia/ is ever listed or deleted.
      AWS_ENDPOINT_URL: "${AWS_ENDPOINT_URL:-http://minio:9000}"
      AWS_S3_BUCKET_NAME: "${AWS_S3_BUCKET_NAME:-hornero-images}"
      AWS_ACCESS_KEY_ID: "${AWS_ACCESS_KEY_ID:-${MINIO_ROOT_USER:-hornero}}"
      AWS_SECRET_ACCESS_KEY: "${AWS_SECRET_ACCESS_KEY:-${MINIO_ROOT_PASSWORD:-hornero-minio-secret}}"
      AWS_DEFAULT_REGION: "${AWS_DEFAULT_REGION:-auto}"
      EVIDENCIA_BARRIDO_ENABLED: "${EVIDENCIA_BARRIDO_ENABLED:-true}"
      EVIDENCIA_BARRIDO_GRACIA_DIAS: "${EVIDENCIA_BARRIDO_GRACIA_DIAS:-7}"
      EVIDENCIA_BARRIDO_MAX: "${EVIDENCIA_BARRIDO_MAX:-500}"
      EVIDENCIA_BARRIDO_CRON: "${EVIDENCIA_BARRIDO_CRON:-0 50 3 * * *}"
```

`.env.example` stays untouched by the agent. Adding the `EVIDENCIA_BARRIDO_*` variables there is
a USER ACTION.

## Interfaces / Contracts

```java
package org.example.evidencia;

/** Claim evidence objects only: every key is under reclamo-evidencia/. */
public interface EvidenciaAlmacen {
    /** false for the no-op fallback (storage not configured). */
    boolean disponible();
    /** Every object under reclamo-evidencia/, all pages. */
    List<ObjetoAlmacenado> listar();
    /** Deletes in batches of at most 1000; keys outside reclamo-evidencia/ are rejected. */
    ResultadoBorrado borrar(Collection<String> keys);

    record ObjetoAlmacenado(String key, Instant ultimaModificacion) {}
    record ResultadoBorrado(int borrados, int fallidos) {
        public static final ResultadoBorrado VACIO = new ResultadoBorrado(0, 0);
    }
}

public record EvidenciaReclamoLiberadaEvento(Long usuarioId, List<String> keys) {}

public final class ClaveEvidenciaReclamo {           // org.example.reclamo
    public static final String PREFIJO = "reclamo-evidencia/";
    public static final Pattern PATRON = Pattern.compile("^reclamo-evidencia/(\\d+)/(\\d+)/[^/]+$");
    public static Optional<Long> referenteId(String key) { ... }  // empty when the key does not match
}
```

`borrar` with an empty collection returns `VACIO` without calling S3.

## Testing Strategy

Strict TDD (RED before GREEN). Keep the tests minimal, as the user asked. All MS tests use
`EvidenciaAlmacenEnMemoria`.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Listener: captured and stray keys of user X are deleted; keys of user Y and an `org-evidencia/` key stay; one EXITO actividad with count 3 and no key or path in the detail | `EvidenciaBorradoListenerTest`, executor `Runnable::run`, `ActividadService` mock with a `Registro` captor |
| Unit | Listener: the fake throws, nothing propagates, one FALLO actividad | same class |
| Unit | Sweep: an old unreferenced key is deleted; an old referenced key, a recent key, a non-pattern key and other prefixes stay; the summary is recorded | `EvidenciaHuerfanaBarridoJobTest`, `Clock.fixed`, repository mock |
| Unit | Sweep: cap 500 out of 600; 0 eligible records nothing; disabled performs no listing | same class (three small tests) |
| Unit | Anonymization publishes an event with the captured keys, taken before they are cleared | one test in `UsuarioAnonimizacionServiceTest` with a mock `ApplicationEventPublisher` |
| Integration | Boot and anonymization with no S3 config (no-op adapter) | existing `UsuarioAnonimizacionIntegrationTest` and the full `mvn test` (no new test) |
| Admin | Labels | `npm test` plus `npm run build` in `ts_hornero_admin` |
| Manual | S3 adapter against MinIO: pagination, `DeleteObjects`, checksum settings, prefix guard, sweep with `EVIDENCIA_BARRIDO_GRACIA_DIAS=0` | `make up-local`, upload evidence, anonymize, check the bucket with `mc ls` |

The rollback scenario relies on `@TransactionalEventListener(AFTER_COMMIT)` without
`fallbackExecution`, the same mechanism N13 uses. No dedicated test is added. Verify should
confirm the annotation.

## Threat Matrix

N/A. The change has no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary. The only new outbound channel is the S3 API,
guarded by the prefix and pattern filter.

## Migration / Rollout

- No schema change, no `scripts/sql` entry, no data migration.
- Deploy: rebuild `ms`. Compose passes `AWS_*` with the BFF's defaults, so the S3 adapter is
  active wherever the BFF's storage is. The first startup catch-up sweep runs immediately. With
  the 7-day grace period it removes only old orphans, such as evidence left by users anonymized
  before this change (their rows are already cleared), at most 500 per run.
- Kill switch: `EVIDENCIA_BARRIDO_ENABLED=false` and restart `ms`. Revert means reverting the
  commits; everything is additive.

## Open Questions

- [ ] Exact AWS SDK patch version (any version from `2.30.0` on): pin at apply time and confirm
      with `mvn dependency:tree` that no Netty or Apache client remains.
- [ ] Non-blocking: retention of evidence for decided claims of non-anonymized users (product
      decision, out of scope).
