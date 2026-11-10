# Auditoría: cadena de hashes, verificación diaria, anclas y permisos (C4)

Estado del código en la rama `tfg/entrega-4`. Las rutas con número de línea corresponden a esa rama.

## 1. Lo que ya existía

| Elemento | Dónde |
|---|---|
| Tabla `organizacion_evento`, de solo agregado en la aplicación: la entidad no tiene métodos de modificación y el repositorio solo expone `save` y dos consultas | `jar_hornero_ms/src/main/java/org/example/domain/OrganizacionEvento.java`, `OrganizacionEventoRepository.java` |
| Actor del evento: columnas `actor_usuario_id` y `actor_tipo` (el rol, o `SISTEMA`) | `OrganizacionEvento.java:65,69` |
| El actor se guarda en la aprobación de evidencia (`REQUISITO_APROBADO`), en la observación (`REQUISITO_OBSERVADO`) y en la subida de nivel y la reducción (`NIVEL_ELEVADO`, `NIVEL_REDUCIDO`) | `AcreditacionService.java:253-256`, `275-277`, `318`, `323` (el administrador se resuelve y se verifica con `requireAdministrador`) |
| Tabla `actividad`, inmutable en PostgreSQL mediante un disparador (UPDATE siempre rechazado; DELETE y TRUNCATE solo dentro de la purga por retención) | `scripts/sql/V004__actividad_inmutable.sql`; V006 permite además vaciar `email_intento` |
| Purga de `actividad` por antigüedad (365 días) y vaciado de `email_intento` (90 días) | `actividad/ActividadRetencionJob.java:42`, `EmailIntentoPurgaJob.java:64` |
| La anonimización de un usuario no toca `actividad` ni reescribe `organizacion_evento` (los eventos guardan el id del usuario, no sus datos personales) | `user/UsuarioAnonimizacionService.java:106` |

## 2. Dónde se registra cada hecho

El texto del borrador habla de "el registro de actividades" como si fuera un solo registro. En el código son dos tablas con propósito y ciclo de vida distintos:

| Hecho | Tabla | Actor | Cadena de hashes |
|---|---|---|---|
| Aprobación u observación de una evidencia | `organizacion_evento` | Sí (administrador) | **Sí** |
| Carga y reemplazo de evidencia | `organizacion_evento` | Sí (referente) | **Sí** |
| Cambio de nivel (subida o reducción) | `organizacion_evento` | Sí (administrador) | **Sí** |
| Registro, rechazo, reasignación de referente, reclamos y reportes resueltos, importación ReNaCoM | `organizacion_evento` | Sí, o `SISTEMA` | **Sí** |
| Intervención de un administrador sobre una entrega (`DONACION_OVERRIDE`) | `actividad` (más `override_admin_id` en `donaciones`) | Sí | No |
| Inicios de sesión y cierres, intentos fallidos, OTP, restablecimiento de contraseña | `actividad` | Sí o `ANONIMO` | No |
| Descarga de una evidencia por un administrador (`EVIDENCIA_ACREDITACION_DESCARGADA`) | `actividad` | Sí | No |
| Cambios de estado de donaciones y necesidades, activación y desactivación de usuarios | `actividad` | Sí o `SISTEMA` | No |

## 3. Alcance de la cadena: qué cubre y qué no

La cadena cubre **solo `organizacion_evento`**. Se descartó `actividad` por diseño, no por omisión:

- `actividad` se borra legalmente: el trabajo de retención elimina las filas de más de 365 días (`ActividadRetencionJob`), y `EmailIntentoPurgaJob` reescribe `email_intento` a los 90 días. Una cadena sobre filas que se eliminan o se reescriben por obligación legal se rompería sola, sin que nadie haya manipulado nada.
- `organizacion_evento` no se purga ni se reescribe en ningún camino del código: no hay `DELETE`, no hay `UPDATE` y la anonimización no la toca.

Qué se puede afirmar y qué no:

| Afirmación | ¿Se sostiene? |
|---|---|
| Los eventos de acreditación (evidencias, niveles, reclamos, reportes, reasignaciones) están encadenados con SHA-256 y una alteración, un borrado en el medio o un reordenamiento se detectan | Sí, con prueba |
| El borrado de los últimos eventos de una cadena se detecta | **Solo con el ancla.** Dentro de la tabla, una cola truncada es una cadena consistente más corta. El ancla publica el hash de la cabeza de cada cadena; la raíz del día siguiente no coincide |
| Los inicios de sesión, las descargas y los cambios de estado de donaciones están protegidos por la cadena | **No.** Están en `actividad`, protegida por el disparador V004 contra el SQL ad hoc, y sujeta a la retención |
| Un administrador del servidor no puede reescribir la historia | **No** (ver sección 9) |

Si más adelante se quisiera cubrir `actividad`, el camino sería una cadena tolerante a la purga: verificar desde la fila más antigua que sobrevive y excluir `email_intento` del contenido. No se hizo en esta entrega.

## 4. Diseño

### 4.1 Una cadena por organización, y por qué no puede bifurcarse

Los eventos se insertan desde transacciones concurrentes. Una cadena global obligaría a serializar a todos los escritores del sistema durante toda su transacción. Se eligió **una cadena por organización**: solo hacen cola entre sí los escritores de la misma organización, y esos son justamente los que deben estar ordenados.

`CadenaEventos.sellar` (en `jar_hornero_ms/src/main/java/org/example/auditoria/`) hace, dentro de la transacción que inserta:

1. `SELECT id FROM organizaciones WHERE id = ? FOR UPDATE`: bloqueo de fila de la organización, que se mantiene hasta el fin de la transacción.
2. Lee el hash del último evento de esa organización (o 64 ceros si no hay).
3. Calcula `hash = SHA-256(prev_hash || contenido_canónico)` y lo guarda junto con `prev_hash`.

Con el nivel de aislamiento por defecto de PostgreSQL (READ COMMITTED), el segundo escritor lee la cabeza después de que el primero confirmó, de modo que ve la cabeza nueva. Segunda barrera: el índice único `ux_evento_org_prev_hash (organizacion_id, prev_hash)` impide que dos eventos de una organización tengan el mismo predecesor; si un escritor futuro olvidara el bloqueo, el segundo `INSERT` falla en lugar de bifurcar la cadena. Los valores nulos (filas todavía sin sellar) son distintos entre sí en PostgreSQL, por lo que el índice se puede crear sobre una tabla con historia.

Pruebas (`CadenaConcurrenciaTest`), sobre H2 y sobre PostgreSQL 16 real: 8 hilos simultáneos escriben 10 eventos cada uno en la misma organización (80 predecesores distintos, cadena íntegra); 6 hilos sobre 3 organizaciones; el índice único rechaza una bifurcación insertada a mano; y mutación del código sin el bloqueo: la prueba falla con `duplicate key value violates unique constraint "ux_evento_org_prev_hash"`, es decir, la prueba detecta la ausencia del bloqueo y el índice evita el daño.

Límite conocido: una única transacción que escriba eventos de varias organizaciones en orden distinto al de otra transacción concurrente podría producir un interbloqueo; PostgreSQL aborta una de las dos con un error de deadlock y la operación se reintenta. No se observó en las pruebas.

### 4.2 Contenido canónico

`CadenaHash.java`. El contenido es la etiqueta de versión `HORNERO-EVENTO-V1` seguida de estos campos, en este orden: `organizacion_id`, `tipo`, `ocurrido_en`, `actor_usuario_id`, `actor_tipo`, `nivel_antes`, `nivel_despues`, `requisito`, `evidencia_id`, `motivo`, `payload`. Cada campo se codifica como `0x00` si es nulo, o `0x01`, longitud en 4 bytes (big-endian) y los bytes UTF-8. Esto distingue nulo de cadena vacía y evita ambigüedades al mover texto entre campos. El `id` no forma parte (no existe antes del `INSERT`); el orden de la cadena es el orden de los ids, y un borrado o reordenamiento rompe el enlace del siguiente evento. `organizacion_id` sí forma parte, de modo que un evento no se puede mover a otra organización.

Estabilidad a través de la base de datos:

- **Precisión de la marca de tiempo:** PostgreSQL guarda microsegundos; `Instant.now()` puede traer más. La entidad trunca a microsegundos al construirse (`OrganizacionEvento.java`, constructor) y el contenido canónico formatea siempre en UTC con exactamente seis decimales (`yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'`).
- **Zona horaria:** la columna es `timestamp with time zone`; la verificación la lee como `OffsetDateTime` y la convierte a instante. La prueba `theHashRoundTripsThroughTheDatabaseWhateverTheJvmTimeZone` escribe con la zona de la JVM en Buenos Aires, otra en Auckland y otra en UTC, más una fila heredada con desfase explícito, y verifica toda la cadena.
- **Nulos:** codificados con un byte propio, no como texto vacío.
- **Vector de prueba:** `CadenaHashTest.matchesAnIndependentlyComputedVector` fija un hash calculado con una implementación independiente en Python de la misma codificación.

### 4.3 Relleno de los eventos existentes (RNF07)

Aditivo: las columnas `prev_hash` y `hash` (VARCHAR(64), nulas) las crea `ddl-auto=update` al iniciar la nueva imagen, y el índice único también. No se modifica ningún dato existente fuera de esas dos columnas.

El relleno se hace **al iniciar el microservicio** (`CadenaArranque`, evento `ApplicationReadyEvent`) y no con un script SQL, porque la codificación canónica vive en Java: una segunda implementación en SQL podría divergir. Es idempotente (una fila ya sellada no se toca) y reanudable (una transacción por organización: tras una caída, cada organización queda sellada por completo o sin sellar). Se hace en orden de inserción (`ORDER BY id`) y paginado de a 500 filas. Además, si llega un evento nuevo para una organización cuya cabeza todavía no tiene hash, `sellar` completa antes el relleno de esa organización dentro de su propia transacción, de modo que no hace falta detener el servicio ni existe una ventana de carrera. Después del relleno, las filas existentes se verifican como cualquier otra (`VerificadorCadenaTest.sealingCompletesLegacyRowsAndTheyVerifyAfterwards`). No se aplicó a producción.

## 5. Verificación diaria y bajo demanda

- `VerificacionCadenaJob`: todos los días a las 03:40 (`AUDITORIA_CADENA_CRON`) y una vez al iniciar (la Pi puede estar apagada de madrugada), después del relleno.
- Bajo demanda: `GET /api/auditoria/cadena` en el microservicio, solo administrador. Verifica y devuelve el resultado; si hay un defecto lo registra igual que el trabajo diario; nunca publica ancla. El BFF no tiene una ruta para esto todavía (se invoca contra el microservicio, que solo escucha en 127.0.0.1).
- El verificador (`VerificadorCadena`) **solo lee**: nunca modifica datos. Recorre la tabla por páginas de 1000 filas con paginación por clave `(organizacion_id, id)`; en memoria solo hay la página actual y el estado de una cadena, por lo que el consumo no crece con la cantidad de eventos. Por fila comprueba el enlace con la fila anterior (`ENLACE`: detecta borrados, inserciones y reordenamientos) y que el hash guardado coincida con el recalculado (`CONTENIDO`: detecta una columna alterada). Tras un defecto se resincroniza con el hash guardado, de modo que una fila alterada produce un solo informe.
- Medición (Mac M3 Pro, no la Pi): relleno de 6000 filas en 1,6 s sobre PostgreSQL 16 en un contenedor local (0,17 s en H2) y verificación de 6003 filas en 31 ms. Es una medición del entorno de desarrollo; el tiempo en la Pi no se midió.
- Si la cadena está rota: `log.error` con el primer id roto, motivo y cantidad de defectos, y una entrada en `actividad` (`AUDITORIA_CADENA_ROTA`, actor `SISTEMA`, resultado `FALLO`, entidad `ORGANIZACION_EVENTO` con ese id). No se publica ancla ese día. No se altera ningún dato. Mientras el defecto persista, se repite cada día y en cada arranque.
- Filas sin sellar al final de una cadena se informan como `pendientes`, no como rotas; una fila sin sellar anterior a una sellada sí es un defecto (`SIN_SELLAR`).

Pruebas pedidas (`VerificadorCadenaTest`): alterar un evento a mano (`motivo`, `actor_usuario_id`) lo detecta en ese id; un borrado en el medio se detecta en el sucesor; una fila reordenada (intercambio de ids) se detecta; un evento movido a otra organización se detecta; el borrado de la cola **no** se detecta dentro de la tabla pero cambia la raíz del ancla (la prueba lo afirma explícitamente).

## 6. Anclas

Cada ejecución diaria con la cadena íntegra publica `audit/anchors/AAAA-MM-DD.txt` en el bucket, con este contenido:

```
hornero-audit-anchor v1
fecha: 2026-11-08
eventos: <cantidad>
cadenas: <organizaciones con eventos>
ultimo_evento_id: <id>
ultimo_evento_hash: <hash del evento más reciente>
raiz: <SHA-256 sobre "orgId:idCabeza:hashCabeza" de todas las cadenas, en orden>
```

La raíz resume la cabeza de todas las cadenas: si se borra la cola de cualquiera, la raíz de ese día difiere de la publicada el día anterior más los eventos legítimos nuevos (la comparación se hace a mano o con un script: el verificador no consulta el bucket).

**Seguridad del bucket (los entornos locales apuntan al bucket de producción):**

| Control | Detalle | Prueba |
|---|---|---|
| Bandera propia, apagada por defecto | `AUDITORIA_ANCLA_ENABLED` (`app.auditoria.ancla.habilitada`), por defecto `false`. No se reutiliza `EVIDENCIA_BORRADO_ENABLED` ni `EVIDENCIA_RETENCION_ENABLED` | `AnclaAuditoriaConfigTest` |
| Sin cliente S3 si está apagada | Con la bandera apagada, aun con credenciales completas, no se construye ningún cliente S3 (la fábrica del cliente nunca se invoca); el contexto por defecto usa el almacén nulo | `AnclaAuditoriaConfigTest.withTheFlagOffNoS3ClientIsEverBuilt_evenWithFullCredentials`, `AnclaAuditoriaPorDefectoTest` |
| Solo claves `audit/anchors/AAAA-MM-DD.txt` | La clave se arma a partir de una fecha y se valida contra la lista permitida antes de cualquier solicitud; `images/`, `org-evidencia/`, `reclamo-evidencia/`, `..`, rutas extra y claves vacías se rechazan | `AnclaAuditoriaAlmacenS3Test` |
| Nunca borra ni sobrescribe | La interfaz solo tiene `publicar` y `disponible`; el adaptador usa solo `HeadObject` y `PutObject`. Si el ancla del día ya existe, no la reemplaza (gana la primera del día) | `AnclaAuditoriaAlmacenS3Test.neverOverwrites...`, `hasNoWayToDeleteAnything` |
| La ruta pública `/images` no la sirve | `/images?key=` sirve cualquier clave del bucket menos las de una lista de prefijos denegados; sin cambios, `audit/anchors/...` se habría servido. Se agregó el prefijo `audit/` a la lista (con normalización: barras iniciales, `%2F`, `..`, mayúsculas) | `ts_hornero_bff/src/images/images.controller.spec.ts` (prueba "denies the audit anchor prefix") |

Las credenciales son las mismas `AWS_*` del resto del microservicio; no se versiona ninguna. Que el bucket no tenga acceso público directo en Cloudflare lo debe comprobar el autor en el panel: es la misma advertencia del informe C3, y el ancla comparte bucket con las imágenes públicas.

## 7. Permisos de base de datos

### 7.1 Qué se probó sobre la propiedad real de la tabla

Se probó en un PostgreSQL 16 descartable, con un rol que **es dueño de la tabla** (lo que produce `ddl-auto=update`, porque la aplicación crea sus tablas) y con un superusuario (lo que produce `docker-compose.yml`, donde `POSTGRES_USER` es `DB_USERNAME` y la aplicación se conecta con él):

| Caso | Resultado observado |
|---|---|
| `REVOKE UPDATE, DELETE, TRUNCATE ... FROM PUBLIC` y el dueño actualiza | Se ejecuta (`UPDATE 1`). Revocar a `PUBLIC` no afecta al dueño |
| `REVOKE UPDATE, DELETE, TRUNCATE ... FROM <dueño>` y el dueño actualiza, borra o trunca | `permission denied for table` en los tres casos |
| El dueño se devuelve el permiso con `GRANT` | Funciona de inmediato; el `UPDATE` vuelve a ejecutarse |
| El rol es superusuario y se le hace `REVOKE` | El `UPDATE` se ejecuta igual: los superusuarios no están sujetos a privilegios |
| Con el disparador instalado, el dueño y el superusuario actualizan o borran | Rechazado (`restrict_violation`). El dueño puede eliminar el disparador (`DROP TRIGGER`) y entonces reescribe la fila |

Conclusión: **`REVOKE` no es una barrera real** en este modelo de propiedad. Sirve contra errores y contra sentencias ad hoc de un rol que no sea dueño ni superusuario, pero el dueño se vuelve a otorgar el permiso y, con la configuración de la Pi (usuario superusuario), no tiene ningún efecto. Lo que sí se mantiene para todos los roles, superusuario incluido, es el disparador, mientras nadie lo elimine o desactive. Las pruebas están en `EventoInmutableScriptTest` (solo corren contra PostgreSQL real y se omiten en H2).

### 7.2 El script entregado

`scripts/sql/V014__organizacion_evento_inmutable.sql` (idempotente, transaccional, sigue el README de `scripts/sql`):

- Instala el disparador que rechaza `UPDATE`, `DELETE` y `TRUNCATE`, con una única excepción: sellar una fila heredada (`hash` y `prev_hash` nulos que pasan a no nulos sin cambiar nada más). Por eso **el relleno de la cadena sigue funcionando después de aplicar la protección**, antes o después del script, y solo una vez por fila.
- Hace `REVOKE DELETE, TRUNCATE` a `PUBLIC` y, si el rol que lo ejecuta no es superusuario, también a ese rol. `REVOKE UPDATE` solo se aplica si no queda ninguna fila sin sellar (para un dueño que no es superusuario, revocar `UPDATE` impediría el sellado). Con un superusuario avisa por `NOTICE` que la revocación no tiene efecto.
- Está registrado en `EsquemaVerificador` (`eventosInmutables()`): si falta el disparador, el microservicio registra `ESQUEMA_PENDIENTE` al iniciar.

SQL exacto:

```sql
-- V014: database-level immutability of the accreditation event log (C4).
--
-- organizacion_evento is append-only in the application (no setters, insert-only repository) and,
-- since C4, hash-chained (prev_hash / hash, see docs/tfg/seguridad-c4.md). This adds the same
-- guarantee inside PostgreSQL against ad-hoc SQL:
--
--   1. A trigger rejects every UPDATE, DELETE and TRUNCATE, for every role, superusers included
--      (triggers fire for them too). The single exception is the one-time sealing of a legacy row:
--      an UPDATE that takes a row with hash IS NULL AND prev_hash IS NULL to non-null values and
--      changes nothing else. That is what the MS startup backfill does, so the backfill keeps
--      working before or after this script, in either order.
--   2. REVOKE DELETE, TRUNCATE (and UPDATE, see below) from PUBLIC and from the role running this
--      script, when that role is not a superuser.
--
-- WHAT THIS DOES NOT PROTECT (do not claim otherwise):
--   * The MS connects as the role that owns the table (ddl-auto=update creates the tables with it).
--     An owner can GRANT the privileges back to itself and can DROP or DISABLE the trigger.
--   * With the default docker-compose the MS role is the POSTGRES_USER, a superuser: privilege
--     checks do not apply to it at all, so the REVOKE is a no-op for it (the script says so). Only
--     the trigger acts, and a superuser can drop it.
--   So the real tamper evidence is the hash chain plus the anchors in the bucket, not this script.
--   A role that is not the owner and holds only SELECT, INSERT would be a real barrier, but it needs
--   ddl-auto=update replaced by hand-run migrations (see docs/tfg/seguridad-c4.md, "Limits").
--
-- REVOKE UPDATE is applied only if no legacy row is still unsealed (it would block the sealing
-- UPDATE for a non-superuser owner). If rows are pending, the script says so: start the MS once so
-- the backfill seals them, then run this script again.
--
-- Idempotent and transactional. Requires the table and the chain columns, which the MS creates with
-- ddl-auto=update on its first boot with the C4 code: the script aborts with a clear message
-- otherwise. Run procedure: scripts/sql/README.md (make migrate). Always back up first.
-- Rollback: DROP TRIGGER organizacion_evento_inmutable ON organizacion_evento;
--           DROP TRIGGER organizacion_evento_inmutable_truncate ON organizacion_evento;
--           GRANT UPDATE, DELETE, TRUNCATE ON organizacion_evento TO <app role>;

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.organizacion_evento') IS NULL THEN
        RAISE EXCEPTION 'organizacion_evento table not found: start the MS once (ddl-auto=update creates it), then re-run';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organizacion_evento' AND column_name = 'hash') THEN
        RAISE EXCEPTION 'organizacion_evento.hash not found: start the MS with the C4 code once (ddl-auto=update adds the chain columns), then re-run';
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION organizacion_evento_inmutable() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.hash IS NULL AND OLD.prev_hash IS NULL
       AND NEW.hash IS NOT NULL AND NEW.prev_hash IS NOT NULL
       AND (to_jsonb(NEW) - 'hash' - 'prev_hash') = (to_jsonb(OLD) - 'hash' - 'prev_hash') THEN
        RETURN NEW; -- one-time sealing of a legacy row by the hash chain backfill
    END IF;
    RAISE EXCEPTION 'organizacion_evento es inmutable: % no esta permitido', TG_OP
        USING ERRCODE = 'restrict_violation';
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizacion_evento_inmutable ON organizacion_evento;
CREATE TRIGGER organizacion_evento_inmutable
    BEFORE UPDATE OR DELETE ON organizacion_evento
    FOR EACH ROW EXECUTE FUNCTION organizacion_evento_inmutable();

DROP TRIGGER IF EXISTS organizacion_evento_inmutable_truncate ON organizacion_evento;
CREATE TRIGGER organizacion_evento_inmutable_truncate
    BEFORE TRUNCATE ON organizacion_evento
    FOR EACH STATEMENT EXECUTE FUNCTION organizacion_evento_inmutable();

REVOKE UPDATE, DELETE, TRUNCATE ON organizacion_evento FROM PUBLIC;

DO $$
BEGIN
    IF (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
        RAISE NOTICE 'V014: % is a superuser, so privilege checks do not apply to it and REVOKE changes nothing for it; the trigger is the active protection', current_user;
        RETURN;
    END IF;
    EXECUTE format('REVOKE DELETE, TRUNCATE ON organizacion_evento FROM %I', current_user);
    IF EXISTS (SELECT 1 FROM organizacion_evento WHERE hash IS NULL) THEN
        RAISE NOTICE 'V014: UPDATE not revoked yet: legacy rows are still unsealed. Start the MS (it seals them) and re-run this script';
    ELSE
        EXECUTE format('REVOKE UPDATE ON organizacion_evento FROM %I', current_user);
        RAISE NOTICE 'V014: UPDATE, DELETE and TRUNCATE revoked from %; the owner can still grant them back to itself', current_user;
    END IF;
END
$$;

COMMIT;
```

Una barrera real requeriría un rol de ejecución que no sea dueño y tenga solo `SELECT, INSERT` sobre la tabla (y los permisos mínimos sobre el resto), lo que a su vez exige reemplazar `ddl-auto=update` por migraciones manuales. No se hizo ni se aplicó; el SQL de referencia sería:

```sql
CREATE ROLE hornero_app LOGIN PASSWORD '<definir fuera del repositorio>' NOSUPERUSER;
GRANT SELECT, INSERT ON organizacion_evento TO hornero_app;
GRANT USAGE ON SEQUENCE organizacion_evento_id_seq TO hornero_app;
-- el relleno (UPDATE de hash y prev_hash) tendría que correr con el rol dueño, no con hornero_app
```

## 8. Orden de despliegue en la Raspberry Pi

Nada de esto se aplicó a producción; son pasos para el autor.

1. Respaldo: `make backup`.
2. Desplegar la nueva imagen del microservicio (`docker compose up --build -d`). `ddl-auto=update` agrega `prev_hash`, `hash` y el índice único. Al terminar el arranque, `CadenaArranque` sella los eventos existentes y el trabajo verifica la cadena una vez. En el log: `hash chain backfill complete` y `hash chain verified`.
3. Comprobar que no quedan filas sin sellar: `SELECT count(*) FROM organizacion_evento WHERE hash IS NULL;` debe dar 0.
4. Aplicar el script: `make migrate` (hace respaldo y aplica los `V*.sql` en orden; V014 es idempotente). El orden 2-3-4 es el recomendado, pero el relleno funciona también si V014 se aplicó antes.
5. Reiniciar el microservicio y confirmar que el log no contiene `ESQUEMA_PENDIENTE` para `organizacion_evento`.
6. Opcional, después de decidir el bucket: poner `AUDITORIA_ANCLA_ENABLED=true` en el entorno de la Pi (nunca en un entorno local, que comparte el bucket) y reiniciar. La primera ejecución escribe `audit/anchors/AAAA-MM-DD.txt`. Comprobar su existencia en el panel de Cloudflare.

Restaurar un respaldo anterior a este cambio vuelve a dejar filas sin sellar: se vuelven a sellar al iniciar. Si además se había aplicado `REVOKE UPDATE` a un dueño sin superusuario, hay que devolver el permiso (`GRANT UPDATE`) antes de iniciar; con superusuario no hace falta.

## 9. Límites

- **Cadena sin clave.** SHA-256 sin secreto: quien pueda escribir en la base y conozca el algoritmo (que es público en el repositorio) puede alterar un evento y recalcular toda la cadena de esa organización. La alteración solo se delata comparando con un ancla publicada antes. Un HMAC con una clave fuera de la base elevaría el costo, pero la clave tendría que estar en el entorno del microservicio, el mismo servidor.
- **Un administrador del servidor que además tenga las credenciales del ancla puede reescribir ambos:** la base (eliminando el disparador, o como superusuario) y el bucket (las credenciales de escritura son las mismas `AWS_*`; un ancla ya publicada no se puede sobrescribir desde la aplicación, pero sí con las credenciales directas, salvo que el bucket tenga una regla de retención o bloqueo que lo impida, algo que no se verificó para este plan de Cloudflare).
- **Cola truncada:** solo el ancla la delata (sección 3). El verificador no compara con el bucket.
- **Solo `organizacion_evento`:** los inicios de sesión, las descargas y las intervenciones en entregas no están encadenados (sección 2).
- **El disparador y `REVOKE` no impiden al dueño ni al superusuario;** ver sección 7.1.
- **Un eventual interbloqueo** entre transacciones que escriban eventos de varias organizaciones en orden inverso (sección 4.1).
- La verificación se ejecuta en el mismo servidor que protege: si el microservicio estuviera comprometido, podría informar "íntegra".

## 10. Redacción sugerida para la tesis

> El microservicio mantiene una bitácora de eventos de acreditación (evidencias cargadas, aprobadas u observadas, cambios de nivel, reclamos, reportes y reasignaciones), de solo agregado. Cada evento guarda el actor y se encadena por organización: su hash es SHA-256 del hash del evento anterior concatenado con su contenido canónico. Un proceso diario verifica las cadenas sin modificar datos, deja constancia en el registro de actividad y en el log si detecta una discrepancia, y puede publicar en un bucket un ancla con la raíz de las cabezas de todas las cadenas. Un disparador de base de datos rechaza las modificaciones y los borrados de la bitácora. Esto permite detectar, no impedir, la alteración, el borrado intermedio y el reordenamiento de eventos; el borrado de los últimos eventos se detecta únicamente comparando con un ancla anterior. Los inicios de sesión, las descargas de evidencia y las intervenciones sobre entregas se registran en una tabla distinta (registro de actividad), inmutable frente a SQL ad hoc pero sujeta a una retención de 365 días y, por eso, fuera de la cadena. Un administrador del servidor con acceso a la base y a las credenciales del bucket puede reescribir ambos.

## 11. Pruebas y resultados

| Prueba | Qué fija |
|---|---|
| `CadenaHashTest` (7) | Vector independiente, determinismo, cada campo cubierto, nulo frente a vacío, límites de campo, truncamiento a microsegundos |
| `EventoSelladoTest` (3) | Enlace por organización, relectura desde la base, sellado heredado antes de un evento nuevo |
| `VerificadorCadenaTest` (11) | Cadena íntegra, alteración, actor alterado, borrado en el medio, reordenamiento, evento movido de organización, cola truncada, pendientes frente a huecos, paginación, relleno, 6000 filas |
| `CadenaConcurrenciaTest` (4) | Escritores concurrentes, varias organizaciones, índice único, zona horaria |
| `EventoInmutableScriptTest` (5, solo PostgreSQL) | Disparador para todos los roles, idempotencia, relleno posterior a la protección, excepción de sellado acotada, comportamiento de `REVOKE` con un dueño no superusuario |
| `AnclaAuditoria*Test`, `AuditoriaCadenaServicioTest`, `VerificacionCadenaJobTest`, `AuditoriaCadenaControllerTest`, `CadenaArranqueTest` | Bandera apagada sin cliente, lista de claves, sin borrado, error con primer id roto, ancla no publicada con cadena rota, permisos del endpoint |
| `EventoActorTest`, `DonacionServiceTest.overrideEstado_recordsTheAdministratorExplicitlyInTheActivityEntry` | Actor en aprobación, observación, subida y reducción de nivel; la intervención en una entrega nombra al administrador de forma explícita (antes dependía del contexto de seguridad) |
| `images.controller.spec.ts` | `/images` deniega `audit/` |

## 12. Variables de configuración

| Variable | Servicio | Por defecto | Efecto |
|---|---|---|---|
| `AUDITORIA_ANCLA_ENABLED` | MS | `false` | Publica el ancla diaria en `audit/anchors/`. Propia: independiente de las banderas `EVIDENCIA_*` |
| `AUDITORIA_CADENA_CRON` | MS | `0 40 3 * * *` | Horario de la verificación diaria |
