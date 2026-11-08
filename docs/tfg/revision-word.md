# Revisión del Word contra el código (Entrega 4)

Fecha: 2026-11-08 (actualizado al cierre de la entrega, commit de código `b1419c2`). Rama: `tfg/entrega-4`. Sigue el orden de las secciones de "TFG Hornero — Correcciones Entrega 3 → Entrega 4".

Estado de cada punto:

- **Corregir:** el borrador contradice el código. El reemplazo ya se puede pegar.
- **Decidir:** depende de una decisión del autor.
- **Esperar:** el dato todavía puede cambiar o aún no se midió.

Fuentes de detalle en `docs/tfg/`: `RESUMEN.md` (valores finales, estado por tarea y pasos de despliegue), `reglas-negocio.md`, `seguridad-c1.md` a `seguridad-c4.md`, `seguridad-dependencias.md`, `inventario.md`, `cronograma-real.md`, `anexo-d-modelo-datos.md`, `anexo-e-pruebas.md`.

**Importante:** los cambios de esta rama no están desplegados. Antes de afirmar que algo funciona "en producción", hay que desplegar la rama y aplicar V013, V014 y V015 en la Raspberry Pi.

---

## 1. Lo más urgente

- [ ] **Corregir.** Quitar Redis de TIC y RNF06. No existe en el proyecto, y la sección 3 del borrador pide agregarlo al diagrama: no agregarlo.
- [ ] **Corregir.** Quitar PostGIS de la Justificación (sección 4) y del criterio P de RN-05. La distancia se calcula con Haversine en el motor de Go.
- [ ] **Corregir.** Si se menciona Gin, quitarlo. El motor usa `net/http`.
- [ ] **Corregir.** Reescribir RN-05 y RN-06: las fórmulas del borrador no son las implementadas (sección 6 de este documento).
- [ ] **Corregir.** Actualizar 7.4 y 7.5: la cadena de hashes tiene alcance parcial, `REVOKE` no protege, R2 no tiene versionado y la retención 7/4/6 depende de tres reglas de ciclo de vida que el autor debe crear.
- [ ] **Corregir.** Unificar la numeración de RF, RNF y RN antes de citar identificadores (sección 15).

---

## 2. Resumen y Abstract (sección 2 del borrador)

- [ ] **Corregir.** "unas 1.950 pruebas automatizadas y 95 pruebas de extremo a extremo" está desactualizado. Conteo final (commit `b1419c2`, 2026-11-08; Go y e2e de `08ead82`): microservicio 1276 (1268 pasan, 8 omitidas por requerir PostgreSQL), BFF 480, panel de administración 707, motor Go 142 con subpruebas (141 pasan, 1 omitida) y 151 de extremo a extremo, todas aprobadas. Suman 2605 pruebas unitarias y de integración, más las 151 e2e. Astro no tiene pruebas.
- [ ] Revisar "reasigna las donaciones sin respuesta". Es correcto solo para propuestas del fondo común: la oferta directa sin respuesta se cancela (RN-07).

---

## 3. Coherencia entre secciones (sección 3 del borrador)

- [ ] **Corregir.** Herramientas de desarrollo y TIC: nombrar Leaflet con `react-leaflet` y mosaicos de OpenStreetMap, en lugar de "microservicio externo de mapas" o "API de mapas".
- [ ] **Corregir.** Coincide con el borrador: el criterio de historial de RF11 sí existe en el código, como quinto término del puntaje. Agregarlo a CU-11, paso 2.
- [ ] **Corregir.** Ilustración de despliegue: usar `docs/tfg/diagramas/despliegue-rpi.png`, en página horizontal. Ya está titulada "Despliegue en servidor propio (Raspberry Pi 5)".

---

## 4. Justificación y objetivos (secciones 3 y 4 del borrador)

- [ ] **Corregir.** Justificación, párrafo técnico. Reemplazar "el motor de asignación funciona como un servicio que aplica ponderaciones sobre consultas geoespaciales con PostGIS" por:

  > el motor de asignación funciona como un servicio independiente que resuelve cada ronda con el algoritmo húngaro a partir de ponderaciones calculadas sobre datos territoriales

- [ ] **Corregir.** Justificación, "verifica de forma continua la vigencia de las evidencias de cada organización (verificación del referente, documentación, constatación territorial e historial de entregas confirmadas)". El nivel depende solo de los ocho requisitos con evidencia aprobada y vigente. El historial de entregas no interviene en el nivel: interviene en el puntaje de asignación. Texto sugerido:

  > en el que un proceso diario verifica la vigencia de las evidencias de cada organización, y el administrador decide los cambios de nivel sobre esa base verificada

- [ ] **Corregir.** Objetivo específico 1, "a partir de la identidad verificada del referente, la constatación territorial y el historial de cumplimiento". Mismo problema. Los ocho requisitos no incluyen esos tres conceptos como tales, y solo se exige correo verificado para publicar necesidades. Texto sugerido:

  > a partir del cumplimiento de requisitos respaldados por evidencia auditada por un administrador

- [ ] **Agregar a la Justificación (opcional).** El vencimiento anual tiene un propósito concreto: confirmar que los comedores siguen activos sin perjudicarlos de forma instantánea.

---

## 5. Diseño metodológico (sección 5 del borrador)

- [ ] **Corregir.** Supuesto S6: "plazo de respuesta de ⟦N⟧ días". Hay dos plazos: 7 días para la oferta directa y 3 días para la propuesta del fondo común.
- [ ] **Corregir.** Lista de entidades del diccionario: "Requisito" no es una tabla, es un enum. Usar `docs/tfg/anexo-d-modelo-datos.md`.
- [ ] **Corregir.** La frase "Puede consultarse el diagrama compuesto en la sección de Anexos" es válida si se incluye el Anexo D. El ER legible está partido en cuatro módulos; `er-completo` sirve solo como vista general.

---

## 6. Reglas de negocio (sección 6 del borrador)

### RN-01. Requisitos por nivel

- [ ] **Corregir.** Completar con estos valores. Vigencia de los ocho: un año desde la aprobación (configurable). No existe un mapeo de tipo de evidencia por requisito: los tres tipos valen para los ocho.

| # | Requisito (constante del código) | Nivel | Evidencia admitida | Vigencia |
|---|---|---|---|---|
| 1 | `SERVICIO_REGULAR_GRATUITO` | N1 | Declaración, foto o documento | 12 meses |
| 2 | `NO_DISCRIMINACION` | N1 | Declaración, foto o documento | 12 meses |
| 3 | `SEDE_INSCRIPTA_INDIVIDUALMENTE` | N1 | Declaración, foto o documento | 12 meses |
| 4 | `CONDICIONES_SANITARIAS_ADECUADAS` | N2 | Declaración, foto o documento | 12 meses |
| 5 | `SIN_KIOSCO_MISMO_DOMICILIO` | N2 | Declaración, foto o documento | 12 meses |
| 6 | `RADIO_50KM_BANCO_ALIMENTOS` | N2 | Declaración, foto o documento | 12 meses |
| 7 | `PERSONERIA_JURIDICA_O_AVAL` | N3 | Declaración, foto o documento | 12 meses |
| 8 | `ACEPTA_AUDITORIAS_SIN_AVISO` | N3 | Declaración, foto o documento | 12 meses |

### RN-02. Qué habilita cada nivel

- [ ] **Corregir.** Completar con estos valores.

| Nivel | Condición de acceso | Categorías | Necesidades abiertas | Público |
|---|---|---|---|---|
| N0 | Toda organización nueva nace en N0 | Ninguna | 0 | No |
| N1 | Aprobación del administrador (ver nota) | `NO_PERECEDERO` | 3 | Sí |
| N2 | Requisitos 1 a 6 aprobados y vigentes | Las tres | 6 | Sí |
| N3 | Requisitos 1 a 8 aprobados y vigentes | Las tres | 12 | Sí |

- [ ] **Decidir.** N2 y N3 habilitan las mismas categorías. Solo cambia el cupo. Dejar el texto explícito para que no parezca un error.
- [ ] **Corregir.** Nota sobre N1: hay dos caminos. "Validar organización" pasa a N1 sin exigir evidencia. `cambiarNivel` exige los requisitos 1 a 3. Esto contradice la frase de RN-03 "La elevación solo es válida si todos los requisitos…": declarar la excepción.
- [ ] Reemplazar "Registro completo" por "Registro de la organización". No existe una condición de registro completo.

### RN-03. Cambio de nivel

- [ ] **Corregir.** Reemplazar "cuya fecha de vencimiento es posterior al momento del cambio" por "que no haya vencido a la fecha del cambio". Una evidencia que vence hoy sigue siendo válida.
- [ ] Agregar la excepción de N1 descrita en RN-02.

### RN-04. Vencimiento de una evidencia (reemplazar completa)

> Una evidencia aprobada vence a los 12 meses de su aprobación, salvo que el documento tenga una fecha de vencimiento anterior, que se conserva. Un proceso diario, que también se ejecuta al iniciar el sistema, marca como VENCIDA toda evidencia aprobada cuya fecha de validez ya pasó y registra el evento en la bitácora. El referente recibe un recordatorio 30 días antes del vencimiento y un aviso al vencer, con el plazo disponible. Durante un período de gracia de 30 días, el nivel de la organización y sus necesidades abiertas no cambian; la única restricción es que la organización no puede ser elevada. Cumplido ese plazo, la cola de auditoría del administrador marca el caso como «Gracia vencida» y el administrador decide la reducción de un escalón, con motivo registrado (RN-03). El sistema nunca reduce un nivel de forma automática. Una evidencia vencida no se vuelve a aprobar: el referente la reemplaza y la nueva aprobación fija una nueva vigencia. Este mecanismo busca confirmar que las organizaciones siguen activas sin perjudicarlas de forma instantánea. Los plazos son configurables.

- [ ] Referencia a pestaña: la cola de vencidas de RF13 existe.

### RN-05. Puntaje de asignación (reemplazar fórmula y tabla)

Fórmula: `S(d,n) = 0,30·D + 0,25·U + 0,17·P + 0,13·E + 0,15·C`. Los pesos suman 1 y se normalizan por su suma.

| Criterio | Qué mide | Normalización a [0, 1] | Peso |
|---|---|---|---|
| D: déficit territorial | Por radio censal: habitantes por comedor sobre la mediana, por `1 + necesidades/comedores` | `min(d, 3) / 3`. Sin dato de radio se usa 1,0 (neutral) | 0,30 |
| U: urgencia | Prioridad de la necesidad (urgente 1,0; media 0,6; normal 0,3) y cercanía de su vencimiento (`1 − días/30`, acotado); se toma el mayor | `max(0, min(u, 1))` | 0,25 |
| P: proximidad | Distancia Haversine entre donación y organización | `exp(−km / 8)` | 0,17 |
| E: espera | Días desde la última donación recibida por la organización | `min(días / 90, 1)`. Sin historial, 90 días | 0,13 |
| C: cumplimiento | `(E + 5·p0) / (E + F + 5)`: E entregadas, F rechazadas, p0 tasa global de la ronda (o 0,5) | Ya está en [0, 1] | 0,15 |

- [ ] **Corregir.** No hay NBI, min-max, FEFO ni PostGIS en el puntaje. Si el Marco teórico presenta FEFO como criterio del prototipo, aclarar que U usa el vencimiento de la necesidad, no el del lote. Revisar también la cita de Suárez et al. (2024).
- [ ] **Corregir.** E es por organización, no "días desde que la necesidad está abierta".
- [ ] **Corregir.** Restricciones duras reales: organización que ya rechazó esa donación; categoría no aceptada por la necesidad o no permitida por el nivel; sin artículo en común, si ambas partes los declaran; distancia mayor a 30 km. N0 se filtra antes de la ronda. No hay restricción de "necesidad ya cubierta": cada necesidad recibe como máximo una donación por ronda, y una necesidad con una propuesta sigue siendo candidata en la ronda siguiente.
- [ ] **Coincide.** Desempate: mayor puntaje, necesidad publicada hace más tiempo (en días), menor identificador. Quitar ⟦VERIFICAR⟧. Comprobado contra fuerza bruta.
- [ ] **Corregir.** Costo de oportunidad: "diferencia entre el mejor puntaje que esa donación habría obtenido considerada de forma individual y el puntaje asignado". No es "la mejor alternativa descartada".

### RN-06. Varias unidades con el algoritmo húngaro (reemplazar completa)

> El algoritmo húngaro resuelve correspondencias uno a uno. La unidad de asignación es la donación completa, que es indivisible: cada fila de la matriz es una donación del fondo común y cada columna, una necesidad candidata, de modo que una necesidad recibe como máximo una donación por ronda. Una organización con varias necesidades abiertas puede recibir varias donaciones. Se agrega una columna ficticia por donación, que representa dejarla sin asignar, con un costo de 0,10 × min(días en el fondo / 90, 1); así, una donación que lleva más tiempo esperando tiene mayor prioridad de asignación. El costo de una celda factible es el puntaje negado (−S), y los pares descartados por restricciones duras reciben un costo prohibitivo. Las donaciones que quedan en una columna ficticia permanecen en el fondo común para la ronda siguiente. El algoritmo no considera cantidades: una donación se asigna entera y no se comparan cantidades entre donación y necesidad, por lo que no hay tratamiento de excedentes ni de cantidades parciales. Esta es una limitación conocida del prototipo.

- [ ] **Decidir.** La profesora preguntó por las cantidades. La respuesta honesta es esta limitación. Conviene declararla también en Conclusiones.

### RN-07. Donación sin respuesta (reemplazar completa)

> Una oferta directa en estado OFRECIDA sin respuesta del referente durante 7 días se cancela automáticamente. Una propuesta de asignación del fondo común sin respuesta durante 3 días se trata como un rechazo: la donación vuelve al fondo común. Una donación aceptada o en camino durante más de 14 días, o pendiente de confirmación durante más de 7, no se cancela ni se reasigna: se marca como estancada para revisión de un administrador. Los plazos son días corridos y configurables (RNF15). El proceso se ejecuta a diario y también al iniciar el sistema.

### RN-08. Reasignación sin duplicados (reemplazar completa)

> Para evitar que una donación se reasigne dos veces: (1) un bloqueo consultivo de sesión de PostgreSQL (`pg_try_advisory_lock`) impide ejecutar dos rondas en simultáneo, incluida la manual y aunque haya más de una instancia del servicio; el segundo intento responde 409. Se usa un bloqueo de sesión y no de transacción porque la ronda incluye una llamada HTTP de hasta 30 segundos al motor. (2) Un índice único parcial impide que una donación tenga más de una asignación en estado PROPUESTA. (3) Al registrar los resultados, cada donación se bloquea a nivel de fila y se vuelve a comprobar su estado; si cambió, el par se descarta. Las demás operaciones sobre la donación están protegidas por control optimista de versión. (4) Una donación rechazada no vuelve a proponerse a la misma organización.

- [ ] **Corregir.** Quitar "UPDATE … WHERE estado = 'OFRECIDA'": no existe y no se agregó porque no cierra ninguna carrera abierta.
- [ ] **Esperar.** El índice V013 todavía no está aplicado en la Raspberry Pi.

### RN-09. Confirmación de entrega

- [ ] **Corregir.** Valores: vence a los 10 minutos, admite 5 intentos fallidos por código emitido, código de 6 dígitos, se guarda solo el hash BCrypt en PostgreSQL. El resto del texto coincide con el código.

### RF17 y RF18

- [x] **Decidido (opción A, 2026-11-08).** No figuran en `docs/tesis/`. Se redactan según lo implementado y el legajo muestra el cumplimiento. Pegar estos dos textos:
  - "RF17 – Indicadores territoriales. El sistema debe mostrar en el mapa público, por departamento, un índice de vulnerabilidad territorial con la cantidad de habitantes, comedores, habitantes por comedor y necesidades sin cubrir, en un mapa coroplético. Los datos se actualizan mediante un proceso por lotes."
  - "RF18 – Historial de cumplimiento. El sistema debe calcular en cada ronda el término de cumplimiento de cada organización a partir de sus donaciones entregadas y rechazadas, considerarlo en el puntaje (RN-05) y mostrar en su legajo la cantidad de entregas y rechazos y la tasa resultante."
- [ ] **Corregir.** El texto de RN-05 y el borrador no deben incluir las donaciones sin respuesta en el historial: no cuentan (una oferta directa sin respuesta termina cancelada y una propuesta del fondo común sin respuesta vuelve al fondo). Tampoco cuenta el rechazo de una propuesta del fondo común. La tasa del legajo es simple, entregadas / (entregadas + rechazadas), y no coincide con el término de la ronda, que está suavizado con un valor previo global.

---

## 7. Seguridad (sección 7 del borrador)

### 7.1 Contraseñas

- [ ] **Coincide.** Costo 12, sal aleatoria y rechazo de contraseñas mayores a 72 bytes. Quitar ⟦VERIFICAR⟧.
- [ ] **Esperar.** El tiempo de cada hash en la Raspberry Pi no está medido (256 ms en el equipo de desarrollo). El mismo ajuste afecta a códigos OTP y de entrega.

### 7.2 Sesiones

- [ ] **Corregir.** `SameSite` es `None` en producción, con `Secure`, y `Lax` en desarrollo. No es `Strict`. Con `None`, la cookie no limita el envío entre sitios: la protección contra CSRF recae en la verificación de origen. Reemplazar "que limita su envío en peticiones originadas en otros sitios" por una frase que diga esto.
- [ ] **Corregir.** No existe cambio de contraseña dentro de la sesión. Reemplazar "Al cambiar la contraseña" por "Al restablecer la contraseña".
- [ ] **Coincide.** Logout revoca y borra cookies. El administrador puede revocar las sesiones de un usuario, con evento de auditoría. Los refresh tokens se registran en el servidor. Un token de acceso sigue válido hasta 15 minutos. Quitar ⟦VERIFICAR⟧.
- [ ] **Corregir.** CSP: activa en el BFF. En Astro y el panel está en modo de solo reporte, salvo `CSP_MODE=enforce` en la Raspberry Pi. Decir cuál aplica o activarla primero.

### 7.3 Evidencias

- [ ] **Verificar en Cloudflare.** "nunca tiene una URL pública". Evidencias e imágenes públicas comparten el bucket `hornero-images`; la ruta `/images` bloquea los prefijos de evidencia y hay pruebas de eso. Falta comprobar en el panel que el acceso público del bucket esté desactivado. "Almacenamiento privado" depende de esa comprobación.
- [ ] **Coincide.** JPEG, PNG y PDF por firma de contenido, 5 MB configurable, nombre UUID, recodificación que quita EXIF, `attachment` con `nosniff`, descarga autenticada con verificación de titularidad, y registro de descargas de administrador.
- [ ] **Corregir.** Limitar el texto a evidencias de acreditación. `reclamo-evidencia/` sigue aceptando WebP y conservando EXIF (o pedir que se extienda; es la opción recomendada, porque esos archivos pueden tener documentos de identidad).
- [ ] **Corregir.** Conservación: el código existe, pero está apagado por defecto. Afirmar que "se elimina" solo después de poner `EVIDENCIA_RETENCION_ENABLED=true` en la Raspberry Pi. Si no se activa, redactar: "el sistema dispone de un proceso de retención, a activar por configuración".
- [ ] **Corregir.** "Si una organización solicita la baja, sus archivos se eliminan en ⟦30⟧ días" no está implementado para evidencias de acreditación. Lo que existe es el borrado de evidencia de reclamos al anonimizar un usuario. Quitar la frase o declararla como procedimiento manual.

### 7.4 Auditoría (reemplazar la lista y el párrafo final)

Texto sugerido para el último párrafo (en `docs/tfg/seguridad-c4.md`, sección 10):

> El microservicio mantiene una bitácora de eventos de acreditación (evidencias cargadas, aprobadas u observadas, cambios de nivel, reclamos, reportes y reasignaciones), de solo agregado. Cada evento guarda el actor y se encadena por organización: su hash es SHA-256 del hash del evento anterior concatenado con su contenido canónico. Un proceso diario verifica las cadenas sin modificar datos, deja constancia en el registro de actividad y en el log si detecta una discrepancia, y puede publicar en un bucket un ancla con la raíz de las cabezas de todas las cadenas. Un disparador de base de datos rechaza las modificaciones y los borrados de la bitácora. Esto permite detectar, no impedir, la alteración, el borrado intermedio y el reordenamiento de eventos; el borrado de los últimos eventos se detecta únicamente comparando con un ancla anterior. Los inicios de sesión, las descargas de evidencia y las intervenciones sobre entregas se registran en una tabla distinta (registro de actividad), inmutable frente a SQL ad hoc pero sujeta a una retención de 365 días y, por eso, fuera de la cadena. Un administrador del servidor con acceso a la base y a las credenciales del bucket puede reescribir ambos.

- [ ] **Corregir.** Borrar "el usuario de base de datos de la aplicación no tiene permisos de UPDATE ni DELETE". Con la configuración por defecto de compose, el rol de la aplicación es superusuario e ignora `REVOKE`. Lo que protege es el disparador V014.
- [ ] **Corregir.** "Exporta el último hash al almacenamiento externo" es opcional: requiere `AUDITORIA_ANCLA_ENABLED=true` en la Raspberry Pi. El texto de arriba ya dice "puede publicar".
- [ ] **Esperar.** V014 no está aplicado en la Raspberry Pi.

### 7.5 Respaldo

- [ ] **Corregir.** Alcance y cifrado: el respaldo diario es a las 03:15, por temporizador systemd. Se guarda localmente con retención de 14 días. La copia cifrada (AES-256-CBC) solo se genera si `BACKUP_S3_BUCKET` está configurado.
- [ ] **Corregir.** Retención 7/4/6: el script sube cada copia a tres prefijos (`hornero/daily/`, `hornero/weekly/` el día configurado, `hornero/monthly/` el día 01) y ningún código borra del bucket. La retención la deben aplicar tres reglas de ciclo de vida de R2 que **el autor debe crear** en el panel de Cloudflare: `hornero/daily/` a 7 días, `hornero/weekly/` a 28 días y `hornero/monthly/` a 186 días. Hasta crearlas, redactar "el sistema sube las copias por prefijos para aplicar la retención con reglas de ciclo de vida". No crear la regla única de 30 días sobre `hornero/`.
- [ ] **Corregir.** Versionado: **quitar "el bucket tiene versionado"** del borrador. Cloudflare R2 no tiene versionado de objetos ni replicación (`PutBucketVersioning` y `PutBucketReplication` figuran como no implementadas; documentación oficial leída el 2026-11-08). Lo que existe en el repositorio es `scripts/backup/evidence-copy.sh`, una copia aditiva de los prefijos de evidencia a un segundo bucket, **desactivada por defecto** (`EVIDENCE_COPY_ENABLED=false`) y con el temporizador comentado. Si el autor la activa, el segundo bucket necesita su propia regla de vencimiento. Detalle en `docs/tfg/seguridad-c5.md`.
- [ ] **Esperar (requiere la Raspberry Pi).** Tamaño del dump real y simulacro de restauración. La plantilla es `docs/tfg/prueba-restauracion.md`, con la tabla de resultados vacía. `scripts/backup/restore-check.sh` ahora compara los conteos de filas y verifica la cadena de hashes de auditoría (detecta un evento alterado), pero solo se probó con datos de demostración en un PostgreSQL local. No hay resultado real: no inventar tiempos ni tamaños.

---

### 7.6 Tabla de verificación

- [ ] **Corregir.** Dependencias, "Reporte sin vulnerabilidades altas": hoy es falso. El BFF tiene 2 altas sin parche, E2E tiene 2 críticas (solo pruebas) y OWASP dependency-check no corrió para Maven. Sugerido: "Reporte revisado, con excepciones registradas".
- [ ] **Corregir.** Dependabot está configurado en `.github/dependabot.yml`; solo actúa si está habilitado en el repositorio de GitHub.
- [ ] **Corregir.** Integridad de la bitácora: agregar "de eventos de acreditación".
- [ ] **Corregir.** Revocación: "Al cerrar sesión, al restablecer la contraseña y por incidente".
- [ ] **Verificar.** Secretos: gitleaks marcó 9 hallazgos en pruebas, plantillas y README. Hay que revisarlos antes de afirmar que no hay secretos versionados.

---

## 8. Costos (sección 8 del borrador)

- [ ] **Corregir.** Tabla 3b: separar evidencias, imágenes y respaldos por componente está bien como cálculo, pero no presentarlos como buckets distintos.
- [ ] **Esperar.** Tamaño del dump cifrado: requiere la Raspberry Pi.
- [ ] Tabla 6c, "almacenamiento de reemplazo": el medio documentado es microSD.
- [ ] Justificación del equipo: revisar "agosto a noviembre de 2026" contra la Tabla 2. Ver sección 9.

---

## 9. Riesgos (sección 9 del borrador)

- [ ] **Corregir.** R1, fundamento. Desvío medido contra las fechas del encargo:

| Actividad | Plan | Desvío medido |
|---|---|---|
| Algoritmos | 30/09 a 07/10 | Inicio 9 días antes; último commit 8 días después |
| Backend | 30/09 a 21/10 | Último commit 13 días después |
| Frontend | 21/10 a 11/11 | Último commit 8 días antes |
| Despliegue | 11/11 | Primer artefacto de despliegue 108 días antes |

  Límites: la historia anterior al 2026-06-08 no se migró, y la fecha de puesta en producción no está en el repositorio. El Gantt no está en el repositorio: comprobar que las fechas coincidan con la Tabla 2. Estos desvíos no respaldan por sí solos una probabilidad del 75 %: revisar la redacción. Detalle en `cronograma-real.md`.
- [ ] **Corregir.** R5: el medio documentado es microSD.
- [ ] R6: el reinicio automático de contenedores existe (`restart: unless-stopped`). El monitoreo externo no está en el repositorio: no afirmarlo si no está configurado.
- [ ] R8: el límite de intentos de inicio de sesión existe. "Revisión con OWASP ZAP antes de cada entrega" no se ejecutó: quitarlo o hacerla. Pruebas de acceso cruzado y de archivos inválidos: existen.
- [ ] R9: el desacople del correo existe como la interfaz `Mailer` (`jar_hornero_ms/src/main/java/org/example/mail/Mailer.java`), con una implementación de Resend y otra que solo registra en el log (`MailerConfig`). Túnel alternativo y proveedor alternativo: no están en el repositorio.

---

## 10. Conclusiones (sección 10 del borrador)

- [ ] **Corregir.** Números: tomarlos de `RESUMEN.md`, sección b (conteos finales listados arriba, en la sección 2).
- [ ] **Corregir.** Objetivo 1: "CU-07 a CU-09 en pruebas E2E" y objetivo 6: "Prueba E2E de exportación (CU-10)". Ya existen (`14-acreditacion.e2e.ts`, 33 casos, y la escalera completa de niveles); el e2e de CU-10 lee el legajo por la API. El PDF no se prueba: lo genera el navegador al imprimir la vista del legajo. Redactar el objetivo 6 sobre los datos del legajo, no sobre el PDF; el legajo incluye ahora el historial de cumplimiento (entregas, rechazos y tasa), con una aserción nueva en `14-acreditacion.e2e.ts` que todavía no se ejecutó contra una pila.
- [ ] **Corregir.** Objetivo 2: "determinismo (RNF16)" es válido a nivel del motor, no de punta a punta. "ronda de 500 × 500 en ⟦X⟧ s": 218 ms por ronda (una corrida final de 217,9 ms; 210 ms en corridas anteriores) en el equipo de desarrollo (M3 Pro), solo el algoritmo. RNF18 no está medido en la Raspberry Pi.
- [ ] **Corregir.** Objetivo 3: el e2e `15-reasignacion` (5 casos) cubre el camino manual: una donación del fondo común propuesta a una organización que la rechaza vuelve al fondo y las rondas siguientes no se la proponen otra vez a esa organización. Límites del e2e: el vencimiento de una propuesta sin respuesta (3 días) y el trabajo diario de estancadas no se pueden alcanzar de punta a punta (no hay endpoint ni reloj inyectable) y solo los cubren pruebas de integración y unitarias del microservicio. La donación aceptada y no retirada se marca como estancada pero no se reasigna. No afirmar el objetivo como cumplido por completo.
- [ ] **Corregir.** Objetivo 4: "prueba de inmutabilidad de eventos" existe, con el alcance de 7.4.
- [x] **Decidido.** Objetivo 5: "cumplido" es válido con la redacción de RF17 por departamento (ver RF17).
- [ ] **Corregir.** "se ejecutaron sin fallas": agregar que hay pruebas omitidas (solo PostgreSQL) y que Astro no tiene pruebas propias.
- [ ] **Agregar a limitaciones:** el algoritmo no considera cantidades.

---

## 11. Demo (sección 11 del borrador)

- [ ] **Coincide.** La entrega con código QR existe en el panel.
- [ ] **Corregir.** Paso 9, "Legajo exportado a PDF": no genera un PDF propio. Es una vista imprimible (hoja de estilos de impresión), que se guarda como PDF desde el navegador. Decir "vista imprimible del legajo".
- [ ] **Corregir.** Paso 2, "mapa público e indicadores": es la coropleta por departamento, no un mapa de calor.
- [ ] **Corregir.** `make demo-up`, `make demo-seed`, `make demo-reset`, `make demo-verify` y `make demo-down` existen. Corren en un proyecto de Compose propio, local, con MinIO, secretos generados y datos ficticios; se niegan a apuntar a un destino que no sea local. Esos datos nunca llegan a producción.
- [ ] **Importante.** La demo corre en local con `make demo-up`, no en producción. Cambiar en el borrador la mención de "elhornero.org" como lugar de la demo, salvo que la rama se despliegue antes: hoy no está desplegada ahí.

---

## 12. Anexos (sección 12 del borrador)

- [ ] Anexo D: `docs/tfg/anexo-d-modelo-datos.md`, con los diagramas `er-*.png`. Los tipos salen del código y los CHECK generados por Hibernate están marcados como inferidos.
- [ ] Anexo E: `docs/tfg/anexo-e-pruebas.md`, con la corrida final del commit `b1419c2`.
- [ ] Anexo C: la tabla de requisitos es la de RN-01.

---

## 13. Referencias (sección 13 del borrador)

No se revisaron contra el código. Solo una coincidencia: si se quita FEFO como criterio del prototipo, revisar dónde se cita Suárez et al. (2024).

---

## 14. Acciones del autor fuera del Word

- [ ] Cloudflare: comprobar que `hornero-images` tenga el acceso público desactivado.
- [ ] Revisar los 9 hallazgos de gitleaks en `docs/tfg/seguridad-dependencias.md`, sobre todo `.env.example`.
- [x] RF17 y RF18 decididos (opción A); pegar los textos de la sección "RF17 y RF18".
- [ ] Decidir si se extiende EXIF y WebP a `reclamo-evidencia/`.
- [ ] Decidir si se activa `CSP_MODE=enforce`, `EVIDENCIA_RETENCION_ENABLED` y `AUDITORIA_ANCLA_ENABLED`.
- [ ] Raspberry Pi: medir dump y hash, ejecutar el simulacro de restauración y desplegar la rama con este orden:
  1. `make backup`.
  2. Desplegar la imagen y dejar que arranque una vez.
  3. Comprobar que `organizacion_evento` no tenga filas con `hash IS NULL`.
  4. `make migrate` (V013, V014, V015).
  5. Reiniciar el microservicio y verificar que no haya `ESQUEMA_PENDIENTE`.

---

## 15. Numeración

Los identificadores chocan entre `documento.md` y `correcciones-requerimientos.md`. Hay que elegir una sola numeración en el Word. Ejemplos:

| Id | `documento.md` | `correcciones-requerimientos.md` |
|---|---|---|
| RF11 | Eventos de solo agregado | Modalidades y algoritmo húngaro |
| RF15 | Validar entrega con código | Resolución automática sin respuesta |
| RF16 | Catálogo de artículos | Ronda automática programada |
| RNF15 | Invariante evento–nivel | Parámetros configurables |
| RN09 | No existe | Habilitaciones por nivel (en el borrador, RN-09 es el código de entrega) |

El borrador cita "invariante evento–nivel (RNF14)": en `documento.md` es RNF-15. RNF16, RNF17 y RNF18 existen solo en correcciones. La tabla completa está al final de `reglas-negocio.md`.
