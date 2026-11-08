# Anexo E. Evidencia de pruebas

Fecha de ejecución: 2026-11-08. Código evaluado: commit `ca681d6` de la rama `develop`. Las pruebas se ejecutaron en un worktree separado (rama `tfg/entrega-4`, creada sobre ese commit). Las pruebas de Go agregadas en esta entrega (ver E.5 a E.7) se ejecutaron sobre el mismo árbol más tres archivos nuevos de prueba; no se modificó código de producción.

Entorno: Node v24.11.1, Java 17.0.17, Go 1.26.0 (darwin/arm64).

## E.1 Resultados por módulo

| Módulo | Comando | Pruebas | Pasadas | Fallidas | Omitidas | Duración | Cobertura de líneas |
|---|---|---|---|---|---|---|---|
| `jar_hornero_ms` | `mvn test -Pcoverage` | 1114 | 1114 | 0 | 0 | 42 s | 90,8 % (JaCoCo, 4820/5311) |
| `ts_hornero_bff` | `npm ci && npx jest --coverage` | 445 | 445 | 0 | 0 | 11 s (incluye `npm ci`) | 96,35 % (1297/1346) |
| `ts_hornero_admin` | `npm ci && npx vitest run --coverage` | 698 (107 archivos) | 698 | 0 | 0 | 20 s (incluye `npm ci`) | 86,57 % (3920/4528) |
| `go_algorithms_worker` | `go test -cover ./...` | 133 | 132 | 0 | 1 | 2 s | Por paquete (ver nota) |
| `ts_hornero_astro` | no aplica | 0 | 0 | 0 | 0 | no aplica | Sin pruebas |
| `e2e` | `make e2e` | 102 (12 archivos) | 102 | 0 | 0 | 130 s | no aplica |

Notas:

- Los conteos de Go incluyen subpruebas. Los 131 eventos de aprobación de la corrida del commit `ca681d6` pasan a 133 con las dos pruebas nuevas de esta entrega (E.5 y E.7); la omitida es la misma antes y después. La cobertura de Go se informa por paquete porque `go test -cover` no imprime un agregado: raíz 2,5 %, `api` 94,2 %, `assign` 96,5 %, `contrato` 84,9 %, `geo` 90,7 %, `metrics` 64,3 %, `radios` 94,3 %, `renacom` 86,3 %.
- Astro no tiene script de prueba en `package.json` ni archivos de prueba. Toda la capa pública renderizada por Astro (incluido el mapa público) queda sin pruebas automáticas.
- El BFF imprime líneas `ERROR` de Nest (filtro de excepciones, respuestas 404, 502 y 503) durante la corrida; son salida esperada de pruebas que ejercitan ese filtro, y la suite pasó.
- Las pruebas e2e corrieron sobre una pila aislada: proyecto de Compose propio (`hornero-tfg`), archivo de entorno descartable (secreto JWT y contraseña de base aleatorios, `MAIL_LOG_ONLY=true`, `EVIDENCIA_BORRADO_ENABLED=false`, datos de demostración habilitados) y MinIO local como almacenamiento (`AWS_ENDPOINT_URL=http://minio:9000`, verificado dentro de los contenedores antes de correr). No se leyeron los archivos `.env` del equipo. La pila y sus volúmenes se eliminaron al terminar. Por lo tanto, **los servicios externos (Cloudflare R2 y Resend) no se ejercitaron**: el comportamiento contra esos servicios reales no está probado por esta evidencia.
- Todas las duraciones son de una única corrida en la máquina del autor; no son mediciones repetidas.

## E.2 Prueba omitida

| Prueba | Ubicación | Motivo |
|---|---|---|
| `TestRondaSuperaAlArgmaxIndependiente` | `go_algorithms_worker/internal/assign/ronda_test.go:98` | Omisión condicional con `t.Skip("fixture no longer creates contention")`. La prueba exige que las dos donaciones prefieran de forma independiente la misma necesidad. Con los pesos y parámetros por defecto actuales, las dos prefieren necesidades distintas, por lo que la precondición de contención no se cumple y la prueba se omite. El fixture quedó desactualizado respecto del puntaje. |

La propiedad que esa prueba debía afirmar (la ronda global supera a la elección individual) se cubre ahora con una prueba nueva y separada (E.7). La prueba original no se modificó.

## E.3 Trazabilidad entre requisitos y pruebas

Las pruebas no llevan identificadores de requisito (RF, RNF, CU, objetivo): una búsqueda de esos prefijos en los archivos de prueba no dio resultados. La correspondencia se hizo por funcionalidad: para cada fila se leyeron los nombres de los métodos o casos de prueba de los archivos principales (por ejemplo `OrganizacionServiceTest`, `AcreditacionServiceCambiarNivelTest`, `EntregaServiceTest`, `DonacionesEstancadasJobTest`, los casos de `ronda_test.go` y los de las rutas de `ts_hornero_admin`, además de los títulos de las pruebas e2e) y no solo el nombre del archivo. Los archivos secundarios se asociaron por paquete y nombre.

Cómo leer los conteos: son declaraciones de prueba (`@Test`, `it`, `func Test*`) de los archivos asociados a cada fila, contadas estáticamente sobre las fuentes, no ejecuciones (los parametrizados y las subpruebas se expanden al ejecutar). Un archivo completo se cuenta aunque solo parte de sus casos corresponda a la fila, y un mismo archivo puede aparecer en más de una fila; por eso las filas no se pueden sumar. Los conteos de Go son de funciones `Test*` y no incluyen las pruebas agregadas en esta entrega salvo que se indique. Los números son una medida de volumen asociado, no de cobertura del requisito.

### E.3.1 Casos de uso (CU-01 a CU-13, `docs/tesis/documento.md`)

| CU | Funcionalidad | Archivos | MS | BFF | Admin | Go | e2e | Observación |
|---|---|---|---|---|---|---|---|---|
| CU-01 | Registrar organización | 11 | 96 | 7 | 30 | 0 | 8 | Cubre alta de referente y organización, política de contraseña, resolución de radio censal y alta con reintento de la organización. |
| CU-02 | Validar organización | 6 | 66 | 11 | 14 | 0 | 0 | Cubre validar y rechazar (nivel N1, estado `APROBADA`, evento) y la bandeja de referentes. Sin e2e propio. |
| CU-03 | Publicar necesidad | 17 | 73 | 18 | 33 | 0 | 5 | Cubre topes por nivel y categoría, visibilidad por nivel, vencimiento, relanzamiento y selector de artículos. |
| CU-04 | Consultar necesidades en el mapa | 6 | 10 | 3 | 2 | 0 | 7 | Cubre el endpoint público de mapa y su caché en el MS y el BFF. **El mapa público lo renderiza Astro, que no tiene pruebas**: la interfaz de CU-04 no está probada automáticamente. |
| CU-05 | Ofrecer donación | 28 | 182 | 66 | 51 | 0 | 30 | Cubre modalidades directa y fondo común, líneas por artículo, máquina de estados, visibilidad del donante y estancamiento. Es el caso con más pruebas. |
| CU-06 | Gestionar seguimiento de la organización | 7 | 90 | 7 | 30 | 0 | 0 | Cubre el panel de la organización, la decisión del referente sobre donaciones y la información pública. El conteo del MS incluye el archivo completo de `DonacionServiceTest`, de modo que está sobreestimado. Sin e2e propio. |
| CU-07 | Presentar evidencia de acreditación | 13 | 38 | 41 | 59 | 0 | 0 | Cubre carga, reemplazo, archivos de evidencia (foto y documento), formulario y pantalla de acreditación. Sin e2e. |
| CU-08 | Auditar evidencia presentada | 7 | 21 | 5 | 15 | 0 | 0 | Cubre aprobar y observar, cola de auditoría y vencimiento por fecha. Sin e2e. |
| CU-09 | Elevar o reducir nivel de acreditación | 11 | 29 | 0 | 13 | 0 | 0 | Cubre transiciones de un escalón, requisitos aprobados y vigentes, y los tests de invariante y repetición (E.4). El BFF no tiene archivo de prueba propio para este caso de uso. Sin e2e. |
| CU-10 | Exportar legajo de acreditación | 2 | 8 | 0 | 2 | 0 | 0 | **Cobertura mínima**: ocho casos de ensamblado del legajo en el MS y dos de la vista. No hay prueba del BFF ni e2e de la exportación. |
| CU-11 | Asignar donaciones del fondo común | 30 | 88 | 15 | 28 | 60 | 5 | Cubre el motor (puntaje, Hungarian, restricciones duras, contrato), la orquestación en el MS (ronda en curso, worker caído, descarte por concurrencia) y el panel de rondas. |
| CU-12 | Verificar correo electrónico | 7 | 22 | 0 | 2 | 0 | 8 | Cubre emisión, vencimiento, bloqueo al quinto intento y reenvío con límite de frecuencia. |
| CU-13 | Validar entrega con código de un solo uso | 17 | 33 | 6 | 49 | 0 | 5 | Cubre código con hash y vencimiento de 10 minutos, bloqueo al quinto intento, QR y escáner. |

Casos de uso sin cobertura: ninguno carece por completo de pruebas. Los puntos débiles son CU-10 (cobertura mínima, sin e2e ni BFF) y CU-04 (sin pruebas de la interfaz pública en Astro). CU-02, CU-07, CU-08, CU-09 y CU-10 no tienen pruebas e2e.

### E.3.2 Objetivos específicos (`docs/tesis/capitulos-finales.md`, tabla de cumplimiento)

La numeración sigue el orden de la tabla de objetivos específicos de `capitulos-finales.md`.

| Obj. | Objetivo | Archivos | MS | BFF | Admin | Go | e2e | Observación |
|---|---|---|---|---|---|---|---|---|
| 1 | Modelo de acreditación progresiva | 32 | 86 | 46 | 87 | 0 | 0 | Unión de CU-07, CU-08 y CU-09 más los topes por nivel. |
| 2 | Motor de asignación que prioriza los pedidos | 27 | 88 | 15 | 26 | 51 | 5 | Unión de los archivos de CU-11 relativos al motor y la ronda. |
| 3 | Reasignaciones automáticas de donaciones no retiradas | 3 | 24 | 0 | 0 | 0 | 0 | **Cobertura parcial y solo de bloques constructivos.** Hay pruebas de la cancelación de ofertas directas a los siete días, de propuestas sin respuesta que vuelven al fondo a los tres días, de ventanas de estancamiento y de la ronda programada. No hay una prueba que afirme la reasignación automática de una donación no retirada a otra organización de punta a punta, en coherencia con que el objetivo figure como no cumplido. |
| 4 | Trazabilidad del ciclo de la donación | 35 | 104 | 13 | 49 | 0 | 20 | Cubre el código de entrega, el registro de actividad (escritura aislada y en la misma transacción), la idempotencia, los eventos de acreditación y el invariante (E.4). |
| 5 | Indicadores de cobertura y zonas desatendidas | 12 | 13 | 3 | 8 | 17 | 0 | Cubre el cálculo de déficit contra la mediana, la resolución de radio, la carga de ReNaCoM y el mapa por zona. Cobertura baja en `metrics` (64,3 %) y ninguna del mapa en Astro. |
| 6 | Legajos exportables | 2 | 8 | 0 | 2 | 0 | 0 | Mismos archivos que CU-10, con cobertura mínima. |

Objetivos sin cobertura: ninguno carece de pruebas, pero el objetivo 3 solo tiene cobertura de bloques constructivos y el objetivo 6 tiene cobertura mínima.

### E.3.3 Colisiones de identificadores

Los identificadores RF y RNF se repiten con significados distintos entre `docs/tesis/documento.md` y `docs/tesis/correcciones-requerimientos.md`. Por ejemplo, RNF16 (determinismo) y RNF18 (límites de la ronda) existen solo en la numeración de `correcciones-requerimientos.md`, mientras que RNF-14 y RNF-15 (invariante evento-nivel) existen solo en `documento.md`. La tabla completa de colisiones está en la sección "Numeración" de `docs/tfg/reglas-negocio.md`; los identificadores de este anexo deben unificarse con ella antes de la versión final.

## E.4 Invariante entre eventos y nivel de acreditación

Se leyeron ambas pruebas en `jar_hornero_ms/src/test/java/org/example/acreditacion/`.

| Prueba | Tipo | Qué afirma |
|---|---|---|
| `AcreditacionInvariantTest.replayMatchesStoredLevelAfterAFullUpDownSequence` | Integración con contexto de Spring completo | Crea una organización en N0 y la lleva por los métodos reales del servicio (`cargarEvidencia`, `aprobarEvidencia`, `cambiarNivel`) por la secuencia N0 a N1 a N2 a N3 y de vuelta a N2. Luego relee la organización y la bitácora ordenada por fecha e identificador, y afirma que el nivel guardado es N2 y que `AcreditacionReplay.reconstruir(eventos)` es igual al nivel guardado. |
| `AcreditacionReplayTest` (4 casos) | Unitaria, función pura, sin Spring | Lista vacía da N0; un evento `NIVEL_ELEVADO` N0 a N1 da N1; la secuencia completa N0, N1, N2, N3, N2 da N2; los eventos sin nivel posterior (evidencia adjuntada, requisito aprobado) se omiten en el pliegue. |

Alcance de la afirmación: la igualdad se verifica para una única secuencia ascendente y descendente de una organización y para cuatro casos puros de reconstrucción. No es una prueba por propiedades sobre secuencias arbitrarias, ni verifica la atomicidad evento-nivel bajo fallo (rollback) de la transacción.

## E.5 Determinismo de la ronda (RNF16)

Se agregó `go_algorithms_worker/internal/assign/ronda_determinismo_test.go` con `TestRondaDeterministaMismaEntrada`: 100 donaciones por 100 necesidades generadas con semilla fija, se ejecuta `Ronda` y se compara con `reflect.DeepEqual` el resultado completo de otras 50 ejecuciones con la misma entrada y el mismo orden. Pasa.

Esa prueba solo demuestra repetibilidad con el mismo orden de entrada. Se hizo además un experimento descartable, no incluido en el repositorio, que baraja el orden de donaciones y necesidades:

| Escenario | Resultado |
|---|---|
| 30 semillas, 60 por 60, fixture realista sin empates exactos | El conjunto de pares donación-necesidad fue idéntico en las 30 semillas con el orden barajado (el puntaje total difiere en el último dígito decimal por el orden de suma de punto flotante). |
| 30 semillas, 60 por 60, todas las necesidades y donaciones idénticas (empates exactos de puntaje) | Los pares difieren en las 30 semillas al barajar. |
| Mínimo: 2 donaciones y 2 necesidades idénticas, ids 1 y 2 y 10 y 11 | Orden original: (1 con 10, 2 con 11). Mismas donaciones, necesidades invertidas: (1 con 11, 2 con 10). |

Conclusión: la afirmación "misma entrada, misma salida" vale solo si se fija también el orden de las listas. Cuando hay empates exactos, el resultado depende del orden de las necesidades recibidas, porque el código no define un orden total para desempatar. Es una brecha conocida respecto de RNF16 en su redacción general ("con los mismos datos de entrada"); se deriva a la tarea D3. No se escribió una prueba que falle ni se modificó código de producción. Coincide con la observación de RN-05 en `docs/tfg/reglas-negocio.md`: el orden de las filas que devuelve la base de datos puede influir en los empates.

## E.6 Rendimiento (RNF18)

Se agregó `BenchmarkRonda500x500` en `go_algorithms_worker/internal/assign/ronda_benchmark_test.go`. Usa un fixture reproducible (semilla 42) de 500 donaciones y 500 necesidades dispersas en unos 20 km alrededor de Córdoba, con cuatro categorías, déficit, urgencia, espera y cumplimiento variables, una tercera parte de las organizaciones con restricción de categorías y hasta dos organizaciones excluidas por donación. Invoca `assign.Ronda`, la misma función que llaman el manejador HTTP `/v1/ronda` y el subcomando `assign` del worker; no incluye decodificación JSON, resolución geográfica ni red.

Comando: `go test -bench=Ronda500x500 -benchtime=5x -run=^$ ./internal/assign/`

| Corrida | Tiempo por ronda | Memoria por ronda | Asignaciones de memoria |
|---|---|---|---|
| 1 | 118,9 ms | 10,9 MB | 2020 |
| 2 | 128,5 ms | 10,9 MB | 2020 |
| 3 | 124,3 ms | 10,9 MB | 2020 |
| 4 | 122,0 ms | 10,9 MB | 2020 |

Máquina: la del autor, una Mac con Apple M3 Pro (`machdep.cpu.brand_string`), 12 hilos lógicos y 38 654 705 664 bytes (36 GiB) de memoria (`hw.memsize`). **No es la Raspberry Pi** de producción. El límite de 30 segundos de RNF18 está holgadamente cumplido en esta máquina (unos 0,12 s), pero **no está probado en la Raspberry Pi**; extrapolar a ese equipo requiere medirlo allí.

El worker limita las entradas a 500 donaciones y 500 candidatos: `limiteItems = 500` en `go_algorithms_worker/internal/contrato/ronda_v1.go`, aplicado en `Validar`, con la prueba `TestValidarLimiteExacto500NoFalla`. Una ronda mayor se rechaza con error de contrato. El plazo de 30 segundos corresponde a la espera del MS por la llamada al worker, no a un límite dentro del worker; no se midió el recorrido completo (MS, red y base de datos).

## E.7 Contención y óptimo global

Se agregó `go_algorithms_worker/internal/assign/ronda_contencion_test.go` con `TestRondaGlobalSuperaAlGreedyBajoContencion`. El fixture tiene dos donaciones que, tomadas por separado, prefieren la misma necesidad (la prueba lo verifica con los pesos por defecto antes de afirmar nada). La donación 1 la prefiere por poco; la donación 2, por mucho. La prueba compara el puntaje total de `Ronda` con el de un algoritmo voraz que procesa las donaciones en orden y asigna a cada una su mejor necesidad libre, y exige que el de `Ronda` sea estrictamente mayor, además de que la donación 2 reciba la necesidad en disputa. Con los valores actuales: ronda 1,2510 contra voraz 1,1296. Pasa contra el código actual.

Esta prueba es complementaria y no reemplaza a `TestRondaSuperaAlArgmaxIndependiente`, que se deja sin tocar y sigue omitida. Aporta la propiedad que aquella prueba pretendía afirmar, con un fixture que sí produce contención con los pesos actuales. Si se decide reemplazarla, la decisión corresponde a la tarea D3; no se hizo aquí.

## E.8 Limitaciones

- Una sola corrida por módulo, sin repeticiones; los tiempos de las suites incluyen `npm ci` en BFF y Admin.
- Las pruebas e2e no ejercitan Cloudflare R2 ni Resend, ni se corrieron en la Raspberry Pi.
- La cobertura de líneas mide ejecución, no verificación de requisitos.
- Astro (capa pública) no tiene pruebas.
- La trazabilidad es por funcionalidad y por lectura de pruebas, no por identificadores; los conteos por archivo están sobreestimados cuando el archivo mezcla casos de uso.
