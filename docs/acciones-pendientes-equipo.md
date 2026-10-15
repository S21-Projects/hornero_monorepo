# Acciones pendientes del equipo

Tareas que **no puede hacer el código ni un agente**: requieren acceso a la Raspberry Pi, a
cuentas externas (Resend, Cloudflare R2) o una decisión de negocio. Marcar cada ítem al
completarlo, con fecha. El seguimiento técnico completo está en `odd/tasks/seguridad-calidad.md`.

Última actualización: 2026-10-13 (límites de reclamos, e2e de reclamos/reportes y atribución de `/mapa`).

## 1. Antes del próximo deploy

- [ ] **Verificar el dominio `elhornero.org` en Resend.** Sin esto, ningún mail (OTP, reset,
  notificaciones) se entrega; los fallos quedan en `actividad` como `NOTIFICACION_FALLIDA`.
- [ ] **Completar el `.env` de la Pi** (sin estas variables el MS no arranca o no envía mails):

  ```
  JWT_SECRET=<32+ caracteres>
  RESEND_API_KEY=<key de Resend>
  MAIL_FROM_EMAIL=no-reply@elhornero.org        # remitente verificado en Resend
  SUPER_ADMIN_EMAIL=<mail real del administrador>
  SUPER_ADMIN_PASSWORD=<15-64 caracteres; no común; sin nombre, email ni "hornero">
  APP_PANEL_URL=https://panel.elhornero.org
  EVIDENCIA_BORRADO_ENABLED=true                # habilita el borrado de evidencia de reclamos
  # No definir en producción: SEED_DEMO_DATA, MAIL_LOG_ONLY
  # Nunca poner EVIDENCIA_BORRADO_ENABLED=true en .env.local: el stack local usa el bucket de
  # producción y borraría evidencia real usando ids de la base local.
  ```

- [ ] **Confirmar que el puerto 3001 del BFF no está expuesto** fuera del túnel de Cloudflare
  (si lo estuviera, se puede falsear la IP y evadir el límite de intentos).
- [x] **Commitear `.env.example`** (hecho 2026-10-13, `cba757d`) con las variables nuevas, comentadas (todas tienen valor por
  defecto; documentarlas evita que queden "invisibles"):

  ```
  # SEED_DEMO_DATA=false
  # SUPER_ADMIN_EMAIL=
  # SUPER_ADMIN_PASSWORD=
  # MAIL_FROM_EMAIL=
  # APP_PANEL_URL=http://localhost:5173
  # PASSWORD_RESET_TTL_MINUTOS=30
  # NOTIFICACIONES_ENABLED=true
  # NOTIFICACIONES_DIGEST_CRON=0 0 8 * * *
  # DONANTE_PUBLICO=false
  # RONDAS_AUTO_ENABLED=false
  # RONDAS_AUTO_CRON=0 0 6 * * *
  # DONACIONES_OFERTA_SIN_RESPUESTA_DIAS=7
  # DONACIONES_PROPUESTA_SIN_RESPUESTA_DIAS=3
  # DONACIONES_EN_CURSO_ESTANCADA_DIAS=14
  # DONACIONES_CONFIRMACION_ESTANCADA_DIAS=7
  # DONACIONES_ESTANCADAS_CRON=0 15 0 * * *
  # ACTIVIDAD_RETENCION_DIAS=365
  # ACTIVIDAD_EMAIL_INTENTO_DIAS=90
  # DATOS_COORDENADAS_PRECISAS_DIAS=30
  # IDEMPOTENCIA_TTL_HORAS=24
  # BACKUP_RETENTION_DAYS=14
  # BACKUP_S3_BUCKET=
  # BACKUP_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  # BACKUP_AWS_ACCESS_KEY_ID=
  # BACKUP_AWS_SECRET_ACCESS_KEY=
  # BACKUP_PASSPHRASE=
  # BACKUP_S3_PREFIX=hornero/
  ```
- [ ] **Agregar a `.env.example` las variables del barrido de evidencia** (comentadas, con su valor
  por defecto; el agente no edita ese archivo). Las `AWS_*` ya existen y el MS las reutiliza:

  ```
  # EVIDENCIA_BORRADO_ENABLED=false   # true SOLO en la Pi: el stack local usa el bucket de producción
  # EVIDENCIA_BARRIDO_ENABLED=true
  # EVIDENCIA_BARRIDO_GRACIA_DIAS=7
  # EVIDENCIA_BARRIDO_MAX=500
  # EVIDENCIA_BARRIDO_CRON=0 50 3 * * *
  ```

## 2. Deploy en la Pi (en este orden)

- [ ] `git pull` en `develop` y `docker compose up --build -d`.
- [ ] Esperar a que el MS esté sano (crea las tablas y columnas nuevas al arrancar).
- [ ] **`make migrate`**: hace backup y aplica V002–V010 (rondas, versiones, inmutabilidad de
  `actividad`, `estado_desde` de donaciones). Reiniciar el MS después. V010 solo elimina un unique
  duplicado sobre `organizaciones.origen_id` (limpieza; el índice parcial de V007 queda).
- [ ] Tener en cuenta que, al arrancar, el job de donaciones estancadas **cancela las ofertas
  directas sin respuesta hace más de 7 días** y devuelve al pozo las propuestas de más de 3 días.
  Si hay datos que no se quieren afectar, levantar antes con
  `DONACIONES_OFERTA_SIN_RESPUESTA_DIAS=3650` y bajarlo después.

- [ ] **Correr `make migrate` una segunda vez** después de que el MS nuevo arranque: V008 y V009
  crean índices sobre las tablas de reclamos y reportes, que recién existen cuando el MS las crea.
  `EsquemaVerificador` avisa en el log si quedó algo pendiente.
- [ ] Opcional: importar las organizaciones de ReNaCoM con `make importar-renacom` (paso manual).

## 3. Después del deploy

- [ ] Iniciar sesión con el **admin nuevo** (`SUPER_ADMIN_EMAIL`).
- [ ] **Desactivar** (no borrar) las cuentas demo `@hornero.ar` desde la pantalla de usuarios.
- [ ] Recargar las pestañas abiertas del panel (el JS viejo no envía `Idempotency-Key`) y volver a
  iniciar sesión una vez (los tokens anteriores no tienen `jti`).
- [ ] **Probar con mails reales** usando alias de Gmail (`usuario+donante@gmail.com`,
  `usuario+referente@gmail.com`): registro, OTP, reset de contraseña, donación directa y de fondo
  común, notificaciones y resumen diario del admin.
- [ ] **Activar la CSP** (hoy en Report-Only; el barrido headless local con `CSP_MODE=enforce` no
  dio violaciones, falta confirmarlo en producción):
  1. Con `CSP_MODE` sin definir (Report-Only), recorrer el sitio público (`/`, `/nosotros`,
     `/contacto` enviando el formulario con Turnstile, `/organizaciones`, una org) y el panel con
     los tres roles (mapa, escáner QR de entrega, carga de imágenes de una org), con la consola
     del navegador abierta.
  2. Si la consola no muestra mensajes "Content Security Policy" ni "Report Only", agregar
     `CSP_MODE=enforce` al `.env` de la Pi y recrear: `docker compose up -d --build admin astro`
     (basta `up -d admin astro` si no cambió código: es una variable de runtime, no de build).
  3. Repetir el recorrido. **Rollback**: poner `CSP_MODE=report-only` (o quitar la línea) y
     volver a correr el mismo `up -d`. Cualquier valor distinto de `enforce` queda en Report-Only.
- [ ] **Crear la Cache Rule de imágenes en Cloudflare** (pasos en `docs/deploy-rpi-cloudflare.md`,
  A.2-bis) y verificar `cf-cache-status: HIT` en una imagen pública.
- [ ] Opcional: activar HSTS en Cloudflare.
- [ ] Marcar "Applied to" en `docs/db-changes.md` para V002–V010.

## 4. Backups (runbook: `docs/deploy-rpi-cloudflare.md`, Parte C)

- [ ] Crear un **bucket privado en R2** solo para backups, con un token limitado a ese bucket y
  una regla de ciclo de vida (sugerido: 30 días sobre el prefijo `hornero/`).
- [ ] Cargar las variables `BACKUP_*` en el `.env` de la Pi y **guardar la passphrase fuera de la
  Pi** (si la Pi se pierde, la clave tiene que sobrevivir).
- [ ] Instalar el timer de systemd (`deploy/systemd/hornero-backup.{service,timer}`).
- [ ] Correr `make restore-check` en la Pi, también sobre un `.enc` descargado del bucket.

## 5. Decisiones de negocio pendientes

- [x] **Evidencias de reclamos tras anonimizar:** resuelto: el microservicio borra los archivos al
  anonimizar y con un barrido nocturno de huérfanos (`docs/politica-datos-y-respaldo.md`, 1.7).
- [ ] **Retención de evidencia de reclamos ya resueltos:** hoy los archivos de un reclamo aprobado
  o rechazado de un usuario que NO se anonimiza se conservan sin plazo. Decidir si se borran tras
  un tiempo (cuánto) o se conservan como respaldo de la validación.
- [ ] **Licencia de ReNaCoM:** abrir https://ri.conicet.gov.ar/handle/11336/278030, copiar la
  licencia y la cita recomendada en `docs/mapa-vulnerabilidad.md` ("Attribution and licenses").
  Si no es CC-BY, revisar el texto de fuentes de `/mapa`. Cierra la tarea P5.
- [x] **Mails de reclamos y reportes (P1):** decidido el 2026-10-13: por ahora no se envían; queda
  como próxima feature (aviso al decidir un reclamo o un reporte).
- [ ] **Organización con reclamo aprobado (en evaluación):** hoy pasa a PENDIENTE y desaparece de
  `/mapa` hasta que un admin la valida (`ESTADOS_EN_MAPA` = APROBADA y SIN_RECLAMAR). Se decidió
  dejarlo así por ahora (2026-10-13). Alternativa a evaluar: mostrar las PENDIENTE con una etiqueta
  "pendiente de validación"; implica mostrar en el sitio público organizaciones aún no validadas.

- [x] **D11 — Backups:** valores decididos el 2026-10-13 (RPO 24 h, RTO 4 h, retención 14 d local /
  30 d R2, simulacro una vez por cuatrimestre). Ver `docs/politica-datos-y-respaldo.md`.
- [ ] **D11 — Responsables:** nombrar quién custodia la passphrase, quién accede al bucket, quién
  restaura y quién corre el simulacro (tabla "Roles y acceso" del runbook, hoy "A designar por el
  equipo").
- [x] **D12 — Datos personales:** decidido el 2026-10-13 e implementado (anonimización, minimización
  de coordenadas a 30 días, borrado del correo de logins fallidos a 90 días).

## 6. Documentación de la tesis

- [ ] Sumar el **RF de política de contraseñas** (texto entregado; referencias NIST SP 800-63B-4 y
  OWASP ASVS 5.0 V6.2).
- [ ] Incorporar `docs/politica-datos-y-respaldo.md` (D11 y D12) al documento.
- [ ] Citar como evidencia: `docs/seguridad-matriz-riesgos.md`, `docs/registro-actividades.md`,
  `docs/notificaciones-email.md` y los resultados de las pruebas (`mvn test`, `npm test`,
  `make e2e`).
- [ ] Incorporar `docs/escalabilidad.md` (escalas E0–E2, costos y cuándo usar colas) al documento.
- [ ] Incorporar `docs/validacion-calidad.md` (estrategia de pruebas, cobertura y defectos hallados) al
  documento.
