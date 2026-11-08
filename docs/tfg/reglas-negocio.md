# Reglas de negocio extraídas del código (Entrega 4)

Fuente de este documento: lectura directa del código del worktree `hornero_app-tfg` (rama `tfg/entrega-4`). Las referencias tienen la forma `ruta:línea` relativa a la raíz del repositorio. Cuando el código y la documentación difieren se registra la diferencia y se toma el código como válido. Los valores que no existen en el código se declaran como inexistentes; ninguno fue estimado.

Abreviaturas de rutas usadas en las citas:

- `MS/` = `jar_hornero_ms/src/main/java/org/example/`
- `MSR/` = `jar_hornero_ms/src/main/resources/`
- `GO/` = `go_algorithms_worker/internal/`

Ámbito de la comparación: se compara contra el borrador del autor (el texto "Borrador" de cada sección es el provisto en el encargo). El archivo `docs/tesis/correcciones-requerimientos.md` ya contiene una redacción de reglas numeradas RN01 a RN28; esa numeración es distinta de la del borrador (RN-01 a RN-09) y se indica en la sección "Numeración" al final.

---

## RN-01. Requisitos de acreditación

### Valores extraídos

El catálogo es el enum `RequisitoAcreditacion` (`MS/domain/RequisitoAcreditacion.java:11-60`). Cada constante guarda solo `nivelExigido` y `descripcion` (`MS/domain/RequisitoAcreditacion.java:62-68`). El enum no tiene ningún campo de vigencia, de tipo de evidencia admitido ni de duración en días.

| # | Requisito (constante) | Nivel en que se exige por primera vez | Fuente |
|---|---|---|---|
| 1 | `SERVICIO_REGULAR_GRATUITO` | N1 | `MS/domain/RequisitoAcreditacion.java:13-18` |
| 2 | `NO_DISCRIMINACION` | N1 | `MS/domain/RequisitoAcreditacion.java:20-24` |
| 3 | `SEDE_INSCRIPTA_INDIVIDUALMENTE` | N1 | `MS/domain/RequisitoAcreditacion.java:26-29` |
| 4 | `CONDICIONES_SANITARIAS_ADECUADAS` | N2 | `MS/domain/RequisitoAcreditacion.java:31-34` |
| 5 | `SIN_KIOSCO_MISMO_DOMICILIO` | N2 | `MS/domain/RequisitoAcreditacion.java:36-39` |
| 6 | `RADIO_50KM_BANCO_ALIMENTOS` | N2 | `MS/domain/RequisitoAcreditacion.java:41-46` |
| 7 | `PERSONERIA_JURIDICA_O_AVAL` | N3 | `MS/domain/RequisitoAcreditacion.java:48-55` |
| 8 | `ACEPTA_AUDITORIAS_SIN_AVISO` | N3 | `MS/domain/RequisitoAcreditacion.java:57-60` |

Acumulación: el nivel es acumulativo, es decir, un nivel destino exige todo requisito cuyo `nivelExigido` sea menor o igual al destino (`MS/acreditacion/AcreditacionService.java:424-441`, condición en la línea 429).

Tipos de evidencia admitidos:

- Los valores posibles son `DECLARACION`, `FOTO` y `DOCUMENTO` (`MS/domain/TipoEvidencia.java:4-8`).
- No existe un mapeo requisito a tipo de evidencia: cualquier requisito acepta cualquiera de los tres tipos. La única restricción de tipo es que `objectKey` solo se acepta con `FOTO` o `DOCUMENTO` (`MS/acreditacion/AcreditacionController.java:76-81`).
- Los archivos subidos admiten JPEG, PNG, WebP o PDF, detectados por los bytes (`ts_hornero_bff/src/upload/upload.service.ts:67-76`).
- El requisito 7 (`PERSONERIA_JURIDICA_O_AVAL`) menciona en su descripción ocho figuras (Asociación Simple, Asociación Civil, Fichero de Culto, Fundación, Cooperativa, Centro de Jubilados, Centro Vecinal, Aval de otra personería) en `MS/domain/RequisitoAcreditacion.java:53-55`. Esa lista aparece solo como texto de la descripción: una búsqueda en `jar_hornero_ms`, `ts_hornero_admin`, `ts_hornero_bff` y `ts_hornero_astro` no encontró ningún enum, validación ni campo que fuerce la elección de una de las ocho figuras.

Vigencia (modificada por RN-04, decisión del autor del 2026-11-08):

- La vigencia sigue siendo un par de fechas por fila de evidencia: `validoDesde` (por defecto, la fecha de hoy; `MS/domain/OrganizacionEvidencia.java:120`) y `validoHasta` (nullable; `null` significa que nunca vence).
- Estado previo a RN-04, que explica los datos heredados: quien cargaba la evidencia enviaba ambas fechas (`MS/acreditacion/dto/CargarEvidenciaRequest.java:16-22`) y el sistema no calculaba `validoHasta`. Por eso una fila podía tener `validoHasta` ingresada por el referente, o `null`.
- Ahora la aprobación fija `validoHasta` a la fecha de aprobación más `EVIDENCIA_VIGENCIA_MESES` meses (12 por defecto), igual para los ocho requisitos y los tres tipos de evidencia (`MS/acreditacion/AcreditacionService.java:261-262`; regla de fechas en `MS/acreditacion/VigenciaEvidencia.java:20-23`). Si la fila ya tenía una fecha anterior a esa, se conserva la anterior: un documento que vence antes no se extiende por la aprobación. Una fecha posterior se recorta al período configurado.
- Una evidencia está expirada si `validoHasta != null && validoHasta < hoy` (`MS/domain/OrganizacionEvidencia.java:177-179`). El valor se sigue derivando en lectura; además, el trabajo diario persiste el estado `VENCIDA` (ver RN-04).
- Filas existentes: el script `scripts/sql/V015__evidencia_vencida.sql` completa las filas `APROBADA` con `valido_hasta` nulo con `GREATEST(revisado_en + 1 año, hoy + 30 días)` y no modifica las que ya tienen fecha.

Estados de evidencia: `PENDIENTE`, `APROBADA`, `OBSERVADA`, `REEMPLAZADA` y, desde RN-04, `VENCIDA` (`MS/domain/EstadoEvidencia.java:7-13`). En el legajo los estados por requisito son `APROBADA`, `OBSERVADA`, `PENDIENTE`, `FALTANTE` y `VENCIDA` (`MS/domain/EstadoRequisitoLegajo.java:8-14`).

### Diferencias con el borrador

Borrador: "8 requisitos con nivel, evidencia admitida, vigencia en días por requisito".

| Aspecto | Borrador | Código |
|---|---|---|
| Cantidad de requisitos | 8 | 8 (coincide) |
| Nivel por requisito | Dato por completar | Extraído en la tabla anterior |
| Evidencia admitida por requisito | Dato por completar | No existe mapeo por requisito; los tres tipos valen para los ocho |
| Vigencia en días por requisito | Dato por completar | No existe por requisito. La vigencia es única para todos: un año desde la aprobación, configurable en meses (`app.evidencia.vigencia.meses`, 12 por defecto). Antes de RN-04 era una fecha opcional ingresada por el usuario; esa fecha se conserva si es anterior |
| Ocho figuras de personería | Implícito como regla | Solo texto descriptivo; no se valida |

---

## RN-02. Contenido de cada nivel

### Valores extraídos

Niveles: `N0` "REGISTRADA", `N1` "IDENTIFICADA", `N2` "OPERATIVA", `N3` "ACREDITADA" (`MS/domain/NivelAcreditacion.java:11-14`). Un nivel nulo se lee como N0 (`MS/acreditacion/AcreditacionService.java:84-86`).

Cupo de necesidades abiertas simultáneas (estados `ABIERTA` o `EN_PROGRESO`, `MS/necesidad/NecesidadService.java:44-45`):

| Nivel | Cupo | Fuente |
|---|---|---|
| N0 | 0 | `MSR/application.yml:63`; valor por defecto en `MS/config/AcreditacionProperties.java:20` |
| N1 | 3 | `MSR/application.yml:64`; `MS/config/AcreditacionProperties.java:21` |
| N2 | 6 | `MSR/application.yml:65`; `MS/config/AcreditacionProperties.java:22` |
| N3 | 12 | `MSR/application.yml:66`; `MS/config/AcreditacionProperties.java:23` |

Los cupos son configurables por las propiedades `app.acreditacion.cap-n0` a `cap-n3` (`MS/config/AcreditacionProperties.java:19-23`). El cupo se verifica en `MS/necesidad/NecesidadService.java:259-266` y se llama al crear (`:77-79`) y al relanzar (`:221-222`). Cuando `abiertas >= cap` responde 409.

Categorías habilitadas por nivel. Cada categoría tiene un nivel mínimo (`MS/domain/CategoriaAlimento.java:16-18`):

| Categoría | Nivel mínimo |
|---|---|
| `NO_PERECEDERO` | N1 |
| `REFRIGERADO` | N2 |
| `CONGELADO` | N2 |

El conjunto permitido por nivel se deriva de ese mínimo (`MS/acreditacion/AcreditacionService.java:391-399`), con este resultado:

| Nivel | Categorías habilitadas |
|---|---|
| N0 | ninguna |
| N1 | `NO_PERECEDERO` |
| N2 | `NO_PERECEDERO`, `REFRIGERADO`, `CONGELADO` |
| N3 | `NO_PERECEDERO`, `REFRIGERADO`, `CONGELADO` (ninguna categoría exige N3, por lo que N3 y N2 permiten lo mismo) |

La categoría de una necesidad se deriva como la más exigente de sus artículos (`MS/domain/CategoriaAlimento.java:38-45`; `MS/necesidad/NecesidadService.java:94-95`). Si el nivel de la organización es menor al mínimo de la categoría, la creación se rechaza con 409 (`MS/necesidad/NecesidadService.java:97-102`).

Condición para pasar a cada nivel (gate de la acción `cambiarNivel`): todos los requisitos con `nivelExigido <= destino` deben tener una evidencia `APROBADA` no expirada (`MS/acreditacion/AcreditacionService.java:313-317` y `:424-441`). En consecuencia:

| Nivel destino | Requisitos con evidencia `APROBADA` vigente exigidos por el gate |
|---|---|
| N1 | requisitos 1, 2, 3 |
| N2 | requisitos 1 a 6 |
| N3 | requisitos 1 a 8 |

Excepción de camino heredado: el botón heredado "validar organización" lleva la organización a N1 sin consultar requisitos ni evidencia (`MS/organizacion/OrganizacionService.java:182`, vía `MS/acreditacion/AcreditacionService.java:138-142`, cuyo comentario en `:130-137` declara que omite adrede el gate). El rechazo de registro no cambia el nivel (`MS/acreditacion/AcreditacionService.java:150-155`; `MS/organizacion/OrganizacionService.java:208`).

Visibilidad pública:

- Estado público derivado: nivel N1 o superior implica `estado = APROBADA` y `validada = true`; por debajo, `PENDIENTE` (se preserva `RECHAZADA`) (`MS/acreditacion/AcreditacionService.java:95-104`).
- Necesidades de una organización en N0 (o sin nivel): ocultas para todos salvo su referente y los administradores. Listado por organización: `MS/necesidad/NecesidadService.java:119-125`. Listado general: `MS/necesidad/NecesidadService.java:130-140` con la consulta `MS/domain/NecesidadRepository.java:30-36`. Detalle: 404 para el resto (`MS/necesidad/NecesidadService.java:145-152`).
- En N0 el cupo es 0, por lo que no se pueden crear necesidades abiertas (`MSR/application.yml:63`).
- Las necesidades vencidas (`VENCIDA`) se ocultan del listado público (`MS/necesidad/NecesidadService.java:114-127`).
- Para crear una necesidad también se exige que el referente tenga correo verificado (`MS/necesidad/NecesidadService.java:57`).

### Diferencias con el borrador

Borrador: "N0 registro completo, sin categorías, 0 necesidades abiertas, no público; N1 aprobada por admin; N2/N3 requisitos aprobados y vigentes; categorías y cupos por completar".

| Aspecto | Borrador | Código |
|---|---|---|
| N0: sin categorías, 0 necesidades | Coincide | Coincide (`MSR/application.yml:63`; categorías vacías por `CategoriaAlimento.java:16-18`) |
| N0: "registro completo" como condición | Condición | No existe una condición de "registro completo" para estar en N0: toda organización nueva nace en N0 (`MS/acreditacion/AcreditacionService.java:162-166` registra el evento con `nivelDespues = N0`) |
| N0 "no público" | Coincide | Coincide para necesidades (ver arriba). El estado público `APROBADA` solo se proyecta desde N1 |
| N1 "aprobada por admin" | Aprobación del admin | Hay dos caminos. (a) Botón heredado: el admin valida y pasa a N1 sin exigir evidencia. (b) Acción `cambiarNivel`: exige los requisitos 1 a 3 aprobados y vigentes |
| N2 y N3 | Requisitos aprobados y vigentes | Coincide con el camino (b); el camino (a) no aplica a N2 ni N3 porque solo lleva a N1 |
| Categorías y cupos | Por completar | Completados en las tablas anteriores. Dato a señalar: N2 y N3 permiten las mismas categorías |

---

## RN-03. Transiciones de nivel

### Valores extraídos

- Tabla de transiciones permitidas: N0 a N1; N1 a N0 o N2; N2 a N1 o N3; N3 a N2 (`MS/acreditacion/AcreditacionService.java:57-67`). Cualquier otra transición responde 400 (`:75-81`). Es decir, un escalón por vez, hacia arriba o hacia abajo.
- Solo un administrador puede cambiar el nivel: el servicio exige que el actor sea `Administrador` (`MS/acreditacion/AcreditacionService.java:289-296`, invocado en `:306`) y el endpoint tiene `@PreAuthorize("hasRole('ADMINISTRADOR')")` (`MS/acreditacion/AcreditacionController.java:114-120`).
- Subir: se exige `requisitosCompletos(org, destino)`; si no, 409 "Faltan requisitos aprobados y vigentes" (`MS/acreditacion/AcreditacionService.java:313-317`). El criterio de vigencia es `estado == APROBADA && !isExpirada()` (`:432-435`), es decir, `validoHasta` nulo o mayor o igual que la fecha de hoy (`MS/domain/OrganizacionEvidencia.java:154-156`).
- Bajar: el servicio exige un motivo no vacío (`MS/acreditacion/AcreditacionService.java:319-323`).
- Motivo: el DTO de la acción exige `motivo` con `@NotBlank` y `@Size(max = 1000)` en ambos sentidos (`MS/acreditacion/dto/CambiarNivelRequest.java:8-10`). La validación a nivel de servicio solo existe para bajar.
- Evento: `aplicarTransicion` es `@Transactional`; valida la transición, cambia el nivel, reproyecta el estado heredado y guarda `OrganizacionEvento.de(org, tipo, actor, motivo, antes, destino)` (`MS/acreditacion/AcreditacionService.java:116-128`). El nivel y el evento se escriben en la misma transacción. El tipo es `NIVEL_ELEVADO` o `NIVEL_REDUCIDO` (`MS/acreditacion/AcreditacionService.java:318,323`; `MS/domain/TipoEventoOrganizacion.java:31-35`).
- Campos del evento: `tipo`, `ocurridoEn`, `actorUsuarioId`, `actorTipo`, `nivelAntes`, `nivelDespues`, `requisito`, `evidenciaId`, `motivo`, `payload` (`MS/domain/OrganizacionEvento.java:53-87`).
- Invariante evento-nivel: `AcreditacionReplay.reconstruir` recorre los eventos desde N0 y toma el último `nivelDespues` no nulo (`MS/acreditacion/AcreditacionReplay.java:24-32`). Hay pruebas en `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionInvariantTest.java` y `AcreditacionReplayTest.java` (existen; no se ejecutaron).
- Una organización importada sin reclamar no admite cambios de nivel: 409 (`MS/acreditacion/AcreditacionService.java:119-122`).
- Notificación: tras `cambiarNivel` se publica `NivelAcreditacionCambiado` (`MS/acreditacion/AcreditacionService.java:327-328`).

### Diferencias con el borrador

Borrador: "un escalón arriba o abajo, siempre por un admin con motivo registrado; la elevación solo es válida si todos los requisitos del destino e inferiores tienen evidencia APROBADA con vencimiento posterior al cambio; evento con nivel previo, nuevo, admin, fecha y motivo en la misma transacción".

| Aspecto | Borrador | Código |
|---|---|---|
| Un escalón | Coincide | Coincide |
| Siempre por un admin | Coincide en `cambiarNivel` | El camino heredado `aplicarTransicionLegacy` (N0 a N1) también lo ejecuta un admin, pero sin gate de requisitos (`MS/acreditacion/AcreditacionService.java:138-142`) |
| Motivo registrado al subir | Obligatorio | Obligatorio por el DTO (`CambiarNivelRequest.java:10`); el servicio solo lo valida al bajar (`AcreditacionService.java:320`) |
| Vencimiento "posterior al cambio" | La evidencia debe vencer después del cambio | El criterio es "no expirada hoy": `validoHasta == null` o `validoHasta >= hoy` (`OrganizacionEvidencia.java:154-156`). Una evidencia que vence hoy mismo sigue siendo válida; no se compara contra el instante del cambio |
| Evento con nivel previo, nuevo, admin, fecha, motivo | Coincide | Coincide (`OrganizacionEvento.java:53-83`) |
| Misma transacción | Coincide | Coincide (`AcreditacionService.java:116-128`) |

---

## RN-04. Vencimiento de evidencias

### Valores extraídos

Propósito (decisión del autor, 2026-11-08): confirmar que los comedores siguen activos sin perjudicarlos de forma instantánea. Estado del código en la rama `tfg/entrega-4`.

| Aspecto | Comportamiento implementado | Fuente |
|---|---|---|
| Vigencia | `validoHasta = fecha de aprobación + EVIDENCIA_VIGENCIA_MESES` (12 por defecto); una fecha anterior ya presente en la fila se conserva | `MS/acreditacion/AcreditacionService.java:261-262`; `MS/acreditacion/VigenciaEvidencia.java:20-23`; `MS/resources/application.yml:127-134` |
| Estado nuevo | `EstadoEvidencia.VENCIDA`, asignado solo por el trabajo diario; tipo de evento nuevo `EVIDENCIA_VENCIDA` | `MS/domain/EstadoEvidencia.java:13`; `MS/domain/TipoEventoOrganizacion.java:56` |
| Trabajo diario | `EvidenciaVigenciaJob`: a las 00:20 (Buenos Aires, `EVIDENCIA_VIGENCIA_CRON`) y una vez al iniciar (RNF17: la Raspberry Pi puede estar apagada), con el patrón de `DonacionesEstancadasJob`. Una transacción por evidencia; una fila que falla se omite y se registra | `MS/acreditacion/EvidenciaVigenciaJob.java:28-34` |
| Transición | Cada `APROBADA` con `validoHasta < hoy` pasa a `VENCIDA` y se agrega un evento `EVIDENCIA_VENCIDA` con actor `SISTEMA` por el camino sellado de la cadena (C4). El evento no se modifica (el disparador V014 lo prohíbe); solo cambia el estado de la fila. Idempotente: una segunda ejecución no hace nada | `MS/acreditacion/VigenciaEvidenciaService.java:61-80` |
| Nivel | Nunca cambia automáticamente. El evento `EVIDENCIA_VENCIDA` tiene `nivelDespues = null`, por lo que no altera la reconstrucción del nivel (`AcreditacionReplay.reconstruir`, que solo considera eventos con `nivelDespues`) | `MS/acreditacion/AcreditacionReplay.java:24-32`; prueba `AcreditacionInvariantTest.expiringEvidenceNeverChangesTheDerivedLevelAndAnAdminCanStillLower` |
| Elevación | Una evidencia `VENCIDA` sigue bloqueando la elevación: el criterio es `estado == APROBADA && !isExpirada()` | `MS/acreditacion/AcreditacionService.java:445-452` |
| Necesidades abiertas | Sin cambios: no hay código que relacione el vencimiento con las necesidades; ninguna restricción nueva salvo el bloqueo de elevación | (ausencia de código; `NecesidadService.java:77-102,221-226` no consulta evidencias) |
| Gracia | `EVIDENCIA_VIGENCIA_GRACIA_DIAS` (30 por defecto) después de la fecha de vencimiento. Durante la gracia nada cambia. Pasada la gracia, la cola del administrador marca "Gracia vencida" y el administrador baja el nivel un escalón con motivo por el flujo manual existente (`cambiarNivel`). No existe reducción automática | `MS/acreditacion/VigenciaEvidencia.java:26-33`; `MS/acreditacion/AcreditacionService.java:515-523` |
| Reemplazo | El referente reemplaza la evidencia con el flujo existente (`cargarEvidencia` marca la anterior, también `VENCIDA`, como `REEMPLAZADA`); una nueva aprobación fija una nueva vigencia. Aprobar directamente una fila `VENCIDA` responde 409 | `MS/acreditacion/AcreditacionService.java:221-247` (reemplazo) y `:252-262` (aprobación) |
| Aviso al referente | Al vencer: correo con la fecha de vencimiento y el fin de la gracia. Antes de vencer: un único recordatorio `EVIDENCIA_VIGENCIA_RECORDATORIO_DIAS` (30 por defecto; 0 lo desactiva) antes de la fecha, marcado en `recordatorio_vencimiento_at` para no repetirlo. Usa el mecanismo existente de notificaciones (evento posterior a la confirmación de la transacción); el manejo de `MAIL_LOG_ONLY` no cambia | `MS/acreditacion/VigenciaEvidenciaService.java:61-110`; `MS/notificacion/NotificacionService.java:312-333`; `MS/mail/NotificacionesEmailTemplates.java:120-138` |
| Pestaña "Vencidas" | Sin cambio en la consulta (toda fila con `validoHasta` pasada, incluidas las `VENCIDA`: `MS/domain/OrganizacionEvidenciaRepository.java:81`). La respuesta agrega `graciaHasta` y `graciaVencida`; la pantalla muestra el estado "Vencida", "Venció el ...", "En gracia hasta el ..." o la insignia "Gracia vencida" | `ts_hornero_admin/src/routes/auditoria.tsx:57-80` |
| Legajo y página del referente | El estado `VENCIDA` se muestra en español; el mensaje indica el plazo de gracia | `MS/acreditacion/AcreditacionService.java:492`; `ts_hornero_admin/src/components/acreditacion/RequisitoCard.tsx:35-40,58-70` |

Reducción de nivel con requisitos `VENCIDA`: `cambiarNivel` hacia abajo solo exige un motivo no vacío y no consulta las evidencias (`MS/acreditacion/AcreditacionService.java:334-338`); la prueba `anAdminCanStillLowerTheLevelWhenRequirementsAreVencida` lo confirma.

Consistencia de `isExpirada()`: se lee en `AcreditacionService.java:450` (elevación), `:501` y `:517` (legajo y gracia) y en los DTO `EvidenciaResponse.java:39` y `EvidenciaEnColaResponse.java:47,64`. Todos son coherentes con `VENCIDA`, porque una fila `VENCIDA` siempre tiene `validoHasta` pasada. El único caso en que difieren es una fila `VENCIDA` con fecha futura editada a mano en la base de datos; la pantalla del referente la trata como vencida igualmente (`RequisitoCard.tsx:35-39`).

Interacción con la retención de archivos (`EvidenciaAcreditacionRetencionJob`, C3): la consulta de retención selecciona las filas con `validoHasta < hoy - N meses` sin mirar el estado (`MS/domain/OrganizacionEvidenciaRepository.java:59`). Por lo tanto, el archivo de una evidencia `VENCIDA` se borra recién N meses (12 por defecto, `EVIDENCIA_RETENCION_MESES`) después de su fecha de vencimiento, y solo si `EVIDENCIA_RETENCION_ENABLED=true` (apagado por defecto). La fila y sus eventos se conservan. La prueba `aVencidaRowIsACandidateOnlyNMonthsAfterItsExpiryDate` lo verifica.

Datos existentes (V015): las filas `APROBADA` con `valido_hasta` nulo reciben `GREATEST(revisado_en + 1 año, hoy + 30 días)`; así ninguna fecha asignada es anterior a la fecha del despliegue más 30 días y nadie queda vencido de inmediato. Las filas con fecha propia no se tocan; las que ya estaban vencidas pasan a `VENCIDA` al iniciar el microservicio y su gracia de 30 días cuenta desde ese vencimiento (si ya terminó, el administrador las ve de inmediato con "Gracia vencida"). El script y el orden de despliegue están en `docs/db-changes.md`.

### Diferencias con el borrador

Borrador: "job diario marca VENCIDA, registra evento, muestra en pestaña vencidas; política indecisa; evidencia vencida bloquea elevación; las necesidades continúan o se suspenden".

| Aspecto | Borrador | Código |
|---|---|---|
| Job diario que marca `VENCIDA` | Existe | Existe desde RN-04 (`EvidenciaVigenciaJob`); antes no existía |
| Estado `VENCIDA` de evidencia | Existe | Existe desde RN-04 |
| Evento al vencer | Se registra | Se registra `EVIDENCIA_VENCIDA` con actor `SISTEMA`, sellado en la cadena; no altera el nivel |
| Pestaña de vencidas | Existe | Existe; ahora muestra el estado, la fecha y si la gracia terminó |
| Evidencia vencida bloquea la elevación | Sí | Sí |
| Necesidades continúan o se suspenden | Indeciso | Continúan sin cambios (decisión del autor); no hay mecanismo de suspensión |
| Política de vigencia | Indecisa | Un año desde la aprobación, 30 días de gracia, reducción manual posterior por un administrador |
| Descenso de nivel por vencimiento | No mencionado | No es automático: lo decide el administrador después de la gracia |

---

## RN-05. Puntaje de asignación

### Valores extraídos

Fórmula (`GO/assign/scoring.go:288-293`), con los pesos normalizados por su suma (`GO/assign/scoring.go:115-127`):

`puntaje = wD*D + wU*U + wP*P + wE*E + wC*C`

con los cinco términos del tipo `Desglose` en `[0, 1]` antes de ponderar (`GO/assign/scoring.go:133-139`, `:280-286`).

Pesos por defecto (`GO/assign/scoring.go:146-152`; resueltos en `GO/contrato/ronda_v1.go:323-328`): déficit 0,30; urgencia 0,25; proximidad 0,17; espera 0,13; cumplimiento 0,15. La suma es 1,00. El Java no envía pesos (`MS/asignacion/EntradaRondaFactory.java:45-52` no los asigna), por lo que rigen los valores por defecto. Se admite un override por solicitud, que debe tener cada peso `>= 0` y al menos uno `> 0` (`GO/contrato/ronda_v1.go:184-198`). Cada ronda guarda los pesos usados (`MS/asignacion/RondaService.java:298-304`).

Parámetros por defecto (`GO/assign/scoring.go:182-189`): `DistanciaMediaKm` 8; `DistanciaMaximaKm` 30; `EsperaMaximaDias` 90; `DeficitMaximo` 3; `CumplimientoPseudoObs` 5 (`GO/assign/cumplimiento.go:6`); `PenalizacionNoAsignar` 0,10.

Normalización de cada término:

| Término | Fórmula exacta | Fuente |
|---|---|---|
| Déficit (D) | `min(deficit, DeficitMaximo) / DeficitMaximo`, con `DeficitMaximo = 3` | `GO/assign/scoring.go:282` |
| Urgencia (U) | `max(0, min(urgencia, 1))` | `GO/assign/scoring.go:283` |
| Proximidad (P) | `exp(-km / DistanciaMediaKm)`, `DistanciaMediaKm = 8`, `km` por Haversine con radio terrestre 6371 | `GO/assign/scoring.go:281`, `:191-201` |
| Espera (E) | `min(DiasDesdeUltimaDonacion / EsperaMaximaDias, 1)`, `EsperaMaximaDias = 90` | `GO/assign/scoring.go:284` |
| Cumplimiento (C) | `TasaCumplimiento` ya resuelta en `[0, 1]` | `GO/assign/scoring.go:285` |

Insumos de cada término, calculados en el microservicio (`MS/asignacion/EntradaRondaFactory.java:70-94`):

- Déficit: `v = (habitantes/comedores) / mediana(habitantes/comedores) * (1 + necesidades/comedores)` por radio censal (`MS/asignacion/VulnerabilidadCalculator.java:21-25,61-73`). Solo cuentan los radios con población y al menos un comedor (`:62`). La mediana usa el punto medio de los dos valores centrales cuando la cantidad es par (`:80-85`). Los comedores son organizaciones `APROBADA` o `SIN_RECLAMAR` (`:32-33`). Si la organización no tiene radio, o el radio no tiene dato, el trabajador usa 1,0 (neutral) (`GO/geo/deficit.go:32,114-127`).
- Urgencia: `max(base(prioridad), vencimiento)` con base URGENTE 1,0; MEDIA 0,6; NORMAL 0,3 y un término de vencimiento `1 - dias_hasta_vencimiento/30` acotado a `[0, 1]`, o 0 si no hay fecha (`MS/asignacion/UrgenciaCalculator.java:13-16,21-40`).
- Espera: días desde la fecha de oferta más reciente de una donación asociada a la organización cuyo estado no sea `CANCELADA` ni `RECHAZADA`; si no hay historial, 90 (`MS/asignacion/RondaService.java:63-64,225-232`; `MS/domain/DonacionRepository.java:40-43`; `MS/asignacion/EntradaRondaFactory.java:84-85`). Es una espera por organización, no por necesidad.
- Cumplimiento: `(E + m*p0) / (E + F + m)`, con `E` donaciones `ENTREGADA`, `F` donaciones `RECHAZADA`, `m = 5` y `p0` la tasa global de los candidatos de la ronda, o 0,5 si ninguno tiene historial (`GO/assign/cumplimiento.go:20-37,47-54`; conteos en `MS/asignacion/CumplimientoCalculator.java:25,29-44`; sin historial, la organización toma `p0`).
- Distancia: Haversine entre la donación y la organización (`GO/assign/scoring.go:194-201`). No se usa PostGIS.

Restricciones duras (par no asignable, `GO/assign/scoring.go:261-275`):

1. La organización está en `OrganizacionesExcluidas` de la donación (rechazó antes esa donación) (`:262-264`).
2. La categoría de la donación no está en `CategoriasAceptadas` de la necesidad, o no está en `CategoriasPermitidas` por el nivel (`:265-267`, `:203-224`). Conjunto vacío significa "acepta todo".
3. Si ambas partes declaran artículos y no hay ninguno en común (`:268-270`, `:231-245`).
4. Distancia mayor a `DistanciaMaximaKm = 30` (`:272-275`).

Elegibilidad previa a la ronda, en el microservicio (`MS/asignacion/RondaService.java:250-269`): la necesidad debe tener artículos, no estar vencida, pertenecer a una organización con nivel distinto de N0, tener referente y coordenadas. Las necesidades consideradas son las `ABIERTA` o `EN_PROGRESO` (`:62,220`).

"Necesidad ya cubierta": no hay una restricción dura específica. Cada necesidad es una columna que recibe como máximo una donación por ronda (ver RN-06), y las necesidades `CUMPLIDA` o `VENCIDA` quedan fuera por el filtro de estado.

Desempate (implementado en la entrega 4; antes no existía): el orden de preferencia es mayor puntaje, luego necesidad abierta hace más tiempo, luego menor id, y el resultado no depende del orden de entrada.

- Insumo nuevo: `diasAbierta`, los días desde `fechaPublicacion` de la necesidad, acotado en 0 si falta o es futura (`MS/asignacion/EntradaRondaFactory.java:77-79`). Viaja en el contrato v1 como campo opcional (`GO/contrato/ronda_v1.go:75`; validación `>= 0` en `:178-179`; mapeo en `:312`; `GO/assign/scoring.go:49-52`). No entra en el puntaje. La granularidad es de días: dos necesidades publicadas el mismo día se desempatan por id.
- Orden canónico antes de resolver: donaciones por id ascendente y necesidades por `diasAbierta` descendente y luego id ascendente (`GO/assign/ronda.go:59-61,121-139`).
- Criterio secundario lexicográfico dentro del solver (`GO/assign/hungarian.go:61-76`, `GO/assign/ronda.go:154-171`). Solo se compara cuando el costo primario (el puntaje total) es exactamente igual. Tres niveles: (1) usar primero las necesidades de mejor rango (más antiguas, luego menor id); (2) si no alcanzan para todas, asignar las donaciones de menor id; (3) emparejar las donaciones de menor id con las necesidades de mejor rango. Los niveles son enteros exactos, de modo que la comparación no depende del redondeo de punto flotante.
- Los puntajes guardados y el costo de oportunidad no se alteran: el total que devuelve el solver es solo el costo primario (`GO/assign/hungarian.go:171-175`).
- Orden de salida: puntaje descendente, luego rango de la necesidad, luego id de la donación (`GO/assign/ronda.go:101-119`); `SinAsignar` sale por id ascendente.
- Consultas del MS con orden fijo: candidatas por `fechaPublicacion` ascendente con nulos al final y luego id (`MS/domain/NecesidadRepository.java:54-56`); fondo común por id (`MS/domain/DonacionRepository.java:29-31`). Con el orden canónico del worker esto ya no condiciona el resultado, pero evita que la entrada dependa del orden físico de PostgreSQL.
- Pruebas: `TestDesempateAntiguedadLuegoID`, `TestDesempateElPuntajeMayorPrevalece`, `TestDesempateEntreDonacionesGanaElMenorID`, `TestDesempateEmparejaMenorIDConLaMasAntigua` y `TestRondaEsDeterministaConEmpatesExactos` (40 semillas, 8 barajados cada una, comparación completa del resultado) en `GO/assign/desempate_test.go`. La regla secundaria se verifica contra fuerza bruta en `TestHungarianLexMinimizaElDesempateEntreOptimos` (400 matrices con empates frecuentes). Un orden canónico por sí solo demuestra determinismo pero no la regla enunciada; por eso la regla está dentro del solver y se prueba contra el óptimo lexicográfico. Del lado del MS: `EntradaRondaFactoryTest` (dos casos de `diasAbierta`) y `RondaConsultasOrdenIntegrationTest` (sobre H2: prueba que se aplica el `ORDER BY`, no el orden físico de PostgreSQL; en el fondo común el orden natural de H2 ya coincide con el id, por lo que esa consulta no tuvo prueba en rojo).
- Costo medido: `BenchmarkRonda500x500` pasó de 119-129 ms a 210 ms por ronda y de 10,9 MB a 35,7 MB (Apple M3 Pro, no la Raspberry Pi).
- Límite del criterio: si dos matchings coinciden en puntaje total y en los tres niveles, el resultado sigue dependiendo del orden canónico, que es determinista. Dos matchings con puntajes totales iguales en la matemática pero distintos en el último bit de punto flotante no se consideran empate.

Costo de oportunidad guardado: `mejorScore(fila de la donación, solo columnas reales) - puntaje asignado`, donde `mejorScore` toma el mayor puntaje de esa donación ignorando a las demás (`GO/assign/ronda.go:89,137-145`). El piso es 0. Se persiste en `Asignacion.costoOportunidad` (`MS/domain/Asignacion.java:73-74`; `MS/asignacion/RondaService.java:354`), junto con puntaje, distancia, los cinco términos, `deficitFuente` y `codigoRadio` (`MS/domain/Asignacion.java:79-101`; `MS/asignacion/RondaService.java:353-365`).

### Diferencias con el borrador

Borrador: `S(d,n)= wV V + wU U + wP P + wE E + wH H` con pesos que suman 1.

| Aspecto | Borrador | Código |
|---|---|---|
| Cinco términos y pesos que suman 1 | Sí | Sí: 0,30 / 0,25 / 0,17 / 0,13 / 0,15 (suman 1,00). Además los pesos se normalizan por su suma |
| V (vulnerabilidad) | NBI del radio censal más cobertura, min-max sobre los radios de la ciudad | No hay NBI en el código (ninguna ocurrencia de "NBI" fuera de archivos ajenos). V es `habitantes/comedores` dividido por la mediana, multiplicado por `1 + necesidades/comedores`, acotado en 3 y dividido por 3. No es min-max |
| U (urgencia) | Días al vencimiento FEFO del lote | No hay FEFO ni vencimiento del lote. U depende de la prioridad de la necesidad y de la cercanía del vencimiento de la necesidad |
| P (proximidad) | Distancia con PostGIS | Haversine en Go: `exp(-km/8)`. No se usa PostGIS para esto |
| E (espera) | Días que la necesidad lleva abierta | Días desde la última donación de la organización (anti-inanición por organización) |
| H (historial) | Entregas confirmadas sobre asignaciones aceptadas | `(E + 5*p0)/(E + F + 5)`, con E donaciones `ENTREGADA` y F donaciones `RECHAZADA`; las canceladas y las no terminales no cuentan |
| Restricción: categoría no habilitada por nivel | Sí | Sí |
| Restricción: categoría de la donación distinta de la de la necesidad | Sí | Sí, además de exigir artículo en común |
| Restricción: organización N0 o rechazada | Sí | N0 se filtra antes de la ronda (`RondaService.java:262-264`). "Rechazada" como organización no se filtra aquí; lo que se excluye es la organización que rechazó esa donación |
| Restricción: distancia mayor a X km | X por definir | X = 30 km |
| Restricción: necesidad ya cubierta | Sí | No hay restricción propia (ver arriba) |
| Desempate por necesidad más antigua y luego id | Sí | Sí (desde la entrega 4): mayor puntaje, necesidad abierta hace más tiempo, menor id. "Más antigua" se mide en días desde `fechaPublicacion`, no desde la fecha de apertura exacta; el último criterio se aplica además a las donaciones |
| Costo de oportunidad | Mejor alternativa descartada menos asignado | Mejor puntaje propio de la donación (ignorando a las demás) menos el asignado |

---

## RN-06. Matriz del algoritmo húngaro

### Valores extraídos

- Filas: una por donación del fondo común en estado `OFRECIDA` y sin necesidad (`MS/domain/DonacionRepository.java:29-33`; `MS/asignacion/RondaService.java:216-218`). Cada donación es indivisible y se asigna entera.
- Columnas reales: una por necesidad candidata, no por unidad de la necesidad (`GO/assign/ronda.go:66`, `GO/assign/scoring.go:312-326`). No se replican las necesidades: cada necesidad recibe como máximo una donación por ronda.
- Una organización con dos necesidades abiertas puede recibir dos donaciones (`GO/assign/ronda.go:41-48`).
- Relleno de la matriz: no hay filas ficticias. Se agrega una columna ficticia por donación (`realCols + n` columnas), con costo `costoDescarte(donación)` en su propia fila e `Inf` en las demás filas (`GO/assign/ronda.go:106-124`). Así siempre hay al menos tantas columnas como filas, que es lo que exige el solver (`GO/assign/hungarian.go:30-33`).
- Costo de una celda factible: `-puntaje` (`GO/assign/scoring.go:322`), es decir, el solver minimiza el costo negativo del puntaje. No es `1 - S`.
- Costo prohibitivo: `Inf = math.MaxFloat64 / 4` (`GO/assign/hungarian.go:12`), asignado a los pares infactibles (`GO/assign/scoring.go:317-320`).
- Costo de dejar sin asignar: `PenalizacionNoAsignar * min(diasEnFondo / EsperaMaximaDias, 1)`, con 0,10 y 90 por defecto (`GO/assign/ronda.go:127-133`). `diasEnFondo` son los días desde `fechaOferta` (`MS/asignacion/EntradaRondaFactory.java:63-64`). Con penalización 0 el costo es 0 (`GO/assign/ronda.go:128-129`). Un par con puntaje 0 tiene costo 0 y no se asigna, porque la asignación exige costo estrictamente negativo (`GO/assign/ronda.go:74`).
- Tratamiento de lo descartado: una donación queda sin asignar si el solver le da la columna ficticia, ninguna columna, una columna fuera de rango, o un par con costo `>= 0` (`GO/assign/ronda.go:74-78`). Esas donaciones permanecen en el fondo común para la próxima ronda (siguen `OFRECIDA` y sin necesidad; no se modifican en `persistirResultado`).
- Escritura del resultado: por cada asignación, se bloquea la donación con `findByIdForUpdate` y se descarta el par si ya no es `OFRECIDA` o ya tiene necesidad, o si la necesidad ya no está `ABIERTA` o `EN_PROGRESO` (`MS/asignacion/RondaService.java:313-323`). El conteo `descartadas` de la ronda registra esos pares (`:339`).
- Cantidades parciales: el algoritmo no considera cantidades. `Donacion` y `Candidato` del solver no tienen campo de cantidad (`GO/assign/scoring.go:10-35,45-99`) y la necesidad no tiene cantidad. La cantidad existe solo en las líneas de la donación (`MS/domain/DonacionLinea.java:39`). No hay tratamiento de excedentes ni de cantidades parciales: una donación se asigna entera a una necesidad, y esa necesidad queda con una propuesta, sin comparar cantidades.
- Algoritmo: Jonker-Volgenant, variante de camino mínimo aumentante de Kuhn-Munkres, orden `O(filas^2 * columnas)` (`GO/assign/hungarian.go:14-16`).

### Diferencias con el borrador

Borrador: "el lote es la unidad, indivisible en una ronda; cada necesidad tiene tantas columnas como lotes puede recibir; filas o columnas ficticias a costo cero para cuadrar; costo de celda 1 - S; costo prohibitivo para pares descartados; asignaciones ficticias descartadas y cantidad pendiente actualizada; las donaciones sin asignar quedan para la próxima ronda; excedente permitido o evitado".

| Aspecto | Borrador | Código |
|---|---|---|
| Unidad indivisible | "Lote" | La donación completa (`Donacion`); no existe el concepto de lote en el código |
| Columnas por necesidad | Tantas como lotes pueda recibir | Una columna por necesidad; una donación por necesidad por ronda |
| Relleno con filas o columnas ficticias a costo cero | Filas o columnas | Solo columnas ficticias, una por donación, con costo de descarte `0,10 * min(dias/90, 1)`, no cero (cero solo si la penalización vale 0) |
| Costo de celda | `1 - S` | `-S` |
| Costo prohibitivo | Sí | Sí: `Inf = MaxFloat64/4` |
| Cantidad pendiente actualizada | Sí | No existe: el algoritmo no maneja cantidades |
| Sin asignar quedan para la próxima ronda | Sí | Sí |
| Excedente permitido o evitado | Por definir | No hay política de excedente; no se comparan cantidades |

---

## RN-07. Plazos de "sin respuesta" y "estancada"

### Valores extraídos

Propiedades en `MSR/application.yml:51-61` y valores por defecto replicados en `MS/donacion/VentanasDonacion.java:14-20`:

| Concepto | Propiedad | Variable de entorno | Valor por defecto | Fuente |
|---|---|---|---|---|
| Oferta `DIRECTA` en estado `OFRECIDA` sin respuesta | `app.donaciones.oferta-sin-respuesta-dias` | `DONACIONES_OFERTA_SIN_RESPUESTA_DIAS` | 7 días | `MSR/application.yml:57` |
| Propuesta del fondo común sin respuesta | `app.donaciones.propuesta-sin-respuesta-dias` | `DONACIONES_PROPUESTA_SIN_RESPUESTA_DIAS` | 3 días | `MSR/application.yml:58` |
| Donación `ACEPTADA` o `EN_CAMINO` estancada | `app.donaciones.en-curso-estancada-dias` | `DONACIONES_EN_CURSO_ESTANCADA_DIAS` | 14 días | `MSR/application.yml:59` |
| Donación `PENDIENTE_CONFIRMACION` estancada | `app.donaciones.confirmacion-estancada-dias` | `DONACIONES_CONFIRMACION_ESTANCADA_DIAS` | 7 días | `MSR/application.yml:60` |
| Cron del job | `app.donaciones.estancadas-cron` | `DONACIONES_ESTANCADAS_CRON` | `0 15 0 * * *` (00:15, zona America/Argentina/Buenos_Aires) | `MSR/application.yml:61`; `MS/donacion/DonacionesEstancadasJob.java:53` |

Comportamiento (`MS/donacion/DonacionesEstancadasJob.java:63-111`):

- Oferta directa `OFRECIDA` sin respuesta pasada la ventana: se cancela automáticamente (`CANCELADA`) con actor SISTEMA y motivo "sin respuesta del referente" (`MS/donacion/DonacionService.java:396-415`; consulta de candidatas en `MS/domain/DonacionRepository.java:159-162`). No se redirige al fondo común.
- Propuesta del fondo común sin respuesta pasada la ventana: se trata como rechazo y la donación vuelve al fondo (`necesidad = null`), la asignación vigente pasa a `RECHAZADA` (`MS/donacion/DonacionService.java:381-389,422-439`).
- `ACEPTADA` o `EN_CAMINO` más de 14 días, o `PENDIENTE_CONFIRMACION` más de 7 días: no se cancelan ni se reasignan. "Estancada" se calcula, no se guarda (`MS/donacion/EstancamientoDonacion.java:11-42`, comparaciones estrictas `> ventana`). El job lo declara en su Javadoc (`DonacionesEstancadasJob.java:27-28`).
- El job corre a las 00:15 y también al arrancar (`@EventListener(ApplicationReadyEvent.class)`, `DonacionesEstancadasJob.java:58-61`), para recuperar corridas perdidas.
- Cada donación se procesa en su propia transacción con bloqueo de fila y re-chequeo (`DonacionService.java:396-407,422-432`).

### Diferencias con el borrador

Borrador: "propuesta u oferta directa OFRECIDA sin respuesta tras N días corridos; donación aceptada estancada tras M días sin confirmación de entrega; configurable".

| Aspecto | Borrador | Código |
|---|---|---|
| Configurable | Sí | Sí, por propiedades y variables de entorno |
| N de oferta directa | Por completar | 7 días |
| N de propuesta del fondo común | Mismo N | Distinto: 3 días |
| M de estancada | Un solo M | Dos valores: 14 días (aceptada o en camino) y 7 días (pendiente de confirmación) |
| Tipo de acción al vencer | No especificada | Oferta directa se cancela; propuesta vuelve al fondo; estancada solo se marca, sin acción automática |
| Unidad | Días corridos | `Duration.ofDays` (`VentanasDonacion.java:22-36`), días de 24 horas, no días hábiles |

---

## RN-08. Sin doble reasignación

### Valores extraídos

Estado después de la tarea D2 (entrega 4). Cada punto indica qué existía antes y qué se agregó.

**1. Exclusión entre rondas (agregado; antes era un `ReentrantLock` de un solo proceso).**

- Mecanismo: advisory lock de PostgreSQL **de sesión** (`pg_try_advisory_lock`, clave constante `CLAVE_ADVISORY`) tomado sobre una conexión dedicada del pool durante toda la ronda (`MS/asignacion/RondaCerrojo.java:39,66-105`). Se libera con `pg_advisory_unlock` al terminar y, si eso fallara, se aborta la conexión para que el pool no reutilice una sesión que aún lo tenga (`:139-158`). Si el proceso o la conexión mueren, PostgreSQL lo libera solo.
- Por qué de sesión y no `pg_advisory_xact_lock`: una ronda son tres pasos, una transacción de lectura, la llamada HTTP al worker (timeout de lectura de 30 s, `MS/asignacion/worker/HttpAsignadorClient.java:24`) y una transacción de escritura (`MS/asignacion/RondaService.java:124-135,148`). El lock de transacción solo cubre lo que dura su transacción: o protege un tramo y deja libres los otros, o obliga a mantener una transacción abierta durante la llamada al worker (una conexión, un snapshot y estado "idle in transaction" por hasta 30 s). El lock de sesión no abre transacción ni toma bloqueos de fila. Alternativa descartada: una fila de "ronda en curso" con índice único parcial; necesita expiración y recuperación si el proceso muere a mitad de ronda.
- Alcance: toda ronda entra por `RondaService.ejecutar` (`RondaService.java:117-118`), tanto la manual (`MS/asignacion/RondaController.java:42`) como la programada (`MS/asignacion/RondaAutomaticaJob.java:32`). Ninguna ronda se ejecuta al arrancar: los listeners de `ApplicationReadyEvent` del MS son de otros trabajos (estancadas, vencimientos, purgas); cualquier ronda futura que se agregue debe pasar por `ejecutar`. Se mantiene el 409 `RONDA_EN_CURSO` (`RondaService.java:118`). Antes de tomar el lock de la base se toma un permiso en proceso, que rechaza la segunda ronda de la misma JVM sin consultar la base y es la única exclusión cuando la base no es PostgreSQL (H2 en las pruebas).
- Límite conocido: el lock es por sesión de base de datos, por lo que no funcionaría detrás de un pool de conexiones en modo transacción (por ejemplo PgBouncer en ese modo). El despliegue conecta directo a PostgreSQL. La conexión retenida es una de las 10 del pool por defecto de HikariCP.

**2. Restricción única de asignación activa por donación (agregado; antes no existía).**

- Índice único parcial `ux_asignacion_activa_por_donacion ON asignaciones (donacion_id) WHERE estado = 'PROPUESTA'` en `scripts/sql/V013__asignaciones_una_activa_por_donacion.sql`. Idempotente y transaccional. Si ya hay donaciones con más de una `PROPUESTA`, aborta con un mensaje que lista los ids y no modifica ni borra datos.
- "Activa" es `PROPUESTA`, la asignación vigente que `DonacionService` resuelve a `ACEPTADA`, `RECHAZADA` o `CANCELADA` (`MS/domain/AsignacionRepository.java`, `findFirstByDonacion_IdAndEstadoOrderByCreadaEnDesc`). `ACEPTADA` queda fuera a propósito: un cambio de estado administrativo puede dejar una fila `ACEPTADA` mientras la donación vuelve al fondo (el rechazo posterior solo resuelve filas `PROPUESTA`), y la ronda siguiente la propondría de nuevo de forma legítima; incluirla convertiría ese caso en una violación de la restricción que deshace una ronda completa.
- `EsquemaVerificador` registra `ESQUEMA_PENDIENTE` al arrancar si el índice falta (`MS/config/EsquemaVerificador.java:120-122,159-174`). La entidad no declara el índice (Hibernate no maneja índices parciales), por lo que en las pruebas con H2 no existe.
- La migración no se aplicó a producción. Se aplica con `make migrate` después de un respaldo (hace falta que la tabla `asignaciones` exista; si no, el script avisa y no hace nada).

**3. Cambio de estado condicional (no agregado; ya estaba cubierto).**

- No existe un `UPDATE ... WHERE estado='OFRECIDA'` y no se agregó, porque no cierra ninguna carrera que quede abierta. Al **tomar** una donación, la ronda la bloquea con `findByIdForUpdate`, `@Lock(PESSIMISTIC_WRITE)` (`MS/domain/DonacionRepository.java:190-192`), y comprueba `estado == OFRECIDA` y `necesidad == null` antes de asignar (`RondaService.java:313-317`); si no se cumple, descarta el par (`descartadas`). Al **devolver** una donación, la expiración de propuestas y la cancelación de ofertas también usan `findByIdForUpdate` y re-chequean (`MS/donacion/DonacionService.java:397-398,423-424`); el rechazo del referente (`decidir`, `:258-259`) y las acciones del donante no toman bloqueo de fila y quedan protegidos por el control optimista `@Version` de `Donacion` (`MS/domain/Donacion.java:34`), también presente en `Necesidad` y `Organizacion`: si dos operaciones leen la misma versión, la segunda falla con conflicto concurrente.
- La redacción del borrador ("UPDATE condicional por estado") describe un mecanismo distinto del implementado. El efecto buscado, que dos operaciones no pisen el estado de una donación, se obtiene con bloqueo pesimista más re-chequeo en la ronda y con `@Version` en el resto.

**4. Exclusión de lo rechazado (sin cambios).**

- Se excluyen las organizaciones cuyo registro de asignación para esa donación está en `RECHAZADA` (`MS/domain/AsignacionRepository.java:20-22`; uso en `RondaService.java:234-238`) y el solver las filtra como restricción dura (`GO/assign/scoring.go:262-264,298-307`). La exclusión es por organización, no por necesidad: es más estricta que el borrador, que habla de "la misma necesidad". No se debilitó.

**5. Propiedades que ya existían.**

- La asignación es de solo agregado: una reasignación inserta una fila nueva y la anterior queda como historial (`MS/domain/Asignacion.java:22-27`).
- Una donación ya asignada deja el fondo (`necesidad != null`) y no entra a otra ronda (`MS/domain/DonacionRepository.java:29-33`). Del lado de las necesidades no hay filtro equivalente: una necesidad `ABIERTA` o `EN_PROGRESO` que ya tiene una propuesta sigue siendo candidata (`RondaService.java:62,221`; `:250-269` no consulta donaciones existentes).

**Pruebas** (`MS/src/test/java/org/example/asignacion/`):

| Prueba | Qué verifica | Base de datos |
|---|---|---|
| `RondaCerrojoTest` (8 casos) | Lock adquirido y retenido hasta cerrar; rechazo si lo tiene otra instancia; liberación si falla la consulta; aborto de la conexión si falla el unlock; degradación a exclusión en proceso fuera de PostgreSQL | Simulada con Mockito |
| `RondaServiceTest` | 409 sin leer nada si el lock lo tiene otra instancia; el lock se libera si la ronda falla | Simulada |
| `RondaConcurrenciaIntegrationTest.twoParallelRondas_secondAnswers409_donationAssignedOnce` | Dos rondas en paralelo: la segunda recibe 409, la donación se asigna una sola vez | H2 y PostgreSQL 16 |
| `RondaConcurrenciaIntegrationTest.twoRondasThatBothReadTheSamePool_donationIsAssignedOnlyOnce` | Con el lock omitido (otra instancia sin lock compartido), dos rondas leen el mismo fondo y ambas intentan asignar la misma donación: una asigna, la otra descarta, queda una sola fila de asignación | H2 y PostgreSQL 16 |
| `RondaConcurrenciaIntegrationTest.postgres_*` (3 casos) | El índice V013 rechaza la segunda `PROPUESTA` y admite `RECHAZADA` y `ACEPTADA`; el script es idempotente; con duplicados previos aborta con mensaje claro y sin cambios; el advisory lock excluye a una segunda instancia | Solo PostgreSQL; se omiten en H2 |

Las pruebas del proyecto usan H2 (`src/test/resources/application.yml`); no hay Testcontainers ni otra forma de levantar PostgreSQL. Por eso los casos que dependen de PostgreSQL se omiten por defecto (`mvn test` informa 3 omitidas en esa clase). Se ejecutaron contra un PostgreSQL 16 descartable en un contenedor local (3 corridas, 5 de 5 pasan, ninguna omitida) con variables de entorno `SPRING_DATASOURCE_*` que sobrescriben la configuración de H2; el procedimiento está en el Javadoc de la clase. Un resultado en H2 no prueba un comportamiento de PostgreSQL y no se presenta como tal.

### Diferencias con el borrador

| Aspecto | Borrador | Código |
|---|---|---|
| UPDATE condicional `WHERE estado='OFRECIDA'` | Sí | No hay UPDATE condicional. En la ronda hay bloqueo pesimista de fila y re-chequeo de estado; en el resto de los caminos, control optimista `@Version` |
| Restricción única de asignación activa por donación | Sí | Sí, desde la entrega 4: índice único parcial sobre `PROPUESTA` (V013), pendiente de aplicar en producción. `ACEPTADA` no está incluida, con la razón indicada arriba |
| Advisory lock o bandera, incluida la ronda manual | Advisory lock o bandera | Advisory lock de sesión de PostgreSQL, desde la entrega 4; cubre manual y programada, y funciona con más de una instancia. Se eligió el de sesión y no el de transacción porque la ronda abarca la llamada HTTP al worker |
| Donación rechazada nunca re-propuesta a la misma necesidad | A la misma necesidad | Nunca re-propuesta a la misma organización (más amplio) |

---

## RN-09. Código de entrega

### Valores extraídos

Propiedades en `MSR/application.yml:79-84`:

| Parámetro | Propiedad | Valor |
|---|---|---|
| Vencimiento del código | `app.entrega.ttl-minutes` | 10 minutos |
| Intentos fallidos permitidos | `app.entrega.max-attempts` | 5 |
| Máximo de códigos generados por ventana | `app.entrega.generar-max` | 5 |
| Ventana de generación | `app.entrega.generar-window-minutes` | 15 minutos |
| Espera mínima entre generaciones | `app.entrega.generar-cooldown-seconds` | 30 segundos |

Los dos primeros se inyectan en `MS/donacion/entrega/EntregaService.java:49-53`; los demás en `MS/donacion/entrega/CodigoEntregaThrottle.java:31-35`.

- Código: 6 dígitos, `SecureRandom.nextInt(1_000_000)` formateado `%06d` (`EntregaService.java:39,208-211`).
- Almacenamiento: solo el hash BCrypt, en la tabla `codigos_entrega` de PostgreSQL (`MS/donacion/entrega/CodigoEntrega.java:22-31,48-49`; `EntregaService.java:83`). No se usa Redis (ver `docs/tfg/inventario.md`). Los contadores de generación (`CodigoEntregaThrottle`) viven en un `ConcurrentHashMap` en memoria (`CodigoEntregaThrottle.java:29`).
- Un código por emisor y parte: tiene `emisorParte` (`DONANTE` o `REFERENTE`) (`CodigoEntrega.java:44-46`). La parte contraria lo valida (`EntregaService.java:116-122`).
- Uso único: al validar se marca `usado = true` (`EntregaService.java:145-146`). Generar uno nuevo quema los anteriores sin usar del mismo emisor (`:69-76`).
- Vencimiento: si `expiraEn` ya pasó, se marca usado y responde 410 `CODIGO_EXPIRADO` (`:124-129`).
- Intentos: cada código erróneo suma `intentos`; al llegar a 5 se quema el código y responde 429 `DEMASIADOS_INTENTOS` (`:131-143`). El contador es por código emitido, no por usuario ni por donación.
- La verificación y los contadores se persisten aunque se lance la excepción (`@Transactional(noRollbackFor = ResponseStatusException.class)`, `:102`).
- Estado final: cada parte confirma al validar el código de la otra. `ENTREGADA` se alcanza cuando `confirmadaDonanteEn` y `confirmadaReferenteEn` están ambos presentes; con solo una, el estado es `PENDIENTE_CONFIRMACION` (`MS/donacion/ConfirmacionEntrega.java:27-48`). La transición `PENDIENTE_CONFIRMACION` a `ENTREGADA` figura en `MS/donacion/TransicionesDonacion.java:34-35`.
- Intervención administrativa: `overrideEstado` exige `motivo` no vacío (`MS/donacion/DonacionService.java:333-335`; DTO con `@NotBlank` y `@Size(max = 500)` en `MS/donacion/dto/OverrideEstadoRequest.java:21-23`), prohíbe tocar una donación terminal (`:329-332`) y guarda `overrideMotivo`, `overrideAdminId`, `overrideEn` (`:358-360`). Al pasar a `ENTREGADA` no se fabrican las confirmaciones de las partes: `confirmadaDonanteEn` y `confirmadaReferenteEn` no se tocan (`:341-346`). Se registra en la bitácora como `DONACION_OVERRIDE` con el cambio de estado y el motivo (`:363-364`). Queda registrado como intervención, no como confirmación de parte.
- Auditoría: la generación y la verificación quedan en la bitácora sin guardar nunca el código (`EntregaService.java:91-93,152-153,177-181`).

### Diferencias con el borrador

Borrador: "el código vence en N minutos, N intentos fallidos, uso único; ENTREGADA con confirmación de ambas partes; la intervención del admin exige motivo y se registra como intervención, no como confirmación de parte".

| Aspecto | Borrador | Código |
|---|---|---|
| Minutos de vencimiento | N | 10 |
| Intentos fallidos | N | 5 por código emitido |
| Uso único | Sí | Sí |
| `ENTREGADA` con ambas confirmaciones | Sí | Sí |
| Intervención del admin con motivo, registrada como intervención | Sí | Sí |
| Dónde se guarda el código | Por completar (hash, Redis o PostgreSQL) | Hash BCrypt en PostgreSQL; sin Redis |

---

## RF17. Indicadores territoriales

### Valores extraídos

Redacción del borrador: "por radio censal o barrio, conteo de organizaciones acreditadas, necesidades abiertas, donaciones entregadas los últimos 30 días e índice de déficit de cobertura, mostrado como mapa de calor en el mapa público".

Qué existe:

- Cálculo del déficit de cobertura y de la vulnerabilidad por radio censal en el trabajador de Go (`GO/metrics/coverage.go:58-109`: `deficit = habitantesPorComedor / mediana`) y en el microservicio en vivo (`MS/asignacion/VulnerabilidadCalculator.java:21-25,61-73`: `v = hpc / mediana * (1 + necesidades / comedores)`).
- El mismo cálculo por radio y por departamento en un pipeline fuera de línea (`scripts/mapa/vulnerabilidad.sql:11-16,55-76,86-89,133-154`), que escribe `go_algorithms_worker/data/vulnerabilidad-radios.csv` y `ts_hornero_astro/public/mapa/departamentos.geojson` (`scripts/mapa/vulnerabilidad.sql:8-9`).
- Mapa público `/mapa` en Astro con Leaflet: coropleta por departamento (no por radio), escala divergente de 6 pasos centrada en 1,0 (`ts_hornero_astro/src/lib/vulnerabilidad.ts:17-22`), tarjeta por departamento con vulnerabilidad, habitantes, comedores, habitantes por comedor y necesidades sin cubrir (`docs/mapa-vulnerabilidad.md:131-132`; propiedades en `ts_hornero_astro/src/lib/vulnerabilidad.ts:3-14`), y capa de densidad apagada por defecto hecha con círculos translúcidos (`docs/mapa-vulnerabilidad.md:128-130`; `ts_hornero_astro/src/components/islands/MapaVulnerabilidadMap.tsx:96-104`). El propio documento aclara que los polígonos por radio a alto zoom no están construidos (`docs/mapa-vulnerabilidad.md:135-136`).
- Páginas: `ts_hornero_astro/src/pages/mapa.astro:12-17`.

Qué no existe:

| Elemento del borrador | Estado en el código |
|---|---|
| Granularidad radio censal o barrio en el mapa público | El mapa público usa departamento; el radio solo existe en el cálculo del motor y el CSV |
| Conteo de organizaciones acreditadas | El pipeline cuenta organizaciones `APROBADA` o `SIN_RECLAMAR` con coordenadas (`scripts/mapa/vulnerabilidad.sql:40`), no organizaciones acreditadas por nivel; incluye las importadas sin reclamar |
| Necesidades abiertas | Existe: `necesidadesAbiertas` (`scripts/mapa/vulnerabilidad.sql:15,147`) |
| Donaciones entregadas en los últimos 30 días | No existe: ninguna ocurrencia de donaciones entregadas o ventana de 30 días en `scripts/mapa/*`, `ts_hornero_astro/src/components/islands/Mapa*.tsx` ni `ts_hornero_astro/src/lib/mapaZona.ts` |
| Índice de déficit de cobertura | Existe: `deficitCobertura` (`scripts/mapa/vulnerabilidad.sql:149`) |
| Mapa de calor | No es un mapa de calor: la coropleta es por departamento, y la librería de calor `leaflet.heat` se descartó (`docs/mapa-vulnerabilidad.md:128-130`) |

El valor se calcula a pedido con datos cargados por un script (`make mapa-datos`); el sitio público no consulta al trabajador en tiempo de ejecución (`docs/mapa-vulnerabilidad.md:140`). El mapa depende de un archivo estático `departamentos.geojson`.

### Diferencias con el borrador

El RF17 del borrador está implementado en parte: déficit y necesidades abiertas sí, en coropleta por departamento; faltan las donaciones entregadas de los últimos 30 días, la granularidad por radio o barrio en el mapa público, el conteo de organizaciones acreditadas (por nivel) y la forma de mapa de calor.

---

## RF18. Puntaje de historial de la organización

### Valores extraídos

Redacción del borrador: "puntaje H de historial por organización a partir de entregas confirmadas, rechazos y donaciones sin respuesta, registrado en el legajo".

- El puntaje existe como término de cumplimiento del algoritmo, `TasaCumplimiento`: `(entregadas + m*p0) / (entregadas + fallidas + m)` (`GO/assign/cumplimiento.go:47-54`), con peso 0,15 (`GO/assign/scoring.go:151`).
- Entradas: donaciones `ENTREGADA` como entregadas y `RECHAZADA` como fallidas, por organización (`MS/asignacion/CumplimientoCalculator.java:25,29-44`). Las `CANCELADA` y las no terminales no cuentan.
- Donaciones sin respuesta: una oferta directa sin respuesta termina `CANCELADA` y por eso no cuenta como fallida; una propuesta del fondo sin respuesta vuelve al fondo y no genera una donación `RECHAZADA` (la donación sigue `OFRECIDA`) (`MS/donacion/DonacionService.java:422-439`). Las donaciones sin respuesta no entran en el puntaje.
- Consecuencia relevante: el rechazo de una propuesta del fondo común por el referente tampoco cambia la donación a `RECHAZADA`; solo limpia la necesidad y marca la asignación como `RECHAZADA` (`MS/donacion/DonacionService.java:271-284`). Como `CumplimientoCalculator` cuenta estados de donación y no de asignación, solo los rechazos de ofertas directas llegan a ser "fallidas" del puntaje; los rechazos de propuestas del fondo común no.
- Se calcula al ejecutar cada ronda con una consulta agrupada (`MS/asignacion/EntradaRondaFactory.java:41`; `MS/domain/DonacionRepository.java:200-202`). No se guarda como valor por organización.
- Lo que sí se persiste: el término de cumplimiento aplicado a cada asignación (`Asignacion.terminoCumplimiento`, `MS/domain/Asignacion.java:92-94`) y el peso de la ronda (`MS/asignacion/RondaService.java:298-304`). Se muestra en el desglose del puntaje del panel (`ts_hornero_admin/src/components/donacion/DesgloseScore.tsx` y `CriteriosAsignacionPanel.tsx`) y el sitio público lo menciona en un texto (`ts_hornero_astro/src/pages/index.astro:43`).
- Legajo: `LegajoResponse` no contiene ningún campo de cumplimiento ni de historial (`MS/acreditacion/dto/LegajoResponse.java:13-22`; armado en `MS/acreditacion/AcreditacionService.java:447-495`). No se calcula, guarda ni muestra un puntaje de cumplimiento en el legajo.

### Diferencias con el borrador

| Aspecto | Borrador | Código |
|---|---|---|
| Puntaje H por organización | Existe | Existe como término de la ronda, derivado en cada ronda; no hay un campo almacenado por organización |
| Entregas confirmadas | Entra | Entra (`ENTREGADA`) |
| Rechazos | Entra | Entra solo si la donación queda en `RECHAZADA` (ofertas directas); el rechazo de una propuesta del fondo común no lo hace |
| Donaciones sin respuesta | Entra | No entra |
| Registrado en el legajo | Sí | No: el legajo no incluye cumplimiento |

---

## Criterio de RF11 "historial de cumplimiento"

Fuente del criterio: la redacción corregida de RF11 en `docs/tesis/correcciones-requerimientos.md:9-10` ("ponderando déficit de cobertura territorial, urgencia, proximidad, tiempo de espera e historial de cumplimiento de la organización"). El equivalente en `docs/tesis/documento.md` es RF-14 (`docs/tesis/documento.md:330-338`).

Estado: el criterio está en el código. Es el quinto término del puntaje (`GO/assign/scoring.go:285,292`) con peso por defecto 0,15 (`GO/assign/scoring.go:151`), calculado a partir de las donaciones `ENTREGADA` y `RECHAZADA` por organización (`MS/asignacion/CumplimientoCalculator.java:25,29-44`) y suavizado con un prior neutral (`GO/assign/cumplimiento.go:47-54`). No filtra: el comentario de `PesosPorDefecto` indica que "recompensa" sin excluir nunca (`GO/assign/scoring.go:141-145`). Limitación respecto de RF18: no se muestra en el legajo (ver RF18).

---

## Numeración

Se leyeron ambos documentos. Los identificadores se repiten con significados distintos.

| Identificador | `docs/tesis/documento.md` | `docs/tesis/correcciones-requerimientos.md` | ¿Colisión? |
|---|---|---|---|
| RF11 / RF-11 | Registrar cada hecho de acreditación como evento de solo agregado (`documento.md:312-317`) | Modalidades de donación y asignación con algoritmo húngaro (`correcciones-requerimientos.md:9-10`) | Sí |
| RF13 / RF-13 | Limitar categorías y cupos por nivel (`documento.md:327-329`) | Auditoría de evidencia: cola global (`correcciones-requerimientos.md:118-119`) | Sí |
| RF14 / RF-14 | Dos modalidades de donación y ronda húngara (`documento.md:330-338`) | Respuesta a propuestas de asignación (`correcciones-requerimientos.md:121-122`) | Sí |
| RF15 / RF-15 | Validar la entrega con código de un solo uso (`documento.md:339-344`) | Resolución automática de donaciones sin respuesta (`correcciones-requerimientos.md:124-125`) | Sí |
| RF16 / RF-16 | Estructurar lo que se dona y lo que se solicita con un catálogo (`documento.md:345`) | Ronda automática programada (`correcciones-requerimientos.md:127-128`) | Sí |
| RF17, RF18 | No existen en `documento.md` (la lista llega a RF-16) | No existen en `correcciones-requerimientos.md` (llega a RF16) | No definidos en ninguno; el borrador del encargo los usa para indicadores territoriales (RF17) e historial (RF18) |
| RNF-14 | Todo hecho de acreditación como evento inmutable en la misma transacción (`documento.md:426-429`) | No existe (el último RNF numerado ahí es 18, pero RNF14 no figura) | Solo en `documento.md` |
| RNF-15 / RNF15 | Reconstrucción del nivel desde eventos = nivel almacenado (`documento.md:430-433`) | Parámetros configurables (`correcciones-requerimientos.md:132-133`) | Sí |
| RNF16 | No existe | Determinismo de la ronda (`correcciones-requerimientos.md:135-136`) | Solo en correcciones |
| RNF17 | No existe | Recuperación tras apagado (`correcciones-requerimientos.md:138-139`) | Solo en correcciones |
| RNF18 | No existe | Límites de la ronda: 500 donaciones y 500 necesidades, 30 s (`correcciones-requerimientos.md:141-142`) | Solo en correcciones |
| RN-01 a RN-09 (borrador) | `documento.md` no define reglas con ese prefijo (sin coincidencias) | Define RN01 a RN28 con otro contenido (por ejemplo, RN01 escalera de niveles, RN09 habilitaciones por nivel) (`correcciones-requerimientos.md:19-114`) | Numeración distinta: el RN-09 del borrador (código de entrega) no coincide con el RN09 de correcciones (habilitaciones por nivel) |

Consecuencia para las referencias de la sección A1 del encargo: "RNF14 (invariante evento-nivel)" corresponde a RNF-14/RNF-15 de `documento.md`; "RNF16 (determinismo)" y "RNF18 (límites)" corresponden a la numeración de `correcciones-requerimientos.md`. Hay que unificar la numeración antes de citar identificadores en el documento final.

Observación sobre RNF16 (determinismo), porque se cita arriba: ver RN-05, sección de desempate. Desde la entrega 4 el worker fija un orden total para los empates exactos de puntaje, por lo que "los mismos datos en cualquier orden dan la misma asignación" está verificado por prueba para el solver y el contrato. No está verificado de punta a punta contra PostgreSQL ni en la Raspberry Pi.
