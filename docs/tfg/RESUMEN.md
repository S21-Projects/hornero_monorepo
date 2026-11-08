# Resumen final de la Entrega 4

Rama `tfg/entrega-4`. Código evaluado en las corridas finales: commit `b1419c2` para microservicio, BFF y panel, y `08ead82` para Go y e2e (los commits posteriores solo tocan documentación). Fecha: 2026-11-08. Nada de esto está desplegado ni se hizo push.

Convenciones: "ya existía" es lo que el código tenía antes de la tarea; "implementado" es lo agregado en esta rama; "no aplica" es lo que el encargo o el borrador suponían y no existe en el proyecto; "pendiente del autor" requiere una decisión o una acción en la Raspberry Pi o en Cloudflare. Los commits están en `git log ca681d6..HEAD`; el seguimiento por tarea está en `odd/tasks/tfg-entrega-4.md`.

---

## a) Tareas, estado y archivos

| Tarea | Estado | Archivos principales |
|---|---|---|
| A1.1 a A1.3 Suites, cobertura, trazabilidad | Implementado (corrida final en la sección c y en el anexo) | `docs/tfg/anexo-e-pruebas.md` |
| A1.4 Benchmark 500 x 500 (RNF18) | Implementado (no existía); medido en M3 Pro, no en la Raspberry Pi | `go_algorithms_worker/internal/assign/ronda_benchmark_test.go` |
| A1.5 Invariante evento-nivel (RNF15 en `documento.md`) y determinismo (RNF16) | Invariante: ya existía. Determinismo: implementado (repetibilidad y, con D3, barajado) | `AcreditacionInvariantTest`, `ronda_determinismo_test.go`, `desempate_test.go` |
| A2 Reglas de negocio | Implementado (documento) | `docs/tfg/reglas-negocio.md` |
| A3 Cronograma real | Implementado (documento) | `docs/tfg/cronograma-real.md` |
| A4 Inventario técnico | Implementado (documento) | `docs/tfg/inventario.md` |
| B1 Diccionario de datos y ER | Implementado | `docs/tfg/anexo-d-modelo-datos.md`, `docs/tfg/diagramas/` |
| B2 Diagramas de clases y ER | Implementado | `docs/tfg/diagramas/` |
| B3 Diagrama de despliegue | Implementado sin Redis, que no existe (el encargo lo pedía: no aplica) | `docs/tfg/diagramas/despliegue-rpi.puml` y `.png` |
| B4 Secuencias de reasignación | Implementado | `docs/tfg/diagramas/` |
| C1 BCrypt costo 12 | Implementado (antes: costo 10 por defecto). El límite de 72 bytes ya existía | `ApplicationConfig.java`, `ApplicationConfigPasswordEncoderTest.java`, `docs/tfg/seguridad-c1.md` |
| C2 Sesiones | Ya existía: refresh en servidor, rotación, logout, revocación en reset y desactivación. Implementado: revocación por administrador y pruebas de cookies y e2e. No aplica: cambio de contraseña dentro de la sesión (no existe) | `UsuarioController.java`, `UsuarioService.java`, `usuarios.controller.ts`, `13-session-revocation.e2e.ts`, `docs/tfg/seguridad-c2.md` |
| C3 Evidencias | Ya existía: firma de contenido, nombre UUID, descarga autenticada, `/images` bloquea prefijos de evidencia. Implementado: solo JPEG, PNG y PDF, tamaño configurable, EXIF removido, `attachment`, evento de descarga, retención apagada. Pendiente del autor: `reclamo-evidencia/` sigue con EXIF y WebP; comprobar bucket sin acceso público | `upload.service.ts`, `evidence-image.ts`, `evidencia-files.controller.ts`, `EvidenciaAcreditacionRetencionJob.java`, `docs/tfg/seguridad-c3.md` |
| C4 Auditoría | Ya existía: bitácora de solo agregado en la aplicación. Implementado: cadena de hashes por organización, verificación diaria, ancla opcional, disparador V014 | `jar_hornero_ms/.../auditoria/`, `V014__organizacion_evento_inmutable.sql`, `docs/tfg/seguridad-c4.md` |
| C5 Respaldo | Ya existía: `backup.sh` diario, cifrado, temporizador. Implementado: subida por prefijos, simulacro con conteos y cadena, copia aditiva de evidencias apagada. Pendiente del autor: reglas de ciclo de vida en R2, tamaño del dump, simulacro real | `scripts/backup/`, `deploy/systemd/`, `docs/tfg/seguridad-c5.md`, `docs/tfg/prueba-restauracion.md` |
| C6 Dependencias y secretos | Implementado (auditorías, parches, Dependabot). Pendiente del autor: revisar 9 hallazgos de gitleaks; sin resultado de Maven (OWASP no corrió) | `.github/dependabot.yml`, `docs/tfg/seguridad-dependencias.md` |
| D1 RN-04 vencimiento de evidencias | Implementado (no existía); V015 pendiente en la Raspberry Pi | `VigenciaEvidenciaService.java`, `EvidenciaVigenciaJob.java`, `V015__evidencia_vencida.sql`, panel de administración |
| D2 RN-08 sin doble reasignación | Ya existía: `ReentrantLock` de un proceso, bloqueo de fila con re-chequeo, exclusión de la organización que rechazó. Implementado: `pg_try_advisory_lock` entre instancias, índice único V013 y prueba de concurrencia. No aplica: `UPDATE ... WHERE estado` (no cierra ninguna carrera abierta) | `RondaCerrojo.java`, `RondaService.java`, `V013__asignaciones_una_activa_por_donacion.sql` |
| D3 RN-05 desempate | Implementado (no existía) | `hungarian.go`, `ronda.go`, `scoring.go`, `desempate_test.go`, `EntradaRondaFactory.java` |
| D4 RF17 y RF18 | Decidido por el autor (opción A): RF17 y RF18 se redactan según lo que existe. Implementado: sección de cumplimiento en el legajo (entregadas, rechazadas y tasa simple, calculadas al leer y sin almacenar), también en la vista imprimible; el algoritmo y las reglas de conteo no cambian | `CumplimientoEnLegajo.java`, `LegajoResponse.java`, `AcreditacionService.java`, `DonacionRepository.java`, `legajo.tsx`, `14-acreditacion.e2e.ts`, `reglas-negocio.md` |
| D5 E2E de CU-07 a CU-10 y reasignación | Implementado | `e2e/tests/14-acreditacion.e2e.ts`, `15-reasignacion.e2e.ts` |
| E1 Datos de demostración | Implementado: `make demo-up`, `demo-seed`, `demo-reset`, `demo-verify`, `demo-down` en un proyecto de Compose propio | `scripts/demo/demo.sh`, `e2e/scenarios/demo-seed.ts`, `Makefile` |
| Entrega | Implementado: este documento y `docs/tfg/revision-word.md` | `docs/tfg/RESUMEN.md`, `docs/tfg/revision-word.md` |

Premisas del encargo y del borrador que no coinciden con el código (no aplican): Redis, PostGIS y Gin no existen. OTP y códigos de entrega están en PostgreSQL con hash BCrypt, la distancia es Haversine en Go y el worker usa `net/http`.

---

## b) Valores finales para el documento

### RN-01 a RN-09

| Regla | Valor final |
|---|---|
| RN-01 requisitos | Ocho constantes: N1 `SERVICIO_REGULAR_GRATUITO`, `NO_DISCRIMINACION`, `SEDE_INSCRIPTA_INDIVIDUALMENTE`; N2 `CONDICIONES_SANITARIAS_ADECUADAS`, `SIN_KIOSCO_MISMO_DOMICILIO`, `RADIO_50KM_BANCO_ALIMENTOS`; N3 `PERSONERIA_JURIDICA_O_AVAL`, `ACEPTA_AUDITORIAS_SIN_AVISO`. Los tres tipos de evidencia (declaración, foto, documento) valen para los ocho. Vigencia: 12 meses desde la aprobación (`EVIDENCIA_VIGENCIA_MESES`) |
| RN-02 niveles | N0: sin categorías, 0 necesidades, no público. N1: `NO_PERECEDERO`, 3 necesidades abiertas, público. N2: las tres categorías, 6, público. N3: las tres categorías, 12, público. N2 y N3 solo difieren en el cupo |
| RN-03 cambio de nivel | Un escalón por vez. La subida exige los requisitos del nivel destino aprobados y no vencidos a la fecha del cambio. Excepción: "validar organización" pasa a N1 sin evidencia. La bajada exige motivo |
| RN-04 vencimiento | 12 meses desde la aprobación; recordatorio 30 días antes; gracia de 30 días durante la cual la organización no puede subir; después, «Gracia vencida» en la cola y reducción manual por un administrador. Nunca hay reducción automática. Trabajo diario a las 00:20 (`0 20 0 * * *`) y al iniciar |
| RN-05 puntaje | `S = 0,30·D + 0,25·U + 0,17·P + 0,13·E + 0,15·C`. D: `min(d,3)/3`; U: urgencia o cercanía de vencimiento (`1 − días/30`); P: `exp(−km/8)`; E: `min(días/90,1)`; C: `(E+5·p0)/(E+F+5)`. Restricciones duras: organización que ya rechazó, categoría no admitida, sin artículo en común, distancia mayor a 30 km. Desempate: mayor puntaje, necesidad abierta hace más tiempo, menor id |
| RN-06 húngaro | Unidad indivisible: una donación completa por necesidad por ronda. Columna ficticia por donación con costo `0,10 × min(días en el fondo/90, 1)`. No considera cantidades (limitación conocida) |
| RN-07 sin respuesta | Oferta directa: cancelada a los 7 días. Propuesta del fondo común: vuelve al fondo a los 3 días. Aceptada o en camino más de 14 días, o pendiente de confirmación más de 7: se marca estancada, sin acción automática. Corrida diaria 00:15 y al iniciar |
| RN-08 sin doble reasignación | `pg_try_advisory_lock` de sesión (segundo intento: 409 `RONDA_EN_CURSO`), índice único parcial V013 (una `PROPUESTA` por donación), bloqueo de fila y re-chequeo al registrar, control optimista de versión, y la organización que rechazó no vuelve a recibirla |
| RN-09 código de entrega | 6 dígitos, vence a los 10 minutos, 5 intentos fallidos por código, hasta 5 códigos por ventana de 15 minutos con espera de 30 s, solo el hash BCrypt en PostgreSQL, uso único |

### Cookies y sesión

| Cookie | Producción | Desarrollo |
|---|---|---|
| `access_token` | `HttpOnly`, `Secure`, `SameSite=None`, 900 s | `HttpOnly`, `SameSite=Lax`, 900 s |
| `refresh_token` | `HttpOnly`, `Secure`, `SameSite=None`, 604800 s | `HttpOnly`, `SameSite=Lax`, 604800 s |
| `session_hint` (valor `1`) | sin `HttpOnly` por diseño, `Secure`, `SameSite=None`, 900 s | sin `HttpOnly`, `SameSite=Lax`, 900 s |

Contraseñas: BCrypt costo 12, rechazo de más de 72 bytes. El acceso vale 15 minutos tras revocar sesiones.

### Archivos, retención y CSP

| Tema | Valor |
|---|---|
| Tipos de evidencia de acreditación | JPEG, PNG y PDF, por firma de contenido; nombre UUID; EXIF y GPS removidos de JPEG y PNG; `attachment` y `nosniff` |
| Tamaño máximo | 5 MB por archivo; configurable con `UPLOAD_MAX_MB` |
| Retención de archivos de acreditación | 12 meses tras reemplazo o vencimiento (`EVIDENCIA_RETENCION_MESES`), apagada por defecto |
| Registro de actividad | 365 días (`ACTIVIDAD_RETENCION_DIAS`); correo de intento fallido 90 días; coordenadas precisas 30 días |
| Bitácora de acreditación | Sin retención; solo agregado; cadena de hashes por organización |
| Respaldo local | 14 días (`BACKUP_RETENTION_DAYS`) |
| Respaldo remoto | Tres prefijos (`daily/`, `weekly/`, `monthly/`). Retención objetivo 7/4/6 mediante reglas de R2 que **no están creadas**: la crea el autor |
| CSP | BFF: aplicada. Astro y panel: solo reporte salvo `CSP_MODE=enforce` |

### Conteos de pruebas (corrida final, commit `b1419c2`; Go y e2e de `08ead82`)

| Módulo | Pruebas | Pasadas | Fallidas | Omitidas | Cobertura de líneas |
|---|---|---|---|---|---|
| Microservicio (`mvn test -Pcoverage`) | 1276 | 1268 | 0 | 8 (PostgreSQL) | 91,85 % |
| BFF (`npx jest --coverage`) | 480 | 480 | 0 | 0 | 96,79 % |
| Panel (`npx vitest run --coverage`) | 707 | 707 | 0 | 0 | 86,63 % |
| Worker Go (`go test -json`) | 142 con subpruebas | 141 | 0 | 1 | por paquete, 2,5 % a 96,8 % |
| e2e (`make e2e`) | 151 | 151 | 0 | 0 | no aplica (D4 agregó una aserción en `14-acreditacion`, no ejecutada contra una pila) |
| Astro | sin pruebas; `npm run build` compila | | | | |

Panel: `npm run build` compila y `npm run lint` da 0 errores y 3 advertencias. Benchmark `Ronda500x500`: 217,9 ms por ronda en Apple M3 Pro (no en la Raspberry Pi). Total de pruebas automatizadas del documento: 1276 + 480 + 707 + 142 = 2605 (más 151 e2e), con las salvedades de las omitidas y de contar subpruebas de Go.

### Valores no medidos

| Valor | Estado |
|---|---|
| Tamaño del dump cifrado | **No medido** (requiere la Raspberry Pi) |
| Simulacro de restauración sobre un respaldo real | **No medido**; la tabla de `prueba-restauracion.md` está vacía. Solo hay una prueba del procedimiento con datos de demostración |
| Benchmark de la ronda en la Raspberry Pi (RNF18) | **No medido**; solo en M3 Pro |
| Tiempo de un hash BCrypt en la Raspberry Pi | **No medido**; 256 ms en M3 Pro |
| Vulnerabilidades de Maven | **No medido**: OWASP dependency-check no corrió |
| Comportamiento contra Cloudflare R2 y Resend reales | **No ejercitado**: los e2e usan MinIO y `MAIL_LOG_ONLY=true` |

---

## c) Diferencias entre el documento y el código

Resumen; el detalle con rutas está en `docs/tfg/reglas-negocio.md`, `inventario.md` y `revision-word.md`.

| Tema | Documento | Código |
|---|---|---|
| Tecnología | Redis, PostGIS, Gin | No existen: PostgreSQL, Haversine en Go, `net/http` |
| Numeración | RF, RNF y RN chocan entre `documento.md` y `correcciones-requerimientos.md` | Sin identificadores en el código ni en las pruebas |
| RF17 y RF18 | No figuran en `docs/tesis/` | RF17 existe en parte (coropleta por departamento); RF18 es el quinto término del puntaje, sin mostrarse en el legajo. Decisión pendiente del autor |
| RN-02 | Registro completo, N2 y N3 distintos | N2 y N3 habilitan las mismas categorías y solo cambian el cupo; no hay condición de registro completo |
| RN-03 | Elevación solo con todos los requisitos | "Validar organización" pasa a N1 sin evidencia |
| RN-04 | Sin definir | Un año, gracia de 30 días, reducción manual |
| RN-05 | NBI, min-max, FEFO, PostGIS | Pesos y normalizaciones propias, sin FEFO de lote; E es por organización |
| RN-06 | Cantidades parciales | No se comparan cantidades |
| RN-07 | Un solo plazo | 7 días (oferta directa), 3 días (propuesta) y dos ventanas de estancamiento |
| RN-08 | `UPDATE` condicional por estado | Bloqueo consultivo, índice único y re-chequeo con bloqueo de fila |
| Sesiones | `SameSite` restrictivo; cambio de contraseña | `SameSite=None` en producción; solo restablecimiento por correo |
| Evidencias | Bucket privado; bajas a los 30 días | Privacidad no verificable desde el repositorio; sin proceso de baja para acreditación; retención apagada |
| Auditoría | `UPDATE`/`DELETE` revocados al rol | El rol por defecto es superusuario e ignora `REVOKE`; protege el disparador V014 |
| Respaldo | Retención 7/4/6 y versionado | R2 no tiene versionado; retención por prefijos sin reglas creadas |
| Objetivo 3 | Reasignación de punta a punta | Vencimiento de propuesta y trabajo diario sin e2e; solo pruebas de integración. Donación aceptada y no retirada: se marca, no se reasigna |
| Objetivo 6 | Legajo exportado a PDF | Vista imprimible; el PDF lo genera el navegador |
| Mapa | Mapa de calor | Coropleta por departamento |
| Dependencias | Sin vulnerabilidades altas | BFF con 2 altas sin parche; e2e con 2 críticas (solo pruebas); sin análisis de Maven |

---

## d) Qué debe ocurrir en la Raspberry Pi y en Cloudflare

Ningún paso está ejecutado. Orden recomendado.

### 1. Cloudflare (antes de desplegar)

1. Comprobar que el bucket `hornero-images` tenga el acceso público directo desactivado (comparte bucket con las imágenes públicas).
2. Crear el bucket privado de respaldos y su token acotado, si no existe.
3. Crear tres reglas de ciclo de vida en ese bucket: `hornero/daily/` elimina a los 7 días, `hornero/weekly/` a los 28 y `hornero/monthly/` a los 186. No crear la regla única de 30 días sobre `hornero/`.
4. Si hubiera objetos anteriores sin prefijo (`hornero/hornero-...`), borrarlos o agregar una regla temporal con ese prefijo.
5. Opcional: segundo bucket para la copia de evidencias, tokens de lectura (origen) y escritura (destino) y su propia regla de vencimiento (por ejemplo, 90 días).
6. Decidir si se activa `CSP_MODE=enforce` (requiere navegar el sitio y el panel antes).

### 2. Raspberry Pi (despliegue y migración)

1. Actualizar el repositorio con la rama integrada por el autor.
2. `make backup`.
3. `docker compose up --build -d`. En el primer arranque `ddl-auto=update` agrega columnas y el microservicio sella los eventos existentes (`hash chain backfill complete`).
4. Comprobar `SELECT count(*) FROM organizacion_evento WHERE hash IS NULL;` = 0.
5. `make migrate`: hace respaldo y aplica en orden todos los `V*.sql` (idempotentes). Los nuevos son V013 (índice único de `PROPUESTA`; aborta con los ids si hay duplicados), V014 (disparador de solo agregado sobre `organizacion_evento`) y V015 (amplía los CHECK para `VENCIDA` y rellena `valido_hasta` de las evidencias aprobadas sin vencimiento: un año desde la revisión, con piso de 30 días desde la ejecución).
6. Reiniciar el microservicio y confirmar que el log no contiene `ESQUEMA_PENDIENTE`. En la prueba local con base vacía se observó 0 después de migrar y reiniciar.
7. Medir: tamaño del dump cifrado, tiempo de un hash BCrypt y de la ronda 500 x 500 en la Pi; ejecutar el simulacro de `prueba-restauracion.md`.
8. Completar `BACKUP_*` (opcionales) y probar `scripts/backup/backup.sh --no-upload` y luego una corrida real; comprobar los prefijos en el bucket.

### 3. Indicadores y su valor por defecto

| Variable | Servicio | Por defecto | Efecto |
|---|---|---|---|
| `EVIDENCIA_RETENCION_ENABLED` | MS | `false` | Borra archivos de acreditación reemplazados o vencidos hace `EVIDENCIA_RETENCION_MESES` (12). Irreversible. Respaldar antes y empezar con `EVIDENCIA_RETENCION_MAX=5` |
| `EVIDENCIA_RETENCION_MESES` / `_MAX` / `_CRON` | MS | `12` / `100` / `0 30 4 * * *` | Parámetros de la retención |
| `AUDITORIA_ANCLA_ENABLED` | MS | `false` | Publica el ancla diaria en `audit/anchors/`. Solo en la Pi |
| `AUDITORIA_CADENA_CRON` | MS | `0 40 3 * * *` | Verificación diaria de la cadena (siempre activa) |
| `EVIDENCIA_BORRADO_ENABLED` | MS | `false` | Borra evidencia de reclamos. Está en `true` en la Pi; nunca en local |
| `EVIDENCIA_BARRIDO_ENABLED` | MS | `true` | Barrido nocturno de huérfanos de evidencia de reclamos; la eliminación real exige `EVIDENCIA_BORRADO_ENABLED` |
| `EVIDENCIA_VIGENCIA_MESES` / `_GRACIA_DIAS` / `_RECORDATORIO_DIAS` / `_CRON` | MS | `12` / `30` / `30` / `0 20 0 * * *` | RN-04 |
| `DONACIONES_OFERTA_SIN_RESPUESTA_DIAS` / `_PROPUESTA_SIN_RESPUESTA_DIAS` | MS | `7` / `3` | RN-07 |
| `DONACIONES_EN_CURSO_ESTANCADA_DIAS` / `_CONFIRMACION_ESTANCADA_DIAS` | MS | `14` / `7` | Estancamiento (solo marca) |
| `RONDAS_AUTO_ENABLED` / `RONDAS_AUTO_CRON` | MS | `false` / `0 0 6 * * *` | Ronda programada |
| `NOTIFICACIONES_ENABLED` | MS | `true` | Correos de eventos y resumen diario |
| `ACTIVIDAD_RETENCION_DIAS` | MS | `365` | Purga del registro de actividad |
| `UPLOAD_MAX_MB` | BFF | `5` | Tamaño máximo de subida |
| `CSP_MODE` | Astro y panel | `report-only` | `enforce` bloquea |
| `SEED_DEMO_DATA` | MS | `false` | En producción exige `SUPER_ADMIN_EMAIL` y `SUPER_ADMIN_PASSWORD` |
| `BACKUP_S3_BUCKET` | script | sin definir | Sin él no hay copia remota |
| `BACKUP_WEEKLY_DAY` / `BACKUP_RETENTION_DAYS` | script | `7` / `14` | Prefijo semanal y poda local |
| `EVIDENCE_COPY_ENABLED` | script | `false` | Copia aditiva de evidencias; el temporizador está comentado y no se instala |

### 4. Decisiones del autor, fuera de este orden

Extender EXIF y WebP a `reclamo-evidencia/`; revisar los 9 hallazgos de gitleaks; habilitar Dependabot en GitHub; si se graba la demo, usar `make demo-up` local o desplegar la rama.
