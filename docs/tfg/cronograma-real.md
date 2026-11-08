# Cronograma real a partir del historial de git (Entrega 4)

Este documento reúne mediciones tomadas del historial de git de este repositorio. No argumenta una conclusión: informa fechas, diferencias en días y los límites de la evidencia. La probabilidad del riesgo R1 (75 %) se fundamenta con estas diferencias en el texto de la tesis, no aquí.

## 1. Alcance y límite de la evidencia

- Repositorio medido: este monorepo, rama `tfg/entrega-4` (HEAD `ca681d6`, 2026-11-03), usando `git log --all` para incluir todas las ramas locales.
- Cantidad de commits alcanzables: 413 (`git rev-list --all --count`), de los cuales 48 son merges (`git log --all --merges --format=%h | wc -l`).
- Fechas: se usa la fecha de autor (`%ad`). Solo 2 de los 413 commits tienen fecha de autor distinta de la fecha de commit (`git log --all --format='%ad %cd' --date=short | awk '$1!=$2' | wc -l` devuelve 2).
- Límite principal: los servicios eran repositorios separados que se unieron en este monorepo el 2026-06-08 y su historia no fue migrada. Por eso el primer commit de `jar_hornero_ms`, `ts_hornero_bff` y `ts_hornero_app` es el commit de unión `a615bf5` (2026-06-08, 181 archivos, 28 264 líneas agregadas según `git show --stat a615bf5`). El trabajo anterior a esa fecha no está en git y no se puede fechar con esta fuente.
- La fecha de un commit es la fecha en que se registró el cambio, no necesariamente la fecha en que se trabajó. Ejemplo visible: 19 commits el 2026-09-21 y 59 el 2026-10-01 indican trabajo registrado por lotes.
- El trabajo sin commitear no se mide. Al iniciar la sesión el árbol principal tenía cambios sin commitear en `ts_hornero_admin/src/routes/` (`actividad.tsx`, `panel.tsx`) según el estado de git de la sesión.
- Si el código vivo en producción corresponde a este historial o a otro no se puede determinar desde el repositorio.

## 2. Plan de referencia (Gantt)

Fechas del encargo (año 2026): algoritmos 30/09 a 07/10; backend 30/09 a 21/10; frontend 21/10 a 11/11; despliegue 11/11.

Búsqueda de un Gantt dentro del repositorio:

- `docs/tesis/documento.md`: sin coincidencias para "Gantt" ni "cronograma" (`rg -n -i "gantt|cronograma" docs/tesis/documento.md`). La única coincidencia con "cronograma" en todo el repositorio es la lista de tareas `odd/tasks/tfg-entrega-4.md:51`, que nombra este archivo. No se encontraron las fechas 30/09, 07/10, 21/10 ni 11/11 en `docs/tesis/documento.md`.
- `entregas_tesis/Entrega Seminario de Analista .docx`: se extrajo el texto de `word/document.xml` (58 428 caracteres) y no contiene "gantt", "cronograma" ni esas fechas.
- `entregas_tesis/LucianoPeralta_Propuesta Seminario Final.pdf`: texto extraído con `pdftotext` (50 líneas); no contiene "gantt", "cronograma" ni esas fechas. Su portada indica fecha 22/08/26. Si el PDF contiene el Gantt como imagen, no se pudo leer.

Conclusión de la búsqueda: el único origen del Gantt es el texto del encargo. No hay un Gantt en el repositorio con el que contrastarlo, así que no se puede informar ninguna diferencia entre el Gantt del repositorio y el del encargo.

## 3. Comandos usados

Primera y última fecha por componente (todas las ramas):

```bash
for p in go_algorithms_worker jar_hornero_ms ts_hornero_bff ts_hornero_app ts_hornero_astro ts_hornero_admin; do
  git log --all --reverse --format='%ad %h %s' --date=short -- $p | head -1   # primer commit
  git log --all --format='%ad %h %s' --date=short -- $p | head -1             # último commit
done
```

Cantidad de commits por componente:

```bash
git log --all --format=%ad --date=short -- <ruta> | wc -l
```

Distribución diaria de commits de un componente:

```bash
git log --all --format='%ad' --date=short -- <ruta> | sort | uniq -c
```

Artefactos de despliegue:

```bash
git log --all --reverse --format='%h %ad %s' --date=short -- deploy docs/deploy-rpi-cloudflare.md
git log --all --reverse --format='%h %ad %s' --date=short -i --grep='deploy\|rpi\|raspberry\|cloudflare\|tunnel'
```

Diferencias en días: calculadas con `datetime.date` de Python (`(fecha_real - fecha_plan).days`). Signo: negativo = antes del plan; positivo = después del plan.

## 4. Evidencia por componente

| Componente | Ruta | Commits | Primer commit | Último commit |
|---|---|---|---|---|
| Algoritmos (trabajador Go) | `go_algorithms_worker/` | 23 | 2026-09-21 `5ac7bb4` "feat(worker): add go_algorithms_worker" | 2026-10-15 `f680c58` "docs: explain the assignment worker in depth" |
| Backend (microservicio) | `jar_hornero_ms/` | 117 | 2026-06-08 `a615bf5` (commit de unión) | 2026-11-03 `5f2e9e0` (merge); último `feat`: 2026-11-03 `d19133a` |
| Backend (BFF) | `ts_hornero_bff/` | 72 | 2026-06-08 `a615bf5` (commit de unión) | 2026-11-03 `d19133a` |
| Frontend admin (SPA) | `ts_hornero_admin/` | 115 | 2026-06-29 `8fdcaf8` "chore(admin): scaffold SPA" | 2026-11-03 `94c5bbf` "feat(admin): redesign referentes page..." |
| Frontend público (Astro) | `ts_hornero_astro/` | 27 | 2026-06-29 `c811c65` "chore(astro): scaffold public front" | 2026-10-29 `6d735e2` "feat(astro): load unclaimed map pins per viewport..." |
| Frontend anterior (Next.js, obsoleto) | `ts_hornero_app/` | 34 | 2026-06-08 `a615bf5` (commit de unión) | 2026-06-28 `54710d2` |

Distribución mensual de todos los commits (`git log --all --format='%ad' --date=format:%Y-%m | sort | uniq -c`): 2026-06: 87; 2026-07: 43; 2026-08: 1; 2026-09: 56; 2026-10: 209; 2026-11: 17.

Hueco sin commits: entre 2026-08-05 y 2026-09-21 no hay ningún commit (47 días).

Detalle del trabajo de algoritmos y de la lógica de asignación:

- `go_algorithms_worker/internal/assign/hungarian.go`, `scoring.go` y `ronda.go` se agregaron en `5ac7bb4` (2026-09-21); `cumplimiento.go` en `58448fb` (2026-10-01). Se obtuvo con `git log --all --diff-filter=A --format='%ad %h' --date=short -- <archivo>`.
- Resolutor de déficit: `b120484` (2026-09-30). Contrato v1 de la ronda: `a8ae04c` (2026-09-30). Servicio HTTP: `859bc7c` (2026-09-30). Término de cumplimiento: `58448fb` (2026-10-01). Pipeline de radios censales: `2248f50` (2026-10-12). Índice de vulnerabilidad: `3352cc9` (2026-10-13). Búsqueda de radio por punto: `e873944` (2026-10-15).
- Lado Java de la ronda (`jar_hornero_ms/src/main/java/org/example/asignacion`): 16 commits, del 2026-09-30 al 2026-10-15 (primer commit `cd8551b` 2026-09-30).
- Código de entrega (`.../donacion/entrega`): 5 commits, del 2026-09-30 al 2026-10-12.
- Acreditación (`.../acreditacion`): 15 commits, del 2026-09-21 al 2026-11-03 (primer commit `5c98d0d`, 2026-09-21).

Lo que cubre cada fila sale de la ruta consultada; el equivalente exacto de cada fase del Gantt con una ruta es una decisión de medición (ver sección 7).

## 5. Diferencias contra el Gantt del encargo

Convención: diferencia = fecha real menos fecha del plan, en días. Negativo = antes del plan; positivo = después.

| Fase | Plan inicio | Real inicio | Dif. inicio | Plan fin | Real fin (último commit) | Dif. fin |
|---|---|---|---|---|---|---|
| Algoritmos (`go_algorithms_worker/`) | 2026-09-30 | 2026-09-21 | -9 | 2026-10-07 | 2026-10-15 | +8 |
| Backend (`jar_hornero_ms/` y `ts_hornero_bff/`) | 2026-09-30 | 2026-06-08 (commit de unión) | -114 | 2026-10-21 | 2026-11-03 | +13 |
| Frontend (`ts_hornero_admin/` y `ts_hornero_astro/`) | 2026-10-21 | 2026-06-29 | -114 | 2026-11-11 | 2026-11-03 | -8 |
| Despliegue | 2026-11-11 | 2026-07-26 (primer artefacto) | -108 | no hay fin definido en el plan | último cambio de despliegue 2026-10-19 | -23 respecto de 11-11 |

Duraciones (días entre fecha de inicio y fecha de fin):

| Fase | Duración planificada | Duración medida por git |
|---|---|---|
| Algoritmos | 7 días (30/09 a 07/10) | 24 días (2026-09-21 a 2026-10-15) |
| Backend | 21 días (30/09 a 21/10) | 148 días (2026-06-08 a 2026-11-03) |
| Frontend | 21 días (21/10 a 11/11) | 127 días (2026-06-29 a 2026-11-03) |

Datos puntuales para interpretar las diferencias de algoritmos:

- Si se toma como inicio del algoritmo el 2026-09-30 del Gantt, el último commit del trabajador (2026-10-15) queda 15 días después de ese inicio, frente a los 7 días planificados.
- Del 2026-09-21 al 2026-09-29 hay 3 commits en `go_algorithms_worker/` (2 el 09-21, 1 el 09-29); el grueso de la actividad en esa ruta ocurre el 2026-09-30 (6 commits), el 2026-10-01 (3) y el 2026-10-15 (9).

## 6. Evidencia de despliegue

Fechas en el repositorio:

| Fecha | Commit | Hecho |
|---|---|---|
| 2026-06-17 | `a938bda` | "fix: going to prod goes brrrr". Es anterior al despliegue en la Pi; el merge `3bbb989` (2026-06-16, rama `feat/images-railway`) y la nota de `CLAUDE.md` sobre Railway indican un despliegue previo en Railway, ya dado de baja |
| 2026-07-26 | `0848acb` | "chore(deploy): containerize astro and admin for the self-hosted stack" |
| 2026-07-26 | `5be734b` | "docs: add deploy runbook and migration/planning notes" (primer commit de `docs/deploy-rpi-cloudflare.md`) |
| 2026-07-29 | `db0d22e` | "chore(deploy): pin minio, mc, and cloudflared image versions" |
| 2026-10-10 | `757ec4a` | "feat(ops): automated encrypted backups and restore drill" (agrega `deploy/systemd/`) |
| 2026-10-13 | `f939d51` | "docs: add the Cloudflare image cache rule to the runbook" |
| 2026-10-15 | `db03671` | "docs: add Pi deploy steps for live rondas" (última modificación de `docs/deploy-rpi-cloudflare.md`) |
| 2026-10-19 | `c5a60de` | "fix(deploy): restart stack services automatically after reboot" (último cambio de `docker-compose.yml`) |

Qué no se puede determinar: la fecha real de puesta en producción en la Raspberry Pi. El repositorio contiene el runbook y los archivos de despliegue, pero ningún commit, archivo ni documento registra el día de la puesta en marcha. Por eso la comparación con el 11/11 del Gantt se hace contra el primer artefacto de despliegue (2026-07-26, -108 días) y contra el último cambio (2026-10-19, -23 días), y ninguno de los dos es una fecha de puesta en producción.

## 7. Qué mide cada fila y qué queda sin medir

- Algoritmos: se midió sobre `go_algorithms_worker/` únicamente. El código Java que arma la entrada de la ronda (`jar_hornero_ms/.../asignacion`) comenzó el 2026-09-30 (`cd8551b`) y terminó el 2026-10-15; no se sumó a la fila.
- Backend: la fecha de inicio (2026-06-08) es la del commit de unión, no la del inicio real del desarrollo, que ocurrió antes y no está en git. La diferencia de -114 días es por tanto un límite inferior de la anticipación y no una medición del inicio.
- Backend, fin: el microservicio y el BFF siguen recibiendo commits hasta 2026-11-03, incluidos `feat`. El "último commit" es la última actividad registrada, no necesariamente el fin de la fase.
- Frontend: el panel y el sitio Astro comienzan el 2026-06-29 con el andamiaje (`8fdcaf8`, `c811c65`) y continúan hasta el 2026-11-03 (panel) y el 2026-10-29 (Astro). El frontend Next.js anterior (`ts_hornero_app/`) terminó el 2026-06-28 y está obsoleto según `CLAUDE.md`.
- Despliegue: ver sección 6.
- No se midió esfuerzo (horas), solo fechas de commits.
- No se consideró trabajo sin commit ni ramas no presentes en este clon.

## 8. Resumen de las mediciones (sin interpretación)

| Medición | Valor |
|---|---|
| Diferencia de inicio de algoritmos | -9 días |
| Diferencia de fin de algoritmos (último commit) | +8 días |
| Duración de algoritmos: plan frente a git | 7 frente a 24 días |
| Diferencia de fin de backend (último commit) | +13 días |
| Diferencia de fin de frontend (último commit) | -8 días |
| Diferencia de despliegue (primer artefacto frente a 11/11) | -108 días |
| Fecha real de puesta en producción | No determinable desde el repositorio |
| Trabajo anterior al 2026-06-08 | No determinable desde el repositorio |
