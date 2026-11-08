# Seguridad de sesiones (tarea C2)

Estado verificado en la rama `tfg/entrega-4`. Las rutas de archivo son relativas a la raíz del repositorio. Solo se afirma lo que se leyó en el código o se ejecutó; lo que requiere el stack en marcha figura como pendiente.

## 1. Lo que ya existía

| Requisito | Evidencia |
| --- | --- |
| Refresh token guardado en el servidor | Entidad `RefreshToken` con `jti` (único), `usuarioId`, `familyId`, `issuedAt`, `expiresAt`, `revokedAt`, `rotatedAt`: `jar_hornero_ms/src/main/java/org/example/auth/RefreshToken.java:29-53`. |
| Emisión de una familia nueva en login, registro y OTP | `RefreshTokenService.java:55` (`issue`). |
| Rotación y detección de reutilización | `RefreshTokenService.java:64-86` (`rotate`): marca `rotatedAt`, tolera repeticiones dentro de una ventana de gracia (30 s por defecto, `:43`) y fuera de ella revoca la familia (`:77`) y registra `REFRESH_TOKEN_REUTILIZADO` (`:80`). |
| El refresh rechaza tokens revocados o desconocidos | `RefreshTokenService.java:65-68` (responde 401). El token se valida antes en `AuthService.java:59-67`. |
| Logout revoca la familia | `AuthController.java:53-58` llama a `AuthService.logout` (`AuthService.java:88-94`), que ejecuta `revokeFamilyOf` (`RefreshTokenService.java:90`). Siempre responde 204. |
| El BFF borra las tres cookies al cerrar sesión | `ts_hornero_bff/src/auth/auth.service.ts:115-117`. |
| Restablecer contraseña revoca todas las sesiones | `jar_hornero_ms/src/main/java/org/example/auth/reset/PasswordResetService.java:183`. |
| Desactivar un usuario revoca todas sus sesiones | `jar_hornero_ms/src/main/java/org/example/user/UsuarioService.java:79-81`. |
| Anonimizar un usuario revoca todas sus sesiones | `jar_hornero_ms/src/main/java/org/example/user/UsuarioAnonimizacionService.java:94`. |
| Limpieza de tokens vencidos | `RefreshTokenService.java:101-110` (diaria, 03:30). |
| E2E de logout con refresh rechazado (401) | `e2e/tests/05-session-and-verification.e2e.ts:60-75`. |
| Cabeceras de seguridad en BFF, Astro y SPA | Ver sección 5. |

Duraciones configuradas: acceso 900000 ms (15 min) y refresh 604800000 ms (7 días), en `jar_hornero_ms/src/main/resources/application.yml:28-29`.

## 2. Lo que se agregó

| Cambio | Evidencia |
| --- | --- |
| Endpoint del MS `POST /api/usuarios/{id}/sesiones/revocar` (204), solo `ADMINISTRADOR` | `jar_hornero_ms/src/main/java/org/example/user/UsuarioController.java:51-56` (`@PreAuthorize("hasRole('ADMINISTRADOR')")`). |
| Servicio: revoca todos los refresh del usuario y registra el evento | `UsuarioService.java:97-104`. Devuelve 404 si el usuario no existe. |
| Evento de auditoría `SESIONES_REVOCADAS` con el administrador como actor | `TipoActividad.java:33`. El actor lo toma el registro de actividad del contexto de seguridad, igual que `USUARIO_DESACTIVADO`. |
| Proxy del BFF con `@Roles(Role.ADMINISTRADOR)` | `ts_hornero_bff/src/usuarios/usuarios.controller.ts:79-88` y `usuarios.service.ts:60`. Registrado en la matriz de roles `ts_hornero_bff/src/auth/role-matrix.spec.ts`. |
| Etiqueta en español del evento en el panel de actividad | `ts_hornero_admin/src/lib/domain-ui.ts` (`SESIONES_REVOCADAS`). |
| Pruebas unitarias del MS | `UsuarioServiceTest` (revoca y registra; 404 sin efectos) y `UsuarioControllerSecurityTest` (anónimo, donante y referente reciben 403; administrador recibe 204). |
| Pruebas del BFF | `usuarios.controller.spec.ts`, `usuarios.service.spec.ts`, `role-matrix.spec.ts`. |
| Prueba de atributos de cookie por entorno | `ts_hornero_bff/src/auth/auth.service.spec.ts`, bloque `session cookie attributes (C2)`. |
| E2E | `e2e/tests/13-session-revocation.e2e.ts` (ver sección 6). |

En el MS la regla de acceso de `/api/usuarios` no está en `SecurityConfig` como matcher propio: cae en `anyRequest().authenticated()` y la restricción por rol está en `@PreAuthorize`, igual que el resto de los endpoints de ese recurso. En el BFF la restricción es `@Roles`. Se probó que ambas capas devuelven 403 a los roles no administradores.

No se agregó interfaz de administración. La única ubicación natural sería la tabla de usuarios, que pertenece al trabajo paralelo de tablas y cajón lateral del autor.

## 3. Cambio de contraseña dentro de la sesión

No existe. Se buscó en el MS, el BFF y los tres frontends: la única forma de cambiar la contraseña es el flujo de restablecimiento por correo (`/auth/password/olvido` y `/auth/password/restablecer`), que sí revoca todos los refresh tokens (`PasswordResetService.java:183`). `Usuario.setPassword` solo se invoca en ese flujo, en el alta de datos de demostración y en la anonimización. Como ninguna pantalla ni flujo lo necesita, no se inventó el endpoint. Si el autor decide agregarlo, el requisito ya está resuelto por `RefreshTokenService.revokeAllFor`.

## 4. Hash del refresh token

La tarea pide guardar un hash del token. En el diseño actual no hace falta, por lo siguiente:

- El token que viaja en la cookie es un JWT firmado (`JwtService.java:71-83`): contiene el `jti` como identificador y una firma HMAC calculada con `JWT_SECRET`. El servidor solo acepta un token si la firma verifica (`JwtService.java:85-91`, `verifyWith`).
- La base guarda únicamente el `jti`, un UUID aleatorio (`RefreshTokenService.java:114`), nunca el token (comentario en `RefreshToken.java:16-19`). Quien lea la tabla obtiene identificadores, no tokens presentables: sin el secreto no puede construir un JWT con firma válida.
- Por lo tanto, la propiedad que busca el hash (que una filtración de la tabla no permita usar sesiones) ya se cumple. Un hash del JWT completo no agregaría protección, porque el servidor no puede reconstruir el token a partir de la fila.

Límite: la propiedad depende de que `JWT_SECRET` no se filtre junto con la base. Con ambos, un atacante podría firmar tokens nuevos con `jti` existentes. No se cambió nada.

## 5. Cookies y cabeceras

### Cookies (`ts_hornero_bff/src/auth/auth.service.ts:120-145`)

| Cookie | Producción (`NODE_ENV=production`) | Desarrollo local |
| --- | --- | --- |
| `access_token` | `HttpOnly`, `Secure`, `SameSite=None`, 900 s | `HttpOnly`, sin `Secure`, `SameSite=Lax`, 900 s |
| `refresh_token` | `HttpOnly`, `Secure`, `SameSite=None`, 604800 s | `HttpOnly`, sin `Secure`, `SameSite=Lax`, 604800 s |
| `session_hint` (valor `1`) | sin `HttpOnly` por diseño, `Secure`, `SameSite=None`, 900 s | sin `HttpOnly`, sin `Secure`, `SameSite=Lax`, 900 s |

`Secure` y `SameSite=None` solo se envían en producción: el stack local usa HTTP y los navegadores rechazan `SameSite=None` sin `Secure`. Esos valores no son observables en el entorno local, así que se verifican con la prueba unitaria `session cookie attributes (C2)`, que fija `NODE_ENV` en cada caso y comprueba las opciones pasadas a `res.cookie`. El E2E verifica en el stack real lo observable (`HttpOnly`, `Path`, `Max-Age`, presencia de `SameSite`) y que `Secure` aparezca si y solo si `SameSite=None`.

`session_hint` no lleva el rol; el rol se obtiene de `GET /auth/me`.

### Cabeceras

| Componente | nosniff | Referrer-Policy | Anti-frame | CSP |
| --- | --- | --- | --- | --- |
| BFF (`ts_hornero_bff/src/app.setup.ts:17-30`, helmet 8.3.0) | `nosniff` | `no-referrer` | `X-Frame-Options: SAMEORIGIN` y `frame-ancestors 'self'` | Aplicada (no es report-only). Valor por defecto de helmet: `default-src 'self'; script-src 'self'; style-src 'self' https: 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'self'` y otras. Deshabilitada solo en `/api/docs` (Swagger). |
| Astro (`ts_hornero_astro/src/lib/securityHeaders.ts:80-95`) | `nosniff` | `strict-origin-when-cross-origin` | `X-Frame-Options: DENY` y `frame-ancestors 'none'` | `Content-Security-Policy-Report-Only` por defecto. |
| SPA de administración (`ts_hornero_admin/security-headers.conf.template:9-23`) | `nosniff` | `strict-origin-when-cross-origin` | `X-Frame-Options: DENY` y `frame-ancestors 'none'` | `Content-Security-Policy-Report-Only` por defecto. |

El BFF verifica las tres primeras cabeceras en `ts_hornero_bff/src/app.setup.spec.ts:33-45`. Astro y la SPA no tienen prueba automática de cabeceras (Astro no tiene runner de pruebas; en la SPA lo define nginx). Esas dos filas se verificaron por lectura de código, no por una respuesta HTTP real.

### Estado de la CSP en Astro y en la SPA

Ambas están en modo solo informe (`Content-Security-Policy-Report-Only`): registran violaciones en la consola del navegador y no bloquean nada. No se cambió el valor por defecto. Es una decisión del autor porque enforzar puede romper la producción.

Para enforzar: definir `CSP_MODE=enforce` en el entorno de despliegue y recrear los contenedores `astro` y `admin`, sin reconstruir imágenes (`docker-compose.yml:189` y `:215`; lectura en `ts_hornero_astro/src/middleware.ts:5` y `ts_hornero_admin/docker-entrypoint.d/10-csp-mode.envsh:6`). Es una sola variable para ambos servicios. Cualquier otro valor, incluido un error de tipeo, deja el modo solo informe. Antes de activarla conviene navegar el sitio y la SPA con la consola abierta y revisar que no haya violaciones.

### Cobertura de Leaflet y OpenStreetMap

- Los tres puntos de uso de teselas piden `https://{s}.tile.openstreetmap.org/...` (`ts_hornero_astro/src/components/islands/leaflet-map.tsx:237`, `ts_hornero_admin/src/components/map/OrgLocationPicker.tsx:97`).
- Astro permite `img-src` `https://*.tile.openstreetmap.org` (`securityHeaders.ts:11,65`) y la SPA lo mismo en su plantilla. Ambas incluyen `data:` y `blob:` para imágenes.
- Los marcadores y clústeres usan `L.divIcon` (sin imágenes externas). El CSS de Leaflet se empaqueta con la aplicación.
- `style-src 'unsafe-inline'` está permitido en ambas porque Leaflet y React posicionan con estilos en línea. Es un residuo conocido.
- No se encontraron dependencias a otros servicios de mapas ni de geocodificación.

Brechas: ninguna detectada por lectura de código. No se observó el comportamiento en un navegador real; la verificación definitiva es la consola en modo solo informe.

## 6. Pruebas E2E nuevas (pendientes de ejecución)

Archivo `e2e/tests/13-session-revocation.e2e.ts`. Requiere el stack (`make up-local`) y se ejecuta con `make e2e`. No se ejecutó: el flujo exige Docker, que quedó fuera de esta tarea. Solo se comprobó el chequeo de tipos con `npx tsc --noEmit` en `e2e/`.

Cubre: atributos de cookie tras un login real; `session_hint` sin `HttpOnly`; 403 para roles no administradores; revocación por administrador; refresh revocado devuelve 401; el evento `SESIONES_REVOCADAS` con actor `ADMINISTRADOR`; el usuario puede volver a iniciar sesión. Consume un registro y dos inicios de sesión del límite por IP; el cliente espera y reintenta si recibe 429.

## 7. Límites

- Un access token ya emitido sigue siendo válido hasta 15 minutos después de revocar las sesiones: `JwtAuthFilter` solo comprueba la firma, el tipo y que el usuario esté activo (`jar_hornero_ms/src/main/java/org/example/config/JwtAuthFilter.java:44-62`), no la revocación del refresh. Se documentó con una aserción en el E2E. Desactivar o anonimizar al usuario sí corta el acceso de inmediato.
- Una revocación por administrador no desactiva la cuenta: el usuario puede iniciar sesión de nuevo con sus credenciales.
- Las cookies se borran con `clearCookie` sin repetir `SameSite` ni `Secure`; no se verificó su efecto en un navegador en producción.
- La verificación de cabeceras de Astro y la SPA no se hizo sobre respuestas reales.
