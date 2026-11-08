# Anexo E. Evidencia de pruebas

Fecha de ejecución de la corrida final: 2026-11-08. Código evaluado: commit `b1419c2` de la rama `tfg/entrega-4` (creada sobre `ca681d6` de `develop`); los números de E.1 (microservicio, BFF y panel) son los de la corrida sobre ese commit, posterior a D4; Go y e2e son los de la corrida sobre `08ead82`, porque D4 no tocó el worker y la aserción e2e nueva no se ejecutó contra una pila y reemplazan a los de la corrida inicial sobre `ca681d6`. Los commits posteriores a `b1419c2` solo agregan o modifican documentación en `docs/tfg/`.

Entorno: Node v24.11.1, Java 17.0.17, Go 1.26.0 (darwin/arm64).

## E.1 Resultados por módulo

| Módulo | Comando | Pruebas | Pasadas | Fallidas | Omitidas | Duración | Cobertura de líneas |
|---|---|---|---|---|---|---|---|
| `jar_hornero_ms` | `mvn test -Pcoverage` | 1276 | 1268 | 0 | 8 | 69 s (Maven) | 91,85 % (JaCoCo, 5492/5979) |
| `ts_hornero_bff` | `npx jest --coverage` | 480 (54 suites) | 480 | 0 | 0 | 3,7 s (`npm ci` aparte: 7 s) | 96,79 % (1328/1372) |
| `ts_hornero_admin` | `npx vitest run --coverage` | 707 (107 archivos) | 707 | 0 | 0 | 18,7 s (`npm ci` aparte: 4 s) | 86,63 % (3942/4550) |
| `ts_hornero_admin` | `npm run build` (`tsc -b && vite build`) | no aplica | no aplica | 0 | no aplica | 7 s | Compila; solo advertencia de tamaño de fragmentos |
| `ts_hornero_admin` | `npm run lint` | no aplica | no aplica | 0 errores | no aplica | 4 s | 3 advertencias (directivas `eslint-disable` sin uso) |
| `go_algorithms_worker` | `go test -cover ./...` y `go test -json -count=1 ./...` | 142 (subpruebas incluidas) | 141 | 0 | 1 | 2 s | Por paquete (ver nota) |
| `go_algorithms_worker` | `go test -bench=Ronda500x500 -benchtime=5x -run=^$ ./internal/assign/` | no aplica | no aplica | 0 | no aplica | 217,9 ms por ronda (ver E.6) | no aplica |
| `ts_hornero_astro` | `npm run build` | 0 (sin pruebas) | 0 | 0 | 0 | 4 s | Compila; sin pruebas |
| `e2e` | `make e2e` | 151 (15 archivos) | 151 | 0 | 0 | 201 s | no aplica; la aserción de D4 en `14-acreditacion` (152.º caso) no se ejecutó contra una pila |

Notas:

- Los conteos de Go son eventos `pass` y `skip` de `go test -json -count=1` (pruebas y subpruebas: 141 aprobadas, 1 omitida, 0 fallidas); la corrida inicial sobre `ca681d6` dio 131 aprobadas y 1 omitida. La cobertura de Go se informa por paquete porque `go test -cover` no imprime un agregado: raíz 2,5 %, `api` 94,2 %, `assign` 96,8 %, `contrato` 85,0 %, `geo` 90,7 %, `metrics` 64,3 %, `radios` 94,3 %, `renacom` 86,3 %. La corrida de cobertura usó la caché de Go para algunos paquetes (raíz, `geo`, `metrics`, `radios`, `renacom`); sus porcentajes no cambian por ello.\n- Las 8 pruebas omitidas del microservicio son las que requieren PostgreSQL (la suite de `mvn test` usa H2); se ejecutan a mano contra un contenedor descartable (E.8 y `docs/tfg/seguridad-c4.md`). La corrida inicial sobre `ca681d6` tenía 1114 pruebas y ninguna omitida.\n- Evolución de los conteos desde la corrida inicial: microservicio 1114 a 1276, BFF 445 a 480, panel de administración 698 a 707, Go 131 a 141 aprobadas, e2e 102 a 151.
- Astro no tiene script de prueba en `package.json` ni archivos de prueba. Toda la capa pública renderizada por Astro (incluido el mapa público) queda sin pruebas automáticas.
- El BFF imprime líneas `ERROR` de Nest (filtro de excepciones, respuestas 404, 502 y 503) durante la corrida; son salida esperada de pruebas que ejercitan ese filtro, y la suite pasó.
- Las pruebas e2e corrieron sobre una pila aislada: proyecto de Compose propio (`hornero-tfg`), archivo de entorno descartable (secreto JWT y contraseña de base aleatorios, `MAIL_LOG_ONLY=true`, `EVIDENCIA_BORRADO_ENABLED=false`, datos de demostración habilitados) y MinIO local como almacenamiento (`AWS_ENDPOINT_URL=http://minio:9000`, verificado dentro de los contenedores antes de correr). No se leyeron los archivos `.env` del equipo. La pila y sus volúmenes se eliminaron al terminar. Por lo tanto, **los servicios externos (Cloudflare R2 y Resend) no se ejercitaron**: el comportamiento contra esos servicios reales no está probado por esta evidencia.
- El total de e2e subió de 102 (corrida de `ca681d6`) a 151: 11 casos del archivo `13-session-revocation` (tarea C2) y 38 casos nuevos de la tarea D5 (`14-acreditacion`, 33 casos, y `15-reasignacion`, 5). La corrida de 151 casos se hizo sobre la rama `tfg/entrega-4` con los archivos de D5, en una pila aislada igual a la descrita arriba (MinIO local confirmado en bff y ms antes de correr); su duración de 235 s (corrida de D5) incluye las esperas por el límite de frecuencia de autenticación del BFF (5 inicios de sesión por minuto), de modo que no mide el rendimiento del sistema.
- Corrida e2e final (commit `08ead82`): 151 de 151 casos, 15 archivos, 201 s, en una pila aislada nueva (proyecto `hornero-tfg`, archivo de entorno descartable con secreto JWT y contraseña de base generados, `SEED_DEMO_DATA=true`, `MAIL_LOG_ONLY=true`, `EVIDENCIA_BORRADO_ENABLED=false`, `EVIDENCIA_RETENCION_ENABLED=false`, `AUDITORIA_ANCLA_ENABLED=false`, MinIO local). Antes de correr se confirmó dentro de `bff` y `ms` que `AWS_ENDPOINT_URL=http://minio:9000` y el bucket `hornero-images`. La base se levantó vacía y se siguió el orden de despliegue de la Raspberry Pi: arranque de la imagen, comprobación de que `organizacion_evento` no tuviera filas con `hash IS NULL` (0), `make migrate` (respaldo y aplicación de V001 a V015, todos con salida 0) y reinicio del microservicio. El arranque sobre una base vacía registra 6 avisos `ESQUEMA_PENDIENTE` (entre ellos los de V004, V006, V008, V009 y V013; no se registró el texto del sexto) hasta aplicar los scripts; la comprobación posterior al reinicio figura en la sección E.9. La pila, sus volúmenes y el archivo de entorno se eliminaron al terminar.
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
| CU-07 | Presentar evidencia de acreditación | 14 | 38 | 41 | 59 | 0 | 10 | Cubre carga, reemplazo, archivos de evidencia (foto y documento), formulario y pantalla de acreditación. El e2e (`14-acreditacion`, 10 casos) sube un PDF por la ruta real, verifica por contenido el tipo permitido, la propiedad de la organización (403 y 401), el rechazo de una clave de archivo en una declaración, la entrega del archivo solo al dueño y al administrador (con `nosniff`, `attachment` y `no-store`) y que reenviar un requisito deja la fila anterior como `REEMPLAZADA`. No ejercita la pantalla del referente ni fotos (solo PDF). |
| CU-08 | Auditar evidencia presentada | 8 | 21 | 5 | 15 | 0 | 6 | Cubre aprobar y observar, cola de auditoría y vencimiento por fecha. El e2e (6 casos) recorre la cola global, el 403 de referente y donante, observar con motivo visible para el dueño en el legajo, reemplazar la observada y aprobar, y comprueba que la aprobación fija una vigencia de alrededor de un año (RN-04). |
| CU-09 | Elevar o reducir nivel de acreditación | 12 | 29 | 0 | 13 | 0 | 12 | Cubre transiciones de un escalón, requisitos aprobados y vigentes, y los tests de invariante y repetición (E.4). El BFF no tiene archivo de prueba propio para este caso de uso. El e2e (11 casos más uno de limpieza) recorre la escalera N0 a N3 con una organización nueva: 409 al faltar requisitos o tener uno solo pendiente, 400 `Invalid state transition` al saltar un nivel con todos los requisitos aprobados, subida de un nivel a la vez, bajada con motivo, categorías por nivel (una necesidad REFRIGERADO se rechaza con 409 en N1 y se acepta en N2) y una evidencia ya vencida que bloquea la subida (409) hasta ser reemplazada. |
| CU-10 | Exportar legajo de acreditación | 3 | 8 | 0 | 2 | 0 | 5 | Ocho casos de ensamblado del legajo en el MS y dos de la vista, más cinco casos e2e que leen el legajo por la API (dueño y administrador 200; otro referente, donante y anónimo 403 o 401; 404 si no existe): ocho requisitos, nivel y fecha, texto de descargo, bitácora cronológica completa desde `ORGANIZACION_REGISTRADA` hasta el último `NIVEL_ELEVADO`, con el último nivel de la bitácora igual al guardado. **No hay prueba del BFF ni del PDF**: el PDF lo genera el navegador al imprimir la pantalla del legajo (`legajo.tsx`) a partir de ese JSON, y eso no se ejecuta en ninguna prueba. |
| CU-11 | Asignar donaciones del fondo común | 30 | 88 | 15 | 28 | 60 | 5 | Cubre el motor (puntaje, Hungarian, restricciones duras, contrato), la orquestación en el MS (ronda en curso, worker caído, descarte por concurrencia) y el panel de rondas. |
| CU-12 | Verificar correo electrónico | 7 | 22 | 0 | 2 | 0 | 8 | Cubre emisión, vencimiento, bloqueo al quinto intento y reenvío con límite de frecuencia. |
| CU-13 | Validar entrega con código de un solo uso | 17 | 33 | 6 | 49 | 0 | 5 | Cubre código con hash y vencimiento de 10 minutos, bloqueo al quinto intento, QR y escáner. |

Casos de uso sin cobertura: ninguno carece por completo de pruebas. Los puntos débiles son CU-10 (el PDF del legajo no se prueba; solo sus datos) y CU-04 (sin pruebas de la interfaz pública en Astro). Solo CU-02 no tiene pruebas e2e propias; CU-07 a CU-10 las tienen desde la tarea D5 (archivos `14-acreditacion` y `15-reasignacion`, ver más abajo). Los conteos e2e de esas filas son los de D5 y no se sumaron a los de otros archivos e2e que ejercitan los mismos endpoints (por ejemplo `04-authz-validation-override`).

### E.3.2 Objetivos específicos (`docs/tesis/capitulos-finales.md`, tabla de cumplimiento)

La numeración sigue el orden de la tabla de objetivos específicos de `capitulos-finales.md`.

| Obj. | Objetivo | Archivos | MS | BFF | Admin | Go | e2e | Observación |
|---|---|---|---|---|---|---|---|---|
| 1 | Modelo de acreditación progresiva | 33 | 86 | 46 | 87 | 0 | 28 | Unión de CU-07, CU-08 y CU-09 más los topes por nivel. El e2e (28 casos: 10 + 6 + 11 + 1 de limpieza) ejercita la escalera completa contra la API real. |
| 2 | Motor de asignación que prioriza los pedidos | 27 | 88 | 15 | 26 | 51 | 5 | Unión de los archivos de CU-11 relativos al motor y la ronda. |
| 3 | Reasignaciones automáticas de donaciones no retiradas | 4 | 24 | 0 | 0 | 0 | 5 | **Cobertura parcial y solo de bloques constructivos.** Hay pruebas de la cancelación de ofertas directas a los siete días, de propuestas sin respuesta que vuelven al fondo a los tres días, de ventanas de estancamiento y de la ronda programada. Desde D5 hay un e2e (`15-reasignacion`, 5 casos) del camino manual: una donación del fondo común propuesta a una organización que la rechaza vuelve al fondo (`OFRECIDA`, sin necesidad), la asignación pasa a `RECHAZADA` y las rondas siguientes nunca se la proponen otra vez a esa organización; el bucle prosigue hasta que no queda ninguna organización compatible. **No se pudo probar de punta a punta la reasignación de una propuesta sin respuesta** (3 días, trabajo diario `DonacionesEstancadasJob`): no tiene endpoint ni reloj inyectable, y solo la cubre la prueba del MS, que usa el mismo camino de devolución al fondo. Tampoco hay una prueba que afirme la reasignación de una donación aceptada y no retirada (estancada), que el sistema solo marca y no reasigna. Por eso el objetivo sigue sin considerarse cumplido por completo. |
| 4 | Trazabilidad del ciclo de la donación | 35 | 104 | 13 | 49 | 0 | 20 | Cubre el código de entrega, el registro de actividad (escritura aislada y en la misma transacción), la idempotencia, los eventos de acreditación y el invariante (E.4). |
| 5 | Indicadores de cobertura y zonas desatendidas | 12 | 13 | 3 | 8 | 17 | 0 | Cubre el cálculo de déficit contra la mediana, la resolución de radio, la carga de ReNaCoM y el mapa por zona. Cobertura baja en `metrics` (64,3 %) y ninguna del mapa en Astro. |
| 6 | Legajos exportables | 3 | 8 | 0 | 2 | 0 | 5 | Mismos archivos que CU-10: los datos del legajo tienen e2e; el PDF no se prueba. |

Objetivos sin cobertura: ninguno carece de pruebas. El objetivo 3 queda con cobertura parcial (rechazo manual y exclusión probados de punta a punta; expiración y estancamiento solo en el MS) y el objetivo 6 con cobertura de datos pero no del PDF.

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

Conclusión de ese experimento (antes de la tarea D3): la afirmación "misma entrada, misma salida" valía solo si se fijaba también el orden de las listas, porque el código no definía un orden total para desempatar.

### Estado después de la tarea D3

Se implementó el desempate de RN-05 (mayor puntaje, necesidad abierta hace más tiempo, menor id; detalle en `docs/tfg/reglas-negocio.md`, RN-05) y se agregaron pruebas en `go_algorithms_worker/internal/assign/desempate_test.go`:

| Prueba | Qué verifica | Rojo observado antes de implementar |
|---|---|---|
| `TestRondaEsDeterministaConEmpatesExactos` | 40 semillas, 2 a 8 donaciones y necesidades con empates exactos; 8 barajados por semilla; el `Resultado` completo es idéntico (`reflect.DeepEqual`) | Falló en la semilla 1, primer barajado |
| `TestDesempateAntiguedadLuegoID` | Con puntaje igual gana la necesidad abierta más tiempo y luego el menor id, en las 6 permutaciones de entrada | Falló: eligió la necesidad 30 en lugar de la 20 |
| `TestDesempateElPuntajeMayorPrevalece` | Un puntaje estrictamente mayor gana aunque la necesidad sea nueva | Pasa (no hay rojo: es el comportamiento previo que debe conservarse) |
| `TestDesempateEntreDonacionesGanaElMenorID` | Dos donaciones idénticas por una necesidad: se asigna la de menor id | Falló: se asignó la donación 7 |
| `TestDesempateEmparejaMenorIDConLaMasAntigua` | Con todo empatado, la donación de menor id recibe la necesidad más antigua | Falló: la donación 1 recibió la 50 en lugar de la 40 (con una primera versión del criterio secundario; se corrigió el tercer nivel) |
| `TestHungarianLexMinimizaElDesempateEntreOptimos` | 400 matrices pequeñas con costos enteros repetidos: el resultado coincide con el mínimo lexicográfico por fuerza bruta | Falló en el caso 2 con el solver sin criterio secundario |

Una verificación de sensibilidad: si en `Ronda` se anula el criterio secundario (se pasa `nil`), solo falla `TestDesempateEntreDonacionesGanaElMenorID`; el resto pasa porque el orden canónico ya produce ese resultado en esos casos. Por eso la regla enunciada se prueba contra fuerza bruta a nivel del solver y no solo con casos de `Ronda`.

Alcance de la afirmación: el determinismo se verifica para el worker (`assign.Ronda`) con entradas barajadas y empates exactos de puntaje. Del lado del MS solo se verifica que las dos consultas aplican `ORDER BY` sobre H2. No se midió de punta a punta contra PostgreSQL, y dos puntajes que difieren en el último bit de punto flotante no son un empate.

## E.6 Rendimiento (RNF18)

Se agregó `BenchmarkRonda500x500` en `go_algorithms_worker/internal/assign/ronda_benchmark_test.go`. Usa un fixture reproducible (semilla 42) de 500 donaciones y 500 necesidades dispersas en unos 20 km alrededor de Córdoba, con cuatro categorías, déficit, urgencia, espera y cumplimiento variables, una tercera parte de las organizaciones con restricción de categorías y hasta dos organizaciones excluidas por donación. Invoca `assign.Ronda`, la misma función que llaman el manejador HTTP `/v1/ronda` y el subcomando `assign` del worker; no incluye decodificación JSON, resolución geográfica ni red.

Comando: `go test -bench=Ronda500x500 -benchtime=5x -run=^$ ./internal/assign/`

| Corrida | Tiempo por ronda | Memoria por ronda | Asignaciones de memoria |
|---|---|---|---|
| 1 | 118,9 ms | 10,9 MB | 2020 |
| 2 | 128,5 ms | 10,9 MB | 2020 |
| 3 | 124,3 ms | 10,9 MB | 2020 |
| 4 | 122,0 ms | 10,9 MB | 2020 |

Esas cuatro corridas son anteriores al desempate de RN-05. En la corrida final (commit `08ead82`) una sola ejecución con `-benchtime=5x` dio 217,9 ms por ronda, 35,7 MB y 2533 asignaciones de memoria, en la misma máquina. Después de implementarlo (orden canónico y criterio secundario en el solver), tres corridas con el mismo comando dieron 210,7 ms, 210,8 ms y 210,1 ms, con 35,7 MB y 2532 a 2533 asignaciones de memoria por ronda, en la misma máquina.

Máquina: la del autor, una Mac con Apple M3 Pro (`machdep.cpu.brand_string`), 12 hilos lógicos y 38 654 705 664 bytes (36 GiB) de memoria (`hw.memsize`). **No es la Raspberry Pi** de producción. El límite de 30 segundos de RNF18 está holgadamente cumplido en esta máquina (unos 0,21 s con el desempate; 0,12 s antes), pero **no está probado en la Raspberry Pi**; extrapolar a ese equipo requiere medirlo allí.

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

## E.8 Concurrencia de rondas (RN-08)

Se agregaron `RondaCerrojoTest` (8 casos, base simulada), dos casos nuevos en `RondaServiceTest` y `RondaConcurrenciaIntegrationTest` (5 casos) en `jar_hornero_ms/src/test/java/org/example/asignacion/`. El detalle de cada prueba y del diseño del lock está en `docs/tfg/reglas-negocio.md`, RN-08.

| Escenario | H2 (`mvn test`) | PostgreSQL 16 descartable |
|---|---|---|
| Dos rondas en paralelo en una instancia: la segunda recibe 409 `RONDA_EN_CURSO`, la donación se asigna una vez | Pasa | Pasa |
| Dos rondas que leen el mismo fondo con el lock omitido: una asigna y la otra descarta; una sola fila de asignación | Pasa | Pasa |
| El índice V013 rechaza la segunda `PROPUESTA`; V013 es idempotente; V013 aborta con mensaje claro si hay duplicados previos | Omitida | Pasa |
| El advisory lock excluye a una segunda instancia y se libera al cerrar | Omitida | Pasa |

El proyecto no tiene una forma de levantar PostgreSQL desde `mvn test` (H2 y sin Testcontainers), de modo que las dos últimas filas se omiten por defecto y se ejecutaron a mano contra un contenedor local `postgres:16` con variables `SPRING_DATASOURCE_*` (3 corridas, 5 de 5). Un resultado en H2 no prueba un comportamiento de PostgreSQL. No se probó con dos procesos del MS reales ni en la Raspberry Pi, y el índice V013 no se aplicó a la base de producción.

## E.9 Orden de despliegue y esquema sobre una base vacía

Se ejercitó la secuencia de la Raspberry Pi sobre una base PostgreSQL 16 vacía, en una pila local aislada (proyecto `hornero-tfg`, MinIO local, archivo de entorno descartable). Fecha: 2026-11-08, commit `08ead82`. Se hizo en dos corridas de la pila: la primera ejecutó además `make e2e` (E.1) y la segunda se dedicó solo a verificar el estado del esquema después de migrar.

| Paso | Resultado observado |
|---|---|
| Primer arranque del microservicio con la base vacía | Sano. 6 avisos `ESQUEMA_PENDIENTE` en el log (los scripts `V*.sql` no se habían aplicado) en ambas corridas |
| Filas de `organizacion_evento` con `hash IS NULL` | 0 |
| `make migrate` (respaldo y V001 a V015 en orden) | Salida 0; el respaldo se escribió en un directorio temporal fuera del repositorio |
| Reinicio del microservicio y búsqueda de `ESQUEMA_PENDIENTE` solo en el log posterior al reinicio (`docker compose logs --since`) | 0 apariciones; el log posterior incluye `hash chain backfill complete (idempotent): 0 event(s) sealed` y `hash chain verified: 3 event(s) in 3 chain(s), 0 pending seal` |

Limitación: en la primera corrida el recuento posterior al reinicio se hizo con una ventana de 5 minutos que todavía incluía el primer arranque (dio 6) y por eso se descartó; el resultado válido es el de la segunda corrida, con la ventana acotada a la hora del reinicio. Los datos son de demostración sembrados por el propio microservicio, por lo que "3 eventos" no es una medida de rendimiento ni de volumen real.
