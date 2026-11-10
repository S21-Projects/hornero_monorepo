# Validación y calidad

Evidencia de las pruebas y verificaciones de Hornero. Todos los números de esta página se
obtuvieron el 2026-10-13 sobre la rama `feat/validacion-calidad` (base `develop` en `35e0a23`) y se
reproducen con los comandos indicados.

## 1. Estrategia de pruebas

Se aplica una pirámide de pruebas con más casos en la base (rápidos y aislados) y pocos en la
cima (lentos, contra el sistema completo).

| Nivel | Qué verifica | Herramienta |
|-------|--------------|-------------|
| Unitario | Regla de negocio aislada (transiciones de estado, scoring, validadores) | JUnit 5 + Mockito (MS), Jest (BFF), Vitest (admin), `testing` (Go) |
| Integración | Capas reales juntas: controlador, seguridad, servicio y repositorio sobre H2 | `@SpringBootTest` + H2 + `spring-security-test` |
| Contrato HTTP del BFF | Guards reales (`RolesGuard`, `JwtStrategy`), validación de DTO, throttling | Jest + Supertest, sin mocks de los guards |
| Componentes (admin) | Pantallas y rutas protegidas, estados de error y de carga | Vitest + Testing Library (jsdom) |
| End-to-end (API) | Flujos completos contra el stack Docker real (Astro/BFF/MS/PostgreSQL/worker) | Vitest sobre HTTP, `make e2e` |

Criterios que rigen la estrategia:

- **Repositorios reales donde importa la transacción.** Una prueba unitaria con repositorios
  simulados no ve qué se persiste ni qué se revierte. El defecto F1 lo demostró: el contador de
  intentos fallidos de un código de entrega se escribía dentro de una transacción que luego se
  revertía por la excepción de negocio, de modo que el bloqueo nunca se guardaba. Solo las pruebas
  de integración con repositorios reales (`EntregaServiceLockoutIntegrationTest`,
  `OtpServiceLockoutIntegrationTest`) y el escenario e2e `5c` lo hicieron visible.
- **Guards reales en el BFF.** `role-matrix.spec.ts` recorre todas las rutas con los guards de
  producción y fija qué rol accede a cada una; un endpoint nuevo sin decorador de rol rompe la
  prueba.
- **Sin navegador en la cima.** El e2e se ejecuta a nivel API (decisión explícita): cubre las reglas
  de negocio y de seguridad con menos fragilidad que una prueba de interfaz.
- **TDD estricto.** `openspec/config.yaml` fija `strict_tdd: true`. El ciclo es RED (la prueba nueva
  falla por la razón correcta) → GREEN (implementación mínima) → refactor. Cada tarea del registro
  `odd/tasks/seguridad-calidad.md` deja anotado el RED y el GREEN observados.

## 2. Requisitos de la guía y su evidencia

| Requisito de la guía | Mecanismos en el código | Pruebas representativas | Cómo ejecutarlas |
|----------------------|-------------------------|-------------------------|------------------|
| Validaciones de datos | Bean Validation en DTO del MS; `ValidationPipe` con `whitelist` y `forbidNonWhitelisted` en el BFF; política de contraseñas NIST SP 800-63B-4; esquema con restricciones en BD | `04-authz-validation-override.e2e.ts` (sección 7), `05-session-and-verification.e2e.ts` (`PASSWORD_DEMASIADO_CORTA`, `PASSWORD_COMUN`), `10-password-reset.e2e.ts`, `auth.controller.spec.ts` | `make e2e`; `npm test` (BFF) |
| Manejo de errores | Respuestas con código de negocio (`USUARIO_INACTIVO`, `IDEMPOTENCIA_PAYLOAD_DISTINTO`, etc.); 404 en lugar de 403 para recursos ocultos; filtros de excepción del BFF; estados de error en el admin | `NecesidadServiceTest` (`findById_*`), `09-idempotency.e2e.ts`, `ProtectedRoute.test.tsx`, `necesidad-detalle.test.tsx` | `mvn test`; `npm test` (admin) |
| Casos de prueba | Suites por capa con nombres que describen el comportamiento esperado | 920 (MS), 365 (BFF), 513 (admin), 56 (worker), 95 (e2e); ver sección 4 | Comandos de la sección 4 |
| Pruebas funcionales | Escenarios de negocio completos sobre el stack real | `01-direct-flow.e2e.ts`, `02-fondo-comun.e2e.ts`, `11-anonimizacion.e2e.ts` | `make up-local` y `make e2e` |
| Validación de reglas de negocio | Máquina de estados de la donación, tope de necesidades abiertas por nivel de acreditación, ocultamiento de organizaciones N0, asignación por rondas, vencimiento y relanzamiento | `TransicionesDonacionTest`, `NecesidadServiceRelanzarTest`, `VencimientoNecesidadesJobTest`, `RondaServiceTest`, `assign/*_test.go`, `04-authz-validation-override.e2e.ts` (M3/M4) | `mvn test`; `go test ./...` |
| Escenarios normales y excepcionales | Casos felices y de falla en el mismo archivo de prueba (ver sección 3) | `01` y `02` (normales); `03`, `04`, `07` (excepcionales) | `make e2e` |
| Verificación de resultados | Aserciones sobre estado final persistido, no solo sobre la respuesta; registro de actividades; informes de cobertura | `08-activity-log.e2e.ts`, `UsuarioAnonimizacionIntegrationTest`, informes JaCoCo/Jest/Vitest | `make coverage` |

## 3. Escenarios normales y excepcionales

| Flujo | Camino normal | Casos excepcionales | Dónde se prueba |
|-------|---------------|---------------------|-----------------|
| Registro y OTP | Registro, verificación del código y sesión iniciada | Contraseña corta o común (400); usuario sin verificar no puede donar (403); reenvío limitado; código vencido o con demasiados intentos | `05-session-and-verification.e2e.ts`, `OtpServiceTest`, `OtpThrottleTest`, `OtpServiceLockoutIntegrationTest`, `verify-email.test.tsx` |
| Login, sesión y refresh | Login, `/auth/me`, refresh rotativo, logout | Credenciales erróneas registradas sin la contraseña; refresh ya rotado o tras logout (401); reutilización detectada y familia revocada; usuario desactivado cortado de inmediato | `05`, `07-deactivated-user.e2e.ts`, `08-activity-log.e2e.ts`, `RefreshTokenReuseDetectionIntegrationTest`, `auth.throttling.spec.ts` |
| Donación directa | OFRECIDA → ACEPTADA → EN_CAMINO → PENDIENTE_CONFIRMACION → ENTREGADA | Rechazo (RECHAZADA); cancelación; salto de estado fuera de la tabla; referente de otra organización (403); estado terminal inmodificable | `01-direct-flow.e2e.ts`, `03-exceptional-paths.e2e.ts`, `04-authz-validation-override.e2e.ts`, `TransicionesDonacionTest` |
| Fondo común y ronda | El donante ofrece al fondo; el administrador dispara la ronda; se asigna a una necesidad compatible; el referente acepta | El referente no puede decidir mientras la donación está en el fondo; solo el administrador dispara rondas; worker caído responde 503 | `02-fondo-comun.e2e.ts`, `RondaServiceTest`, `RondaControllerTest`, `assign/ronda_test.go`, `assign/hungarian_test.go` |
| Entrega con código | Cada parte genera su código de 6 dígitos y verifica el de la otra | Código erróneo (400, estado sin cambios); quinto intento erróneo bloquea (429); verificar antes de que exista el código de la contraparte; lectura anónima del estado | `01`, `03-exceptional-paths.e2e.ts` (`5`, `5b`, `5c`), `EntregaServiceLockoutIntegrationTest`, `CodigoEntregaThrottleTest`, `EntregaControllerSecurityTest`, `entrega.test.tsx` |
| Necesidades: vencimiento y relanzar | Una necesidad se publica y el referente la relanza con nueva fecha | Vencida: retirada de los listados públicos; relanzar respeta fecha futura y tope por nivel (409); detalle de una organización N0 devuelve 404 a anónimos y a terceros | `VencimientoNecesidadesJobTest`, `NecesidadServiceRelanzarTest`, `04-authz-validation-override.e2e.ts` (M3/M4), `necesidades.service.spec.ts` |
| Idempotencia | Una clave nueva ejecuta la operación y guarda el resultado | Falta de clave (400); clave no UUID (400); misma clave y mismo cuerpo repite el resultado sin duplicar; mismo cuerpo distinto (422); dos solicitudes simultáneas ejecutan una sola vez | `09-idempotency.e2e.ts`, `IdempotenciaIntegrationTest` |
| Auditoría | Cada evento de seguridad deja un registro con actor, antes/después, motivo e IP | Solo el administrador lee el registro (403/401 al resto); sin endpoints para modificar o borrar entradas; nunca se guarda la contraseña | `08-activity-log.e2e.ts`, `ActividadServiceIntegrationTest`, `ActividadControllerTest`, `ActividadRetencionJobTest` |
| Anonimización | El administrador anonimiza a un usuario: la sesión, el refresh y el login quedan muertos y los listados muestran "Usuario eliminado" | Usuario no administrador (403); auto-anonimización (409); segunda anonimización (409); sin clave de idempotencia (400); el registro de auditoría no conserva el correo original | `11-anonimizacion.e2e.ts`, `UsuarioAnonimizacionIntegrationTest`, `UsuarioAnonimizacionServiceTest` |

## 4. Resultados actuales

Fecha: 2026-10-13. Base: `35e0a23` (`develop`) más los cambios de N16 y N17 aún sin confirmar.

| Servicio | Comando | Pruebas | Cobertura de líneas |
|----------|---------|---------|---------------------|
| MS (Spring Boot) | `mvn test` (con `-Pcoverage` para JaCoCo) | 920 correctas, 0 fallas | 90,7 % (4022/4436) |
| BFF (NestJS) | `npm test` / `npm run test:cov` | 365 correctas | 95,8 % (1079/1126) |
| Admin (React/Vite) | `npm test` / `npm run test:cov` | 513 correctas | 79,7 % (2754/3456) |
| Worker (Go) | `go test ./...` / `go test -cover ./...` | 56 pruebas (75 con subpruebas) | 66,7 % de sentencias |
| API e2e | `make e2e` | 95 correctas en 11 archivos | no aplica |

Verificaciones estáticas: `npx tsc --noEmit -p tsconfig.json` (BFF), `npm run build` y
`npm run lint` (admin, sin errores), `go vet ./...` (worker).

La cobertura se obtiene con `make coverage`, que ejecuta las cuatro suites y imprime una línea por
servicio. Es informativa: no hay umbrales que hagan fallar la compilación. Los informes HTML quedan
en `jar_hornero_ms/target/site/jacoco/index.html`, `ts_hornero_bff/coverage/` y
`ts_hornero_admin/coverage/` (ignorados por git). El paquete menos cubierto del worker es
`internal/metrics` (52,6 %), que corresponde al modo de cálculo por lotes sin uso en línea.

## 5. Defectos hallados por las pruebas y corregidos

| Defecto | Cómo apareció | Corrección |
|---------|---------------|------------|
| F1: el bloqueo por intentos fallidos de código de entrega y OTP no se persistía (se revertía con la transacción) | Un e2e marcado como falla esperada (`it.fails`) y pruebas de integración con repositorios reales | `0bfe751` |
| Alta de organización con nombre repetido respondía 500 por la restricción única del `slug` | Verificación del seed y e2e | `f419fcd` (sufijo `-2`, `-3`) |
| Prueba de la matriz de roles intermitente (cortes de socket) | Ejecuciones repetidas | `cab6948` (un solo `listen` por suite) |
| `MAIL_LOG_ONLY=true` ignorado cuando había clave de Resend, con envío real en local | Verificación manual; prueba RED que llamaba a Resend | `62c741c` |
| `make seed` roto por el límite de registros por minuto (429) | Ejecución del seed contra el stack con el nuevo throttle | `f810beb` (el seed espera y reintenta) |
| `/restablecer` envuelta en `PublicOnlyRoute`: un navegador con sesión perdía el token al redirigir | Revisión de la pantalla; prueba de ruteo RED | `7d1535c` |

## 6. Limitaciones conocidas

- No hay pruebas end-to-end con navegador; la decisión fue verificar a nivel API.
- La Content-Security-Policy opera en modo solo informe (report-only) a la espera de revisar los
  informes antes de imponerla.
- El BFF mantiene errores de lint previos a este trabajo; por eso la verificación del BFF usa
  `tsc --noEmit` y las pruebas, no `npm run lint`.
- El sitio público (Astro) no tiene pruebas automatizadas; solo se verifica con `npm run build`.
- La cobertura del worker (66,7 %) y del admin (79,7 %) es la más baja; no se fijaron umbrales.
- Los números de cobertura son de líneas (sentencias en Go); no se midió cobertura de mutación.
