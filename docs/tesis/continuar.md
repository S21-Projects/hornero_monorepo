# Punto de continuación — sesión del 2026-09-20/21

Este archivo reemplaza a `handoff.md` como estado vigente. `handoff.md` sigue siendo útil
por sus hallazgos (dataset ReNaCoM, modelo del algoritmo, requisitos del Banco de
Alimentos transcriptos, y el trabajo diferido de la sección 8), pero su "lo que falta
hacer" quedó viejo: la Tarea 1 ya tiene su ciclo SDD completo y la Tarea 2 está escrita.

Rama activa: `feat/acreditacion-trazabilidad`. **Nada commiteado**, todo sin versionar.

---

## 1. Qué se hizo en esta sesión

### Ciclo SDD completo de `acreditacion-progresiva`

Artefactos en `openspec/changes/acreditacion-progresiva/` y espejados en Engram
(#673 explore, #679 proposal, #681 spec, #682 design, #683 tasks):

- `explore.md`, `proposal.md`, `specs/` (seis archivos), `design.md` (11 ADRs),
  `tasks.md` (90 tareas en 6 fases), `decisiones-posteriores.md`.
- Escalera de cuatro niveles acumulativos: N0 `REGISTRADA`, N1 `IDENTIFICADA`,
  N2 `OPERATIVA`, N3 `ACREDITADA`. El nivel más alto equivale a estar en condiciones de
  darse de alta en el Banco de Alimentos.
- Catálogo de **8** requisitos (la unión de las dos listas fuente deduplica a 8, no 9),
  con la cita textual de cada fuente.
- `organizacion_evento` de sólo agregado, `organizacion_evidencia` inmutable salvo su
  estado, y `Organizacion.nivel` como columna almacenada.
- Compatibilidad hacia atrás: `estado = APROBADA ⟺ nivel ≥ N1`, así el sitio público y el
  BFF no se tocan.

### Documento de tesis

`docs/tesis/documento.md`, 1259 líneas, ocho secciones completas: Diagnóstico y Propuesta,
Objetivo, Límites, Alcances, Descripción del Sistema (15 RF, 15 RNF, 13 casos de uso con
plantilla estándar, tres diagramas de secuencia), Estructura de datos (diccionario de
siete tablas y nueve enums), Prototipos de interfaces, y Decisiones de arquitectura.

### Diagramas

Todos en `docs/tesis/diagramas/`, renderizados con PlantUML 1.2026.8
(`plantuml -tpng archivo.puml`):

Organizados en subcarpetas por tipo. Los `@startuml`/`@startsalt` no llevan nombre, así el
PNG toma el nombre del archivo `.puml`:

- `casos-uso/` — `general` (vista consolidada) más uno por actor: `visitante`, `donante`,
  `referente`, `administrador`, `motor-asignacion`. Estilo compartido en `_estilo.iuml`.
- `estructura/` — `der`, `clases`.
- `secuencia/` — `evidencia-acreditacion`, `donacion-fondo-comun`, `entrega-qr`.
- `ui/` — `evidencia-referente`, `cola-auditoria`, `legajo`, `mapa-publico`.
- `arquitectura/` — `deseada`, `mvp`.
- `despliegue/` — `general`, `raspberry`.

Los wireframes usan `@startsalt`/`@endsalt`: en esta instalación la forma
`@startuml` + `salt` no parsea.

---

## 2. Decisiones de producto tomadas (no reabrir)

1. **Requisitos del Banco de Alimentos**: unión de las dos listas. Los 50 km se miden
   desde el Banco de Alimentos; las opciones de documentación salen del formulario e
   incluyen `Aval`.
2. **Vencimiento de evidencia**: registrar y avisar. Cada evidencia guarda su validez, el
   sistema marca la vencida, pero el nivel **no baja solo** — lo baja un administrador con
   motivo, y queda registrado.
3. **Bitácora de sólo agregado, sin cadena de hashes.** La cadena se difiere: puede
   agregarse después sobre el mismo log. La justificación honesta de qué prueba y qué no
   está escrita para el capítulo de trazabilidad.
4. **El nivel topea categoría y concurrencia, nunca cantidades.** Es filtro duro en
   `acepta()` del worker, jamás un quinto término del score.
5. **El historial de cumplimiento sí entra al score**, pero sólo para donaciones al fondo
   común, y como peso, no como filtro. Falta definir el valor neutro para organizaciones
   sin historial y renormalizar los pesos actuales.
6. **La entrega se valida con QR de un solo uso y TTL**, confirmado por las dos partes.
7. **La reasignación de donaciones no retiradas queda fuera de alcance**, planteada como
   problema abierto en las conclusiones.
8. **El referente exporta la información de su propia organización** (D-01 en
   `decisiones-posteriores.md`, enmienda al design). Sub-decisión tomada por defecto y no
   confirmada: el export muestra el rol del auditor y su observación, no la identidad
   personal del administrador.

---

## 3. Qué sigue, en orden

### 3.1 Implementación de `acreditacion-progresiva`

Decisión abierta antes de empezar: Slice A sola se estima en **~2.800 a 3.600 líneas**,
muy por encima del presupuesto de 400, y la estrategia cacheada es `single-pr`. Hay que
elegir entre registrar `size:exception` o partir en slices.

Cuatro unidades de trabajo:

- **A1** — dominio MS, log de eventos, escalera, backfill con evento génesis
  `MIGRACION_INICIAL`.
- **A2** — evidencia, legajo, y el arreglo de `SecurityConfig`.
- **A3** — BFF y la lista de bloqueo del prefijo `org-evidencia/`.
- **A4** — SPA de admin.

Tres riesgos que `tasks.md` marca explícitamente y conviene no pisar:

1. El matcher de `SecurityConfig` debe declararse **antes** del bloque `permitAll` de
   `/api/organizaciones/**`, o los endpoints nuevos quedan legibles por cualquiera.
2. Agregar `nivel` a `OrganizacionResponse` rompe en tiempo de compilación la llamada
   posicional de `OrganizacionService.java:334-358`.
3. El backfill debe escribir el evento génesis o la invariante de reconstrucción es falsa
   para toda fila preexistente.

### 3.2 Diferido hasta después del documento (sección 8 de `handoff.md`)

- Enum `CategoriaAlimento` más columna `categoria` aditiva y nullable en `Necesidad`.
- Ruta autenticada y con chequeo de propiedad para los archivos de evidencia. Mientras no
  exista, **no se puede subir ninguna foto**: el guard de tres puntas va en la Slice A.

### 3.3 Cambios nuevos que salieron de esta sesión

- `entrega-qr-ttl` — validación de entrega con código de un solo uso. Reusa el patrón del
  OTP ya shippeado: hash BCrypt, columna de vencimiento, throttling, sin Redis.
- `scoring-historial-cumplimiento` — término de cumplimiento en el score del worker.

---

## 4. Trampas conocidas del entorno

- **El guard `gentle-ai sdd-preflight-hook` compara el ORDEN de las opciones**, no sólo
  las etiquetas. Las tres preguntas van en una sola llamada a `AskUserQuestion`, con las
  opciones en el orden canónico: `Interactive|Automatic`, `OpenSpec|Engram|Both`,
  `Ask me|Single PR|Auto`. Reordenarlas para poner la recomendada primero hace que rechace
  el despacho. Para depurarlo sin gastar llamadas a sub-agentes, se le puede pasar por
  stdin un payload de PreToolUse con el `transcript_path` de la sesión y leer si devuelve
  `allow` o `deny`.
- Los agentes de fase SDD no siempre tienen Write ligado. En modo `hybrid` puede pasar que
  sólo escriban en Engram; el orquestador materializa el archivo local.
- Los nombres de eventos: manda el **spec** (`EVIDENCIA_ADJUNTADA`, `NIVEL_ELEVADO`,
  `NIVEL_REDUCIDO`), no el design.

---

## 5. Preflight SDD de esta sesión

| Parámetro | Valor |
|---|---|
| Ritmo | `Automatic` |
| Artefactos | `Both` (hybrid) |
| Entrega | `Single PR` |

Restricciones de git vigentes: se puede commitear con Conventional Commits y **sin**
línea de co-autoría; no se puede pushear ni abrir pull requests; los cambios de rama se
manejan a nivel de feature entera.
