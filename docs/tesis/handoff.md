# Handoff — Tesis de Ingeniería (Hornero)

Documento de continuidad. Resume el estado real del trabajo, las decisiones
tomadas, los hallazgos que no conviene volver a descubrir y lo que falta hacer.
Pensado para reiniciar la sesión y retomar sin perder contexto.

Fecha: 2026-09-20
Rama activa: `feat/acreditacion-trazabilidad` (creada desde `feat/ui-updates`)

---

## 1. Configuración de sesión SDD

Respuestas del preflight, para repetirlas igual al reiniciar:

| Parámetro | Valor |
|---|---|
| `execution_mode` | `automatic` |
| `artifact_store.mode` | `hybrid` |
| `delivery_strategy` | `ask-on-risk` |

Restricciones explícitas del usuario, válidas siempre:

- **No commitear.** No crear pull requests.
- Trabajar desde una rama fresca (ya creada: `feat/acreditacion-trazabilidad`).

`sdd-init` ya corrió en esta sesión y creó `openspec/config.yaml` con el contexto
del proyecto y los comandos de test por servicio.

---

## 2. Problemas conocidos al reiniciar

**Engram no conecta.** El servidor MCP devuelve `CONNECTION_CLOSED`. Por eso el
modo `hybrid` sólo puede cumplir su mitad de archivos: los artefactos se escriben
en `openspec/`, y la persistencia en engram queda pendiente hasta que el servidor
vuelva. Verificar al reiniciar; si conecta, republicar los artefactos ahí.

**El guard de SDD rechazó el despacho de sub-agentes** con el mensaje:

```
SDD child dispatch refused: parent-confirmed SDD preflight is missing,
invalid, or uncorroborated.
```

Ocurrió dos veces. La segunda fue porque una respuesta del preflight se dio como
texto libre en lugar de un token canónico. Al reiniciar, responder el preflight
usando los valores exactos de la tabla de arriba (`automatic`, `hybrid`,
`ask-on-risk`) antes de despachar cualquier fase.

**Los nombres de skills cambiaron a mitad de sesión** (`sdd-explore` pasó a
`gentle-sdd-explore` en la lista de skills), pero los tipos de agente siguen
siendo los viejos (`sdd-explore`, `sdd-propose`, …). Si un despacho falla por
nombre, probar sin el prefijo `gentle-`.

**CONICET estuvo caído** (`502`, y después fallos de handshake TLS en los dos
mirrors). No bloquea nada: el CSV ya está descargado en el repo.

---

## 3. Estado del repositorio

### Hecho y funcionando

**`go_algorithms_worker/`** — worker de algoritmos en Go. `go test ./...` en verde,
`go build ./...` limpio.

```
go_algorithms_worker/
├── data/renacom.csv              2730 comedores (dataset CONICET)
├── internal/renacom/             loader del CSV + PrecisionDudosa()
├── internal/metrics/coverage.go  cobertura por radio censal + déficit
├── internal/assign/
│   ├── hungarian.go              Kuhn-Munkres / Jonker-Volgenant, O(n²m)
│   ├── scoring.go                score normalizado + filtros duros
│   └── ronda.go                  la ronda completa + costoOportunidad
├── main.go                       subcomandos: metrics, assign
└── README.md
```

Comandos:

```bash
cd go_algorithms_worker
go test ./...
go run . metrics --provincia "Córdoba" --top 20
go run . assign --input ronda.json
```

**`docs/tesis/diagramas/`** — PlantUML + PNG renderizados.

- `despliegue/general.puml` — arquitectura sin atarse al hardware.
- `despliegue/raspberry.puml` — la misma sobre la Pi real.

PlantUML 1.2026.8 y poppler quedaron instalados por brew. Para re-renderizar:
`plantuml -tpng archivo.puml`.

**`openspec/config.yaml`** — generado por `sdd-init`.

### Sin versionar (todo lo de arriba está untracked; no commitear sin permiso)

```
 M .env.example
 M ts_hornero_admin/src/app/AppShell.tsx
 D ts_hornero_admin/src/app/Topbar.tsx
?? docs/db-changes.md
?? docs/tesis/
?? entregas_tesis/
?? go_algorithms_worker/
?? openspec/config.yaml
```

Nota: `entregas_tesis/` contiene un `.docx` de 5,7 MB. No está en `.gitignore`;
decidir si se versiona antes de commitear.

---

## 4. Lo que falta hacer

### Tarea 1 — Acreditación progresiva + historial de estados de organización

Son **una sola cosa**, no dos: el nivel de acreditación cambia con el tiempo, así
que el historial es la forma en que la acreditación se registra. Nombre del cambio
SDD: `acreditacion-progresiva`.

La idea: Hornero define su propia escalera de niveles de validación. Cada nivel
exige más evidencia verificable, y el nivel gobierna **qué volumen y qué tipo de
alimentos puede solicitar** una organización. El nivel más alto se alinea con lo
que exige el Banco de Alimentos Córdoba, de modo que alcanzarlo signifique que la
organización está lista para darse de alta allí, y pueda exportar un **legajo de
acreditación** como evidencia.

Requisito del usuario, textual: *"no podemos solo tener un crud, tiene que haber
registro"*.

**Requisitos del Banco de Alimentos — hay una discrepancia sin resolver.**

Lista publicada hoy en <https://bancodealimentoscba.org.ar/suma-a-tu-comedor/>
(verificada en esta sesión):

1. Brindar un servicio de alimentación gratuito, sin condicionamientos y de manera
   regular (al menos una vez por semana) en un espacio físico.
2. Contar con Personería Jurídica o Simple Asociación (requisito excluyente).
3. No discriminar en la entrega de los alimentos por raza, religión, credo,
   vecindad o partido político.
4. Mantener las instalaciones en condiciones sanitarias adecuadas, de acuerdo con
   el servicio que se presta.
5. Aceptar las visitas de auditoría que realiza el Banco de Alimentos, sin previo
   aviso.
6. No contar con kiosko, almacén o despensa en el mismo domicilio del
   merendero/comedor.
7. Estar dentro de la ciudad de Córdoba o hasta 50 km de distancia desde el Banco
   de Alimentos Córdoba.

Lista aportada por el usuario (más vieja, o tomada de la página del formulario):
personería jurídica **o aval de otra personería jurídica**; servicio regular al
menos una vez por semana (en el lugar o como viandas); alimento gratuito sin
discriminar por género, edad, religión; ubicación a 50 km máximo **de Córdoba
Capital**; si asiste en varias instituciones, inscribir cada una por separado (el
alta se aprueba con auditoría sobre la dirección declarada).

Diferencias a resolver antes de especificar el nivel más alto:

- La página viva agrega tres requisitos que no están en la lista del usuario:
  condiciones sanitarias, aceptación de auditorías sin aviso, y la regla de no
  tener kiosco/almacén/despensa en el mismo domicilio.
- La página dice "Simple Asociación"; la lista del usuario dice "aval de otra
  personería jurídica". No son lo mismo.
- Los 50 km se miden **desde el Banco de Alimentos**, no desde Córdoba Capital.

Varios de estos requisitos son declaraciones o hechos de inspección física que el
software no puede verificar por sí mismo. Deben modelarse como evidencia
**declarada y auditada**, no como evidencia verificable por el sistema.

Campos del formulario de inscripción (aportados por el usuario; la página no los
expone): nombre del comedor/merendero/copa de leche (obligatorio); documentación
que presentan (obligatorio; opciones: Asociación Simple, Asociación Civil, Fichero
de Culto, Fundación, Cooperativa, Centro de Jubilados, Centro Vecinal, Aval);
nombre del referente o persona a cargo (obligatorio); teléfono del referente
(obligatorio); teléfono alternativo (obligatorio); dirección exacta del comedor,
con nota de cómo llegar si es manzana/lote o calle sin nombre (obligatorio);
barrio (obligatorio); localidad/ciudad.

**Qué investigar en el código** (no asumir):

- `jar_hornero_ms/.../domain/Organizacion.java` y `EstadoOrganizacion`: campos
  actuales (`validada`, `estado`, `validadoPor`, los campos de *pending snapshot*)
  y cómo valida `OrganizacionService`.
- `DonacionService.java:37-45` — `TRANSICIONES_PERMITIDAS` ya modela transiciones
  válidas. Evaluar si el patrón se reutiliza para organizaciones y qué **no**
  cubriría.
- Si existe alguna tabla o entidad de auditoría/eventos en el MS. (No se encontró
  ninguna en esta sesión.)
- `docs/otp-email-validation.md` — hay un flujo OTP ya shippeado (código
  hasheado con BCrypt, TTL de 15 min, throttling). Evaluar reutilizarlo para
  verificación de evidencia.

**Restricciones de persistencia:** el MS corre con
`spring.jpa.hibernate.ddl-auto=update` y sin archivos de migración. Eso **no**
agrega columnas `NOT NULL` sin default a tablas no vacías, y **no** relaja un
`NOT NULL` existente. Ver el comentario "D4" en `Organizacion.java` como
precedente del propio proyecto.

**Restricciones de despliegue:** una sola Raspberry Pi 5 detrás de un Cloudflare
Tunnel. **No hay Redis** en el stack (`docker-compose.yml` tiene postgres, ms,
bff, astro, admin, minio, cloudflared). No proponer servicios nuevos sin decir qué
cuestan en ese dispositivo.

**Enfoques a comparar** (con tradeoffs honestos):

- Log append-only (`organizacion_evento`) con el estado derivado, contra columna
  de estado mutable más tabla de historial, contra Hibernate Envers. Pesar costo
  de implementación, costo de consulta, y qué tan bien soporta exportar el legajo.
- Si el nivel de acreditación se almacena y se recalcula ante cada cambio de
  evidencia, o se deriva en lectura. **La evidencia vence** (los documentos tienen
  fecha de validez), así que un nivel puede decaer sin acción del usuario. Decir
  con claridad qué enfoques manejan eso y cuáles lo ignoran en silencio.
- Si vale la pena una cadena de hashes sobre los eventos. Ser exacto sobre qué
  protege y qué no: una cadena guardada en la misma base que la aplicación puede
  hacer `UPDATE` es recalculable por quien edite, así que detecta corrupción
  accidental, no manipulación deliberada — salvo que se le revoque `UPDATE`/
  `DELETE` al usuario de base de la app, o se ancle el último hash afuera.

**Advertencia de diseño:** el nivel de acreditación debe actuar como **filtro
duro** sobre el motor de asignación (topea qué puede pedir la organización), no
como peso del score. Si se cuenta en los dos lados, se premia dos veces lo mismo y
se perjudica justamente a la organización recién acreditada en zona desatendida,
que es la que el sistema debería encontrar.

### Tarea 2 — Contenido del documento de tesis

El usuario redacta el `.docx`; hace falta el contenido. Secciones según la
consigna, en orden:

1. **Diagnóstico y Propuesta** — Hornero es una *organización modelada* (no
   existe). El diagnóstico va a nivel macro del estado de situación.
2. **Objetivo del prototipo** — una sola oración, verbos en infinitivo.
3. **Límites** — forma "Desde (…) Hasta (…)".
4. **Alcances** — procesos cubiertos dentro de esos límites.
5. **Descripción del Sistema (UML)** — requerimientos funcionales y no
   funcionales, diagrama de casos de uso, descripción de casos de uso con
   plantilla estándar, diagramas de secuencia.
6. **Estructura de datos** — diagrama de clases, DER, diccionario de datos.
7. **Prototipos de interfaces** — al menos 3, coherentes con los casos de uso.
8. **Diagrama de despliegue** — ya hecho, en dos vistas.

Metodología elegida: **UML** (no Scrum). La tesis de analista también usó UML.

### Tarea 3 — Trazabilidad / historial de estados

Absorbida por la Tarea 1: es el mismo cambio. Ver arriba.

---

## 5. Hallazgos que no conviene volver a descubrir

### Sobre los documentos de la tesis

`entregas_tesis/` contiene la entrega de analista (`.docx`) y la propuesta
aprobada de ingeniería (`.pdf`). Para extraerlos:

```bash
textutil -convert txt -output salida.txt "Entrega Seminario de Analista .docx"
pdftotext -layout "LucianoPeralta_Propuesta Seminario Final.pdf" salida.txt
```

**El título aprobado de la tesis de ingeniería es:** *"Sistema de acreditación,
asignación priorizada y trazabilidad de donaciones de alimentos"*. Son **tres**
pilares. La acreditación es el que todavía no se tocó.

**El alcance se angostó**: analista decía "donaciones materiales" (incluía calzado
e indumentaria); la propuesta de ingeniería dice **alimentos**. Eso hay que
reflejarlo en Límites y Alcances, y justifica que la urgencia por vencimiento sea
un término de primer orden.

**El diagnóstico aprobado ya menciona el problema que resuelve el algoritmo**:
*"Duplicación de recursos en algunas zonas y desabastecimiento en otras"* y
*"Distribución inequitativa de recursos en el territorio"*. El motor de asignación
no es un agregado: responde a un problema ya documentado y aprobado.

**ReNaCoM ya está en la bibliografía aprobada** — el cuarto link de la propuesta
apunta a la página de políticas de seguridad y soberanía alimentaria de
argentina.gob.ar, de donde sale el registro.

**Casos de uso ya escritos en la entrega de analista** (CU-01 a CU-06): Registrar
organización, Validar organización, Publicar necesidad, Consultar necesidades en
el mapa, Ofrecer donación, Gestionar seguimiento de organización.

**`openspec/specs/` ya existía** con cinco specs de julio, versionadas en git:
`admin-referente-management`, `organizacion-info-publica`,
`organizacion-self-edit`, `referente-onboarding`,
`referente-organizacion-assignment`. Es material reutilizable para la sección de
Requerimientos Funcionales — hay que traducirlo al formato de la consigna, no
inventarlo.

### Desvío de arquitectura — pendiente de decisión del usuario

La **Descripción a Nivel Técnico** de la entrega de analista describe un sistema
que no es el que se construyó:

| Entrega de analista | Lo que corre hoy |
|---|---|
| Microservicio de autenticación (MS-Login) | JWT emitido por el MS de dominio; no existe MS-Login |
| Dos BFF, uno por cliente | Un solo BFF (el split quedó postergado) |
| Redis para cache de sesiones y tokens | No hay Redis en el stack |
| PostgreSQL primary/replica | Postgres único |
| AWS Cognito para identidad | JWT propio HS256 + BCrypt en el MS |
| API de Google Maps | Leaflet sobre OpenStreetMap |

**RNF03** dice literalmente "gestionar la autenticación mediante AWS Cognito" y
**RNF06** apoya la disponibilidad en "el esquema PostgreSQL primary/replica". Los
dos son falsos hoy, y el diagrama de despliegue generado los contradice.

Propuesta pendiente de confirmación: corregir la descripción técnica **y** agregar
un capítulo de decisiones de arquitectura que documente por qué cada divergencia
ocurrió (costo, autoalojamiento en la Pi, licenciamiento, acoplamiento en el MS).
Varias razones ya están escritas en `docs/`. El argumento: en analista se describe
lo que se va a construir; en ingeniería se muestra lo construido y por qué las
decisiones cambiaron al contacto con la realidad.

### Sobre el dataset ReNaCoM

CSV directo, sin autenticación:

```
https://ri.conicet.gov.ar/bitstream/handle/11336/278030/Comedores_y_merenderos__ReNaCoM_.csv?sequence=5&isAllowed=y
```

2730 filas, 25 columnas. Comedor 1768 / Merendero 962. Córdoba: 264 comedores,
185 radios censales, 30.040 asistentes declarados.

**La columna clave es `Código de radio`**, poblada al 100%: código INDEC de radio
censal de 9 dígitos (`PP DDD FF RR` = provincia, departamento, fracción, radio).
Es la clave de join contra la población del censo, así que la métrica de cobertura
sale con un `GROUP BY` — **no hace falta point-in-polygon ni PostGIS**.

`Tipo de georreferenciación` (diccionario oficial): 1 georreferenciado por RENACOM,
2 preciso Google Maps, 3 preciso manual, 4 intersección Google Maps, 5 intersección
manual, 6 cercanía a máximo 300 metros, 7 no fue posible localizarlo, 9 no fue
procesado manualmente. Los niveles 1-5 son precisos a nivel cuadra o mejor;
`Comedor.PrecisionDudosa()` marca 6 o peor — 193 de 2730 filas a nivel nacional,
8 de 264 en Córdoba.

**Falta un dato:** población por radio censal (INDEC Censo 2022), CSV
`codigo_radio,habitantes,hogares`. Sin eso el `deficit` queda en 0 y el término
que pesa 0.35 no aporta nada. El worker corre igual, pero asigna con tres cuartos
del criterio.

### Sobre el algoritmo de asignación

**Las donaciones son indivisibles**: una donación va entera a una necesidad, y una
necesidad se llena con a lo sumo una donación por ronda.

**El candidato es la necesidad, no la organización.** Puntuar la organización
produce un ranking, no una asignación: el mismo comedor bien calificado gana todas
las donaciones, incluso mercadería que no pidió. Además, con la necesidad como
candidato, una organización con dos necesidades abiertas puede recibir dos
donaciones, que es el comportamiento correcto. `Donacion.necesidad` ya existe en el
MS, así que el par ya es la forma del dominio.

Esa restricción de una-por-necesidad es lo que hace que esto sea un problema de
asignación. Sin ella, cada donación elegiría su mejor candidato por `argmax` y no
haría falta solver.

Score, todos los términos normalizados a [0,1] antes de pesar:

```
score = 0.35*deficit + 0.30*urgencia + 0.20*proximidad + 0.15*espera
```

`espera` es el término antiinanición (días desde la última donación de la
organización, satura a los 90). Es determinístico y no aleatorio a propósito: en
una plataforma de donaciones, poder explicar por qué una donación fue donde fue
vale más que la optimalidad marginal. **Cuenta también las donaciones directas**,
porque si no una organización con muchos donantes directos le parece hambrienta al
algoritmo y cobra por los dos canales.

Categoría incompatible y `distanciaMaximaKm` son **filtros duros** (costo `Inf`),
no penalizaciones.

**Costo de Hungarian:** pierde explicabilidad local. Una asignación individual
puede tener score menor que otra opción libre, porque otra donación la necesitaba
más. Por eso cada `Asignacion` lleva `costoOportunidad` = mejor score en soledad
menos score real. Es el número que se cita cuando pregunten "¿por qué no fue al de
mayor puntaje?".

Rechazado: min-cost-flow / transporte, que sería lo correcto si las donaciones se
pudieran partir por cantidad. Revisar sólo si vuelven las donaciones divisibles.

### Dos modalidades de donación

El donante puede **elegir la necesidad directamente** o **entregar al pool** para
que Hornero reparta. Sólo las del pool pasan por el solver; una donación directa ya
está asignada y nunca debe re-rutearse.

**Trampa:** no inferir la modalidad de `necesidad == null`. El algoritmo completa
`necesidad` al asignar, y en ese instante se pierde para siempre la distinción
entre "el donante eligió" y "el sistema eligió" — que es justo la que se necesita
para auditar el algoritmo. Va un campo explícito `modalidad: DIRECTA | POOL`,
escrito en la creación y nunca más tocado.

**Bloqueante:** `Donacion.necesidad_id` es hoy `nullable = false`
(`Donacion.java:39`). Una donación al pool nace sin destino. `ddl-auto=update` no
relaja un `NOT NULL` existente: va SQL a mano.

También falta un estado: hoy `OFRECIDA` ya implica que hay una necesidad detrás.

**Regalo para la tesis:** las donaciones directas son un **grupo de control
natural**. Dos flujos sobre la misma población de comedores en el mismo período,
uno elegido por el donante y otro por el algoritmo. Medir la concentración de cada
uno (por ejemplo, Gini sobre donaciones recibidas por organización) convierte el
objetivo de equidad de una afirmación en una medición. Es un capítulo de
evaluación que la mayoría de los TFG no tiene, y los datos van a estar ahí.

### Revisión del diseño de trazabilidad discutido en el chat web

Lo que **ya existe** y no hay que inventar:

- La tabla de transiciones ya está escrita en `DonacionService.java:37-45`
  (`TRANSICIONES_PERMITIDAS`), y `EstadoDonacion` tiene siete estados vivos con
  `isTerminal()`. No introducir un segundo vocabulario de estados al lado.
- El OTP ya está implementado y shippeado (`docs/otp-email-validation.md`):
  BCrypt, TTL de 15 minutos, throttling, `429 ESPERA_ANTES_DE_REENVIAR`. El OTP de
  cierre de entrega es el mismo patrón apuntando a otra tabla. Sin Redis.

Errores a **no** repetir del diseño propuesto en el chat web:

- `REASIGNADA` no es un estado, es un evento. El estado resultante es volver al
  pool. Dejarlo como estado es un nodo que describe una transición, no una
  situación.
- La cadena de hashes está sobrevendida. "Si alguien edita una fila el hash rompe"
  es falso: quien tiene `UPDATE` edita y recalcula la cadena. SHA256 es público, no
  hay clave. Detecta corrupción accidental, no fraude. Para que sea demostrable:
  `REVOKE UPDATE, DELETE` al usuario de la app, o anclaje externo periódico del
  último hash.
- **`jsonb` rompe el hash.** Postgres normaliza al guardar: reordena claves,
  descarta duplicadas, reformatea números. Si se calcula el hash al escribir y se
  reverifica leyendo de vuelta, los hashes no coinciden. Guardar el payload como
  `json`/`text` con serialización canónica, o hashear sólo campos escalares. Es un
  bug silencioso que aparece el día de la demo.
- No hay Redis. Un OTP con TTL de 15 minutos es una fila de Postgres con
  `expires_at`, no un servicio nuevo en la Pi.
- Los filtros duros propuestos (capacidad, cadena de frío, horario de recepción,
  tope por acreditación) **no tienen campos**: `Necesidad` tiene `descripcion`,
  `prioridad`, `estado`, `fechaPublicacion`, `fechaVencimiento`; `Donacion` tiene
  `fechaOferta`, `fechaEntrega`, `estado`, `observaciones`. Cero cantidades. El
  modelo de acreditación (Tarea 1) es lo que aporta el tope de volumen.

Lo que **sí** conviene conservar de ese diseño: pesos versionados en base de datos,
score desglosado persistido por asignación, filtros duros antes del scoring, un
solo motor con dos disparadores, y la regla *posible = filtro, urgente = peso,
quién dona = no toca la asignación*.

---

## 6. Preguntas abiertas

1. **¿Cuál lista de requisitos del Banco de Alimentos es la vigente?** La del sitio
   o la aportada. Bloquea la especificación del nivel más alto de acreditación.
2. **¿Se arma el capítulo de decisiones de arquitectura** junto con la descripción
   técnica corregida, o sólo se corrige? (Recomendado: armarlo.)
3. **¿Se consigue la población por radio censal del Censo 2022?** Sin ese CSV el
   término de déficit no aporta.
4. **¿`entregas_tesis/` se versiona?** Hay un `.docx` de 5,7 MB sin `.gitignore`.

---

## 7. Orden sugerido al reiniciar

1. Verificar si engram conecta. Si conecta, republicar los artefactos ahí.
2. Responder el preflight de SDD con los tokens exactos de la sección 1.
3. Correr la fase `sdd-explore` del cambio `acreditacion-progresiva` con el
   contenido de la Tarea 1.
4. Seguir la cadena SDD: propose → spec → design → tasks.
5. En paralelo, armar el contenido del documento de tesis (Tarea 2), que no
   depende de los internals de acreditación para las secciones 1 a 4.

---

## 8. Trabajo diferido — después de la Tarea 2 (documento de tesis)

Decisión del usuario (2026-09-20): los dos ítems siguientes están verificados contra
el código y confirmados como alcance real. Quedan **especificados y diseñados** dentro
de `acreditacion-progresiva` — son parte de la arquitectura objetivo — pero su
**implementación** se ejecuta como slice aparte, **después** de terminar la generación
del documento de tesis. No es una exclusión de alcance, es un orden de ejecución: la
primera tanda de implementación tiene que ser coherente y entregable sin estos dos.

**1. No existe la categoría de alimento en el MS.** `grep -i categoria` sobre todo
`jar_hornero_ms` devuelve cero. `Necesidad` tiene sólo `descripcion`, `prioridad`,
`estado`, `fechaPublicacion`, `fechaVencimiento` (`Necesidad.java:16-43`). El campo
`CategoriasAceptadas []string` que el worker en Go ya filtra
(`go_algorithms_worker/internal/assign/scoring.go:56-58`) **no tiene productor** en el
MS. El tope por categoría del nivel de acreditación exige entonces un enum
`CategoriaAlimento` más una columna `categoria` aditiva y nullable en `Necesidad`
(null = sin clasificar, comportándose como hoy). La otra mitad del tope, la
concurrencia, no necesita ningún campo nuevo: se cuentan las necesidades `ABIERTA` +
`EN_PROGRESO`.

**2. `GET /images?key=` filtraría las evidencias.**
`ts_hornero_bff/src/images/images.controller.ts:8-23` está decorado `@Public()` y
sirve cualquier key del bucket por query param (verificado leyendo el archivo). Las
fotos de condiciones sanitarias y los documentos de personería no pueden servirse por
ahí. Requieren una ruta nueva, autenticada y con chequeo de propiedad
(`@Roles(ADMINISTRADOR)` más el `REFERENTE` dueño), manteniendo sincronizadas las tres
capas de enforcement (MS `SecurityConfig`, BFF `RolesGuard`, SPA `ProtectedRoute`).

Copia en Engram: observación #680.
