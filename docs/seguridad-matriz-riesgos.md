# Matriz de riesgos de seguridad — Hornero

Relaciona cada riesgo identificado para el sistema con la medida que lo mitiga y la evidencia
verificable (código o prueba automatizada). Responde al requisito de la guía: "las medidas de
seguridad deberán estar relacionadas con los riesgos identificados para el sistema".

Estado al 2026-10-10, rama `feat/seguridad-calidad`. Seguimiento de tareas en
`odd/tasks/seguridad-calidad.md`.

## Activos a proteger

| Activo | Por qué es sensible |
|--------|---------------------|
| Cuentas de usuario (ADMINISTRADOR, REFERENTE, DONANTE) | Permiten operar sobre organizaciones, necesidades y donaciones |
| Datos personales de donantes y referentes | Nombre, email, dirección y coordenadas (Ley 25.326) |
| Estado de las donaciones y su trazabilidad | La confianza del sistema depende de que una entrega sea real |
| Acreditación de organizaciones y su evidencia | Determina qué organizaciones reciben donaciones |
| Base de datos y archivos (imágenes, evidencias) | Pérdida o corrupción implica pérdida de historia y trazabilidad |

## Escala

Probabilidad e impacto: **A** (alto), **M** (medio), **B** (bajo). El riesgo residual es el que
queda después de aplicar la medida.

## Matriz

| ID | Riesgo / amenaza | P | I | Medida | Capa | Evidencia | Residual |
|----|------------------|---|---|--------|------|-----------|----------|
| R1 | Robo de contraseñas almacenadas | M | A | Hash BCrypt; la contraseña nunca se devuelve en respuestas | MS | `ApplicationConfig.java`, `AuthService.java`, `UserResponse` | B |
| R2 | Adivinación de contraseñas por fuerza bruta | A | A | Límite de intentos por IP: login 5/min, registro 3/min, refresh 20/min, OTP 5/min y reenvío 3/min | BFF | `auth.throttling.spec.ts`, `client-ip-throttler.guard.spec.ts` | M (política de contraseñas pendiente, D8) |
| R3 | Robo de token de sesión vía XSS | M | A | Cookies `httpOnly` + `secure`; el rol se obtiene de `GET /auth/me`, nunca de una cookie legible; headers de seguridad y CSP (en modo Report-Only) | BFF / admin / Astro | `docs/security-access-token-httponly.md`, `app.setup.spec.ts`, `security-headers.conf`, `securityHeaders.ts` | M (CSP a forzar tras observar) |
| R4 | Uso de un refresh token como access token (o viceversa) | M | A | Claim `type` validado en MS y BFF | MS / BFF | `JwtServiceTest`, `AuthTokenTypeIntegrationTest`, `jwt.strategy.spec.ts`, `role-matrix.spec.ts` | B |
| R5 | Sesión robada que sobrevive al logout | M | A | Refresh tokens persistidos (solo `jti`), rotación en cada uso, detección de reutilización con revocación de la familia, revocación en logout y al desactivar un usuario | MS / BFF | `RefreshTokenLifecycleIntegrationTest`, `RefreshTokenReuseDetectionIntegrationTest`, e2e `05-session-and-verification` | B (el access token vive hasta 15 min, D9) |
| R6 | Firma de tokens con una clave conocida por error de configuración | B | A | El MS no arranca sin `JWT_SECRET` de al menos 32 bytes | MS | `JwtSecretValidationTest` | B |
| R7 | Acceso a funciones de otro rol (escalada de privilegios) | M | A | Tres capas: `@PreAuthorize` en el MS, `@Roles` con guards globales en el BFF y rutas protegidas en el SPA | MS / BFF / admin | `*SecurityTest` del MS, `role-matrix.spec.ts` (62 rutas fijadas), e2e `04-authz-validation-override` | B |
| R8 | Acceso a recursos de otro usuario (IDOR) | M | A | Chequeos de pertenencia en necesidad, organización, donación, entrega y acreditación | MS | `DonacionServiceTest`, `EntregaServiceTest`, e2e escenario 6 (referente ajeno → 403) | B |
| R9 | Petición forjada desde otro sitio (CSRF) con cookies `sameSite=none` | M | M | Verificación de `Origin`/`Referer` contra la lista permitida en métodos que modifican datos; CORS restringido | BFF | `origin-check.middleware.spec.ts`, `allowed-origins.spec.ts` | B |
| R10 | Entradas maliciosas o malformadas | A | M | Bean Validation (`@Valid`) en el MS; `ValidationPipe` con `whitelist` + `forbidNonWhitelisted` en el BFF; DTO en todos los cuerpos | MS / BFF | `validation.spec.ts`, `toggle-activo.dto.spec.ts`, e2e escenario 7 | B |
| R11 | Subida de archivos no permitidos (ejecutables disfrazados) | M | M | Límite de 5 MB; tipo validado por firma de bytes (JPEG, PNG, WebP), no por el `mimetype` del cliente | BFF | `image-type.spec.ts`, `upload.service.spec.ts` | B |
| R12 | Fuga de detalles internos en mensajes de error | M | B | Manejadores globales con mensajes genéricos; el detalle solo va al log | MS / BFF | `GlobalExceptionHandler`, `axios-exception.filter.spec.ts` | B |
| R13 | Confirmación fraudulenta de una entrega | M | A | Código de un solo uso, hasheado, válido 10 min, bloqueo tras 5 intentos | MS | `EntregaServiceLockoutIntegrationTest`, e2e `03-exceptional-paths` (5, 5b, 5c) | B |
| R14 | Alta de cuentas con emails ajenos | M | M | Verificación de email por OTP (Resend), hasheado, con bloqueo por intentos; acciones sensibles exigen email verificado | MS | `OtpServiceLockoutIntegrationTest`, `OtpServiceTest`, e2e escenario 8 | B |
| R15 | Envío silencioso de OTP al log en producción | B | M | El MS no arranca sin configuración de Resend salvo `MAIL_LOG_ONLY=true` explícito; incluso en ese modo el código no se escribe en el log (solo el email enmascarado) | MS | `MailerConfigTest` | B |
| R16 | Superficie expuesta innecesaria (consola H2, SQL en logs) | B | M | `/h2-console` fuera de las rutas públicas; `show-sql` desactivado por defecto | MS | `SecurityConfigH2ConsoleTest` | B |
| R17 | Transiciones de estado inválidas en donaciones | M | M | Máquina de estados explícita; override de admin solo con motivo registrado | MS | `TransicionesDonacion`, `DonacionServiceTest`, e2e escenarios 3, 4 y 9 | B |
| R18 | Acciones administrativas y eventos de seguridad sin trazabilidad | M | M | Registro de actividades inmutable (`actividad`): inicios de sesión (éxito y fallo), cierres, renovación y reutilización de tokens, bloqueos de OTP y de códigos de entrega, escrituras de administración y cambios de estado de donaciones y necesidades; solo lectura para ADMINISTRADOR, texto saneado contra inyección de logs, retención configurable, rotación de logs de Docker. Ver `docs/registro-actividades.md` | MS / BFF / admin / Infra | `ActividadServiceIntegrationTest`, `AuthLoginActividadIntegrationTest`, `ActividadControllerTest`, `client-ip.spec.ts`, e2e `08-activity-log` | B (la tabla es inmutable para la aplicación, no para quien tenga acceso directo a la base; retención provisoria hasta D12) |
| R19 | Pérdida de datos (falla del Pi o de la microSD, error humano) | M | A | `make backup` (pg_dump comprimido) previo a migraciones | Infra | `Makefile`, `docs/deploy-rpi-cloudflare.md` | **A** (backup automático, copia externa y restauración probada pendientes: B1–B3, D11) |
| R20 | Exposición de datos personales del donante | M | M | La identidad del donante solo la ven la organización receptora, el propio donante y los administradores; publicarla requiere activar `DONANTE_PUBLICO` | MS / BFF | `DonanteVisibilidadTest`, e2e `06-donor-privacy` | B (retención y borrado pendientes, D12) |
| R21 | Evasión del límite de intentos falseando la IP | B | M | La IP se toma de `cf-connecting-ip`; el BFF solo es accesible a través del túnel de Cloudflare | Infra | `client-ip-throttler.guard.spec.ts`, runbook de despliegue | B (requiere no exponer el puerto 3001) |

## Riesgos residuales y decisiones pendientes

Los riesgos marcados en negrita dependen de definiciones de negocio todavía abiertas (lista D en
`odd/tasks/seguridad-calidad.md`):

- **R19**: definir RPO/RTO, retención, destino de la copia externa y responsables (D11), y luego
  automatizar el backup y ejecutar un simulacro de restauración (B1–B3).
- **R20**: definir la política de retención y borrado de datos personales (D12).
- **R18**: alcance decidido (D10) e implementado (N10). Queda definir la retención definitiva junto con los datos personales (D12); el valor actual, 365 días, es provisorio.
- **R3**: pasar la CSP de Report-Only a forzada después de observar el sitio desplegado.

## Cómo se verifica

| Nivel | Comando | Qué demuestra |
|-------|---------|---------------|
| Unitario e integración MS | `mvn test` (en `jar_hornero_ms`) | Reglas de negocio, tokens, bloqueos, seguridad por endpoint |
| Unitario BFF | `npm test` (en `ts_hornero_bff`) | Guards reales, matriz de roles, validación, headers, CSRF, límites |
| End-to-end | `make up-local` y luego `make e2e` | Flujo completo de donación y escenarios excepcionales contra el stack real |
