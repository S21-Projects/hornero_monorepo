# Tareas para el agente — Hornero (correcciones Entrega 3 → Entrega 4)

> Pegá este archivo en la raíz del repo y pedile al agente: "Leé TAREAS_AGENTE_TFG.md y ejecutá las tareas en orden. Trabajá en una rama `tfg/entrega-4`. No hagas push sin que te lo pida."

## Contexto

Es el prototipo del TFG "Sistema de acreditación, asignación priorizada y trazabilidad de donaciones de alimentos" (Hornero). Stack: Spring Boot (microservicio de dominio), NestJS (BFF), React + Vite (panel), Astro (sitio público), Go + Gin (motor de asignación), PostgreSQL + PostGIS, Redis, Cloudflare Tunnel/R2, Resend. Producción: Raspberry Pi 5.

La profesora pidió reglas de negocio verificables, una política de seguridad comprobable y evidencia de pruebas. El documento del TFG va a afirmar lo que esté implementado, así que:

- **Primero verificá, después implementá.** Para cada tarea, informá qué ya existía (con ruta de archivo y línea) y qué agregaste.
- No inventes valores: si algo no existe en el código, decilo.
- Todo lo que produzcas para el documento va en `docs/tfg/` en Markdown (tablas en formato pipe).
- Cada cambio de código lleva pruebas. Al final, toda la suite tiene que pasar.

---

## A. Extracción de información (solo lectura)

### A1. Evidencia de pruebas → `docs/tfg/anexo-e-pruebas.md`
1. Corré todas las suites (Java, NestJS, React, Go, E2E) y anotá comando, cantidad de pruebas, pasadas/fallidas y duración por módulo.
2. Generá cobertura si el tooling lo permite (JaCoCo, Jest/Vitest `--coverage`, `go test -cover`).
3. Tabla de trazabilidad: objetivo específico (1 a 6) y caso de uso (CU-01 a CU-13) → archivos/nombres de prueba que lo cubren y cantidad.
4. Ejecutá un benchmark del motor con 500 donaciones × 500 necesidades (RNF18) y registrá el tiempo en la Raspberry o en tu máquina (aclarar cuál).
5. Confirmá la prueba de invariante evento–nivel (RNF14) y la de determinismo (RNF16): misma entrada → misma salida.

### A2. Reglas de negocio reales → `docs/tfg/reglas-negocio.md`
Extraé del código los valores exactos para completar:
- **RN-01:** los 8 requisitos (nombre, nivel en que se exigen, tipo de evidencia admitida, vigencia en días).
- **RN-02:** por nivel N0–N3, categorías de alimentos habilitadas, cupo de necesidades abiertas y visibilidad pública.
- **RN-03:** reglas de transición (un escalón, motivo obligatorio, chequeo de requisitos vigentes).
- **RN-04:** qué pasa hoy cuando vence una evidencia (job, estado VENCIDA, efecto sobre el nivel y sobre necesidades abiertas). Si no pasa nada, decilo explícitamente.
- **RN-05:** fórmula del puntaje: criterios, pesos, normalización de cada criterio (fórmula exacta), restricciones duras, desempate y definición del "costo de oportunidad" que se guarda.
- **RN-06:** cómo se arma la matriz del algoritmo húngaro con varias unidades: qué es una fila, qué es una columna, si se replican necesidades, relleno de la matriz, costo prohibitivo, tratamiento de excedentes y de cantidades parciales.
- **RN-07:** plazos de "sin respuesta" y "estancada" (valor por defecto y nombre de la propiedad de configuración).
- **RN-08:** cómo se evita reasignar dos veces la misma donación (UPDATE condicional, restricción única, lock de ronda, exclusión de la necesidad que rechazó).
- **RN-09:** vencimiento del código de entrega (minutos), intentos permitidos, almacenamiento (hash, Redis o PostgreSQL).
- **RF17/RF18:** ¿existen el cálculo de indicadores territoriales y el puntaje de historial? Dónde y cómo.

### A3. Desvío del cronograma → `docs/tfg/cronograma-real.md`
Con `git log`, estimá las fechas reales de inicio y fin de: desarrollo de algoritmos, backend, módulos del frontend y despliegue. Compará con el Gantt (algoritmos 30/09–07/10, backend 30/09–21/10, frontend 21/10–11/11, despliegue 11/11) y calculá el desvío en días. Sirve para fundamentar la probabilidad de R1.

### A4. Inventario técnico → `docs/tfg/inventario.md`
- ¿Se usa Redis? ¿Para qué exactamente? (en el TFG dice OTP y caché de cobertura).
- Librería o servicio de mapas que usa el front.
- Contenedores reales del `docker-compose` de producción con puertos expuestos y redes.
- Medio de almacenamiento del servidor (microSD o SSD) si está documentado.
- Cómo se almacenan las evidencias: bucket, prefijo de claves, si es privado, cómo se sirven.

---

## B. Diagramas

### B1. Diccionario de datos y ER completo → `docs/tfg/anexo-d-modelo-datos.md`
- A partir de las migraciones o entidades JPA, generá para cada tabla principal (organización, requisito, evidencia, evento de acreditación, necesidad, donación, asignación, ronda, código de entrega, usuario, sesión/refresh token): columna, tipo, restricciones (PK, FK, NOT NULL, UNIQUE, CHECK, default) y descripción en una línea.
- Generá el ER completo en PlantUML o Mermaid (`docs/tfg/diagramas/er-completo.puml`) y exportalo a PNG legible en A4 (si no entra, partilo por módulo, igual que en el documento).

### B2. Diagrama de clases y ER
Si las tareas C o D agregan entidades o campos (hash de evento, refresh tokens revocables, campos de retención), actualizá los diagramas existentes y exportá PNG.

### B3. Diagrama de despliegue corregido → `docs/tfg/diagramas/despliegue-rpi.puml` + PNG
El diagrama actual omite elementos. Debe incluir:
- Contenedor del **motor de asignación en Go**, sin puerto expuesto, invocado solo por el microservicio.
- **Redis**, si A4 confirma que se usa.
- **Temporizador systemd de respaldo** → bucket o prefijo de respaldos en R2.
- Buckets o prefijos de R2 diferenciados (imágenes públicas, evidencias privadas, respaldos) según A4.
- Puertos reales del compose. Título: "Despliegue en servidor propio (Raspberry Pi 5)".

### B4. Diagrama de secuencia de reasignación (opcional, recomendado)
Proceso diario de RF15: selección de donaciones vencidas → UPDATE condicional → devolución al fondo → siguiente ronda, mostrando el lock. Sirve para RN-08.

---

## C. Seguridad (verificar e implementar si falta)

### C1. Hash de contraseñas
Confirmá BCrypt, el factor de costo y el rechazo de contraseñas mayores a 72 bytes. Si el costo es menor que 12, subilo a 12 (no afecta hashes existentes).

### C2. Sesiones
1. Verificá que las cookies de acceso y refresco tengan `HttpOnly`, `Secure` y `SameSite` (informá el valor). Si falta alguno, agregalo.
2. Revocación: los refresh tokens deben guardarse en el servidor (hash del token, usuario, expiración, `revoked_at`).
   - Logout → revoca el refresh actual y borra las cookies.
   - Cambio de contraseña → revoca todos los refresh del usuario.
   - Endpoint de administrador → revoca todas las sesiones de un usuario (con evento de auditoría).
   - El refresh debe rechazar tokens revocados.
3. Agregá cabeceras de seguridad en Astro/React/BFF: `Content-Security-Policy` (razonable para el mapa), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Frame-Options` o `frame-ancestors`.
4. Pruebas E2E: inspeccionar los atributos de las cookies y verificar que un refresh revocado devuelve 401.

### C3. Evidencias
1. Validación por firma de contenido (magic bytes): solo JPEG, PNG y PDF. Tamaño máximo configurable (por defecto 5 MB). Nombre de objeto aleatorio (UUID).
2. Recodificar imágenes en el servidor para eliminar EXIF y GPS.
3. Descarga solo por ruta autenticada con verificación de titularidad o rol de administrador; respuesta con `Content-Disposition: attachment` y `nosniff`. Registrar un evento cuando un administrador descarga.
4. Retención: job que elimina de R2 los archivos de evidencias reemplazadas o vencidas hace más de N meses (configurable, 12 por defecto), conservando la fila y el evento con una marca `archivo_eliminado_at`.
5. Pruebas: un referente de otra organización recibe 403; un archivo `.exe` renombrado a `.jpg` es rechazado; un archivo de 6 MB es rechazado.

### C4. Auditoría
1. Confirmá que los eventos guardan el actor en: aprobación/observación de evidencia, cambio de nivel, intervención de administrador en una entrega. Si falta en alguno, agregalo.
2. Cadena de hashes: cada evento guarda `prev_hash` y `hash = SHA-256(prev_hash || contenido canónico)`. Migración aditiva (RNF07) con relleno de los eventos existentes en orden.
3. Job diario que verifica la cadena y sube el último hash a R2 (`audit/anchors/AAAA-MM-DD.txt`). Si la verificación falla, registrar un evento y loguear un error.
4. Permisos de base: el usuario de la aplicación sin `UPDATE` ni `DELETE` sobre la tabla de eventos (`REVOKE`); documentá el SQL.
5. Pruebas: alterar un evento a mano en una base de prueba → la verificación lo detecta.

### C5. Respaldo y restauración
1. Medí el tamaño del dump cifrado actual (para la tabla de costos de R2).
2. Retención: 7 diarias, 4 semanales y 6 mensuales (por script o por reglas de ciclo de vida de R2). Documentá cuál.
3. Evidencias: activá el versionado del bucket si R2 lo permite en tu plan o agregá una sincronización semanal (`rclone sync`) a un segundo bucket o prefijo. Documentá cuál quedó.
4. **Simulacro de restauración:** restaurar el último respaldo en un contenedor PostgreSQL aislado con el script existente, medir la duración, comparar conteos de filas de las tablas principales con producción y correr la verificación de la cadena de hashes. Guardá el resultado en `docs/tfg/prueba-restauracion.md` con fecha, archivo, tamaño, duración, verificación y resultado.

### C6. Dependencias y secretos
- Corré `npm audit` (BFF, front, Astro), `govulncheck` (motor) y el equivalente de Maven/Gradle (OWASP dependency-check o `mvn versions`). Corregí las vulnerabilidades altas o críticas; reportá el resto.
- Agregá `.github/dependabot.yml` para npm, gomod, maven/gradle y docker.
- Corré `gitleaks` (o similar) sobre el historial y confirmá que no hay secretos versionados.

---

## D. Reglas de negocio (implementar lo que A2 muestre faltante)

### D1. RN-04 — vencimiento de evidencias
Si no existe, implementá: job diario (y al iniciar, RNF17) que marca VENCIDA, registra el evento y aplica la política elegida por el autor: **⟦Luciano: indicá (a) período de gracia de N días y reducción por administrador, o (b) reducción automática⟧**. Pruebas incluidas.

### D2. RN-08 — sin doble reasignación
Verificá o implementá: UPDATE condicional por estado; restricción única de asignación activa por donación; `pg_advisory_xact_lock` para que no corran dos rondas en simultáneo (incluida la manual); exclusión de la necesidad que rechazó. Prueba de concurrencia: dos rondas en paralelo → ninguna donación queda asignada dos veces.

### D3. RN-05 — desempate determinista
Si el motor no tiene desempate explícito, agregalo: mayor puntaje → necesidad abierta hace más tiempo → menor ID. Prueba con empates.

### D4. RF17 y RF18
Si no existen el cálculo de indicadores por zona o el puntaje de historial, informalo antes de implementar (puede preferirse ajustar el alcance del documento).

---

## E. Demo

### E1. Datos de demostración
Script `make demo-seed` (o equivalente) que cargue datos ficticios: 3 organizaciones en distintos niveles con evidencias, 2 donantes, necesidades de varias categorías y donaciones en el fondo común, de modo que el guion de la demo se pueda grabar de punta a punta. Y `make demo-reset` para volver al estado inicial. Nada de datos reales.

---

## Entrega

Al terminar, generá `docs/tfg/RESUMEN.md` con:
1. Tabla tarea → estado (ya existía / implementado / no aplica) → archivos tocados.
2. Valores finales para pegar en el TFG: RN-01 a RN-09, configuración de cookies, límites de archivos, retención, tamaño del dump, resultado del simulacro y conteos de pruebas.
3. Cualquier diferencia entre lo que dice el documento (RF, RNF, CU) y lo que hace el código.
