# Escalabilidad: uso, costo y arquitectura

Análisis de cómo se comportan los flujos de Hornero a escalas mayores. Relevado el 2026-10-13 sobre
`develop` (`dcf9b2a`). Los precios son tarifas públicas conocidas a 2025 y deben confirmarse antes de
citarse.

## 1. Conclusión

- **E0 (hoy) se cumple.** Una Raspberry Pi 5 con todos los servicios alcanza para cientos de usuarios.
- **E1 no se cumple todavía.** Requiere cuatro cambios de infraestructura y configuración (sección 7),
  ninguno de rediseño: caché de imágenes, disco SSD, límites de memoria y plan pago de Resend.
- **E2 requiere cambios de arquitectura**: varias instancias, sin estado en memoria y trabajo pesado
  asíncrono.
- Lo primero que se rompe al crecer no es la lógica de negocio sino la infraestructura: el tráfico de
  imágenes por la Pi, el almacenamiento en microSD y el estado en memoria que impide replicar servicios.

## 2. Escalas consideradas

| | E0 (hoy) | E1 (provincial) | E2 (nacional) |
|---|---|---|---|
| Usuarios activos | cientos | miles | decenas de miles |
| Visitas públicas por día | menos de 1.000 | 5.000 a 20.000 | más de 100.000 |
| Infraestructura | 1 Pi, microSD | 1 Pi con SSD | VPS o nube, 2 o más instancias |

## 3. Uso: qué se satura primero

| # | Punto | Situación actual | Escala en que falla | Mitigación |
|---|---|---|---|---|
| 1 | Imágenes | Cada vista pasa por el BFF, que pide el objeto a R2 y lo reenvía por la Pi y el túnel, sin `Cache-Control` (`ts_hornero_bff/src/images/images.controller.ts:76`). Con 20 imágenes de unos 200 KB por visita, 10.000 visitas diarias son unos 40 GB por día de subida doméstica. | E1 | `Cache-Control: public, max-age=31536000, immutable` (las claves llevan UUID y no cambian) y regla de caché de Cloudflare para `/images*`. En E2, servir `org-banner/` y `org-profile/` desde un dominio público de R2; la evidencia sigue por el proxy autenticado. |
| 2 | PostgreSQL en microSD | Escrituras por request en `actividad`, `refresh_tokens` e `idempotency_keys`. El backup (03:15) coincide con las purgas (03:15 a 03:50). | E1 | SSD NVMe en la Pi 5; mover el backup a las 04:30. |
| 3 | Memoria | Ningún servicio tiene `mem_limit`; la JVM usa el heap por defecto. JVM, Node y PostgreSQL compiten por la RAM. | E1 | Límites por servicio en `docker-compose.yml` y `-Xmx` explícito. |
| 4 | Consultas que crecen con los datos | `RondaService.leer()` hace una consulta por organización candidata y otra por donación del pozo (N+1, `RondaService.java:214-238`); `fondoEstado` carga el pozo para contarlo (`:191`); `listarTodas` usa `findAll()`. | E2 | Consultas agregadas y paginación. |
| 5 | Ronda síncrona | Llamada HTTP al worker con 30 s de timeout y un lock en memoria (`RondaService.java:114`). | E2 | Responder `202`, ejecutar en un job y consultar el estado. |

## 4. Costo mensual estimado

| Concepto | E0 | E1 | E2 |
|---|---|---|---|
| R2 (almacenamiento USD 0,015/GB; operaciones clase A USD 4,50/millón, clase B USD 0,36/millón; gratis 10 GB, 1 millón A y 10 millones B) | USD 0 | USD 0 (sin caché se acerca a los 10 millones de lecturas) | USD 1 a 5 con caché |
| Resend (gratis 3.000 por mes y 100 por día; Pro USD 20 por 50.000) | USD 0 | USD 0 a 20 | USD 20 a 90 |
| Cómputo | Pi + energía, unos USD 2 | Pi + SSD (compra única de unos USD 40) | VPS USD 10 a 40 o PostgreSQL gestionado USD 15 a 50 |
| Cloudflare Tunnel y Turnstile | USD 0 | USD 0 | USD 0 |
| **Total** | **unos USD 2** | **USD 2 a 25** | **USD 40 a 150** |

El primer costo que aparece es el **límite de 100 correos diarios** del plan gratuito de Resend: un día
con muchas donaciones (notificaciones, OTP, restablecimientos y resumen diario) lo supera. Los envíos
fallidos quedan registrados como `NOTIFICACION_FALLIDA` en `actividad`.

## 5. Arquitectura: supuestos de instancia única

Correctos para E0 y E1; a resolver antes de replicar servicios en E2.

| Componente | Problema con dos instancias | Solución |
|---|---|---|
| `OtpThrottle`, `CodigoEntregaThrottle` y el throttler del BFF | Contadores en memoria por instancia: el tope de intentos se multiplica | Persistirlos en PostgreSQL o Redis |
| Lock de la ronda (`ReentrantLock`) | Solo excluye dentro de la misma JVM | `pg_advisory_xact_lock` |
| Doce tareas `@Scheduled` | Se ejecutan una vez por instancia (por ejemplo, el resumen diario se enviaría dos veces) | ShedLock con JDBC |
| `mailExecutor` | Dos hilos y cola sin límite en memoria: un backlog consume RAM y se pierde si el proceso cae | Tabla outbox (sección 6) |
| `MapaOrganizacionesCache` | Una copia por instancia | No requiere cambios: la desactualización de 5 minutos está aceptada |

## 6. Cuándo conviene una cola

| Flujo | ¿Cola? | Motivo |
|---|---|---|
| Anonimización concurrente de administradores | No | Es un invariante ("siempre queda un administrador activo"); se resuelve con un lock en la base dentro de la transacción |
| Correos y notificaciones | Sí, primero como outbox | Hoy un fallo del proceso después del commit pierde el correo. Una tabla `outbox` escrita en la misma transacción y procesada con `SELECT … FOR UPDATE SKIP LOCKED` aporta durabilidad, reintentos y soporte multiinstancia sin un broker |
| Borrado de evidencia en R2 | Opcional | El barrido nocturno ya cubre los borrados fallidos |
| Ronda de asignación | Sí, en E2 | Trabajo pesado: `202` y ejecución en segundo plano |
| Tareas nocturnas | No | ShedLock alcanza |
| Subida de imágenes | No | Síncrona y acotada (5 MB) |

Un broker externo (RabbitMQ, SQS, Redis Streams) se justifica recién con varios consumidores, picos
fuertes o integraciones con terceros; ninguno aparece antes de E2.

## 7. Hoja de ruta

| Etapa | Cambios | Esfuerzo |
|---|---|---|
| Para E1 | Caché de imágenes (`Cache-Control` y regla de Cloudflare), SSD en la Pi, límites de memoria, backup a las 04:30, plan pago de Resend. Recomendado también: lock de anonimización de administradores, outbox de correos, eliminar el N+1 de la ronda. | Bajo: configuración y cambios acotados |
| Para E2 | ShedLock, throttles persistentes, advisory lock en la ronda, ronda asíncrona, imágenes públicas desde R2, migrar de la Pi a VPS o nube con PostgreSQL gestionado | Medio |
