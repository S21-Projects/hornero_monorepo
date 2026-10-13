# Registro de actividades

Estado: implementado en la tarea N10 (decisión D10). Estándar de referencia: OWASP ASVS 5.0, V16
(registro de seguridad y manejo de errores).

## Tres cosas distintas

| | Registro técnico | Registro de actividades (auditoría) | Historia de dominio |
|---|---|---|---|
| Pregunta que responde | ¿Qué le pasó al sistema? | ¿Quién hizo qué, cuándo y desde dónde? | ¿Cómo llegó esta entidad a su estado actual? |
| Dónde vive | Salida estándar de cada contenedor (Docker) | Tabla `actividad` (PostgreSQL) | `organizacion_evento`, `Ronda`, campos de override |
| Quién lo lee | Quien opera el servidor | Solo ADMINISTRADOR, en `/actividad` | Pantallas de cada entidad |
| Se puede perder | Sí, rota por tamaño (5 × 10 MB por servicio) | No: solo se borra por retención | No |

La acreditación (cambios de nivel, evidencias) sigue registrándose únicamente en
`OrganizacionEvento`, que ya es inmutable, tiene actor y tiene su propia línea de tiempo por
organización. No se duplica en `actividad` para no tener dos fuentes de verdad. Lo que sí queda en
ambos lugares, con propósitos distintos, es el alta, la validación, el rechazo y la reasignación
de referente de una organización: `OrganizacionEvento` cuenta la historia de esa organización y
`actividad` permite ver todo lo que hizo un usuario. Como parte de N10 esos eventos de
`OrganizacionEvento` pasaron a registrar el actor (antes el alta y la reasignación quedaban con
actor nulo, es decir `SISTEMA`).

## Qué se registra

Cada fila responde a ASVS 16.2.1: cuándo (`ocurridoEn`, UTC), dónde (`ip`, `entidadTipo` +
`entidadId`), quién (`actorUsuarioId` + `actorTipo`) y qué (`accion`, `resultado`, `antes`/
`despues`, `motivo`, `detalle`).

- **Autenticación (16.3.1):** inicio de sesión exitoso y fallido (con la razón: usuario inexistente,
  inactivo o credenciales inválidas), cierre de sesión, registro, renovación de sesión, verificación
  de email.
- **Intentos de evadir controles (16.3.3):** reutilización de un refresh token (con revocación de la
  familia), bloqueo por intentos de OTP, bloqueo de código de entrega, códigos de entrega
  inválidos o vencidos.
- **Escrituras de administración:** activar y desactivar usuarios (con `motivo` opcional), alta,
  validación, rechazo y edición de organizaciones, aprobación y rechazo de información pública,
  reasignación de referente, catálogo de artículos, ejecución de rondas (manual y automática).
- **Cambios de estado de negocio:** creación, decisión, cancelación, eliminación y override de
  donaciones (con estado anterior y nuevo); alta, edición, relanzamiento y eliminación de
  necesidades; generación y verificación de códigos de entrega.
- **Tareas del sistema:** vencimiento diario de necesidades (una fila con la cantidad), purga de
  refresh tokens y la propia purga por retención. Actor `SISTEMA`.

Lista cerrada de acciones: `TipoActividad` en el MS. Las etiquetas en español están en
`ts_hornero_admin/src/lib/domain-ui.ts`.

### Qué no se registra

- Contraseñas, tokens (access o refresh), códigos OTP y códigos de entrega (16.2.5). El log de
  modo `MAIL_LOG_ONLY` tampoco escribe el código: solo el email enmascarado.
- Lecturas (GET), respuestas 403 y 429: quedan en el registro técnico, por decisión.
- Objetos completos: `antes`/`despues` guardan un valor corto (por ejemplo un estado), no la
  entidad. Las ediciones de organizaciones guardan los nombres de los campos tocados, no sus valores.
- Subidas de imágenes: el archivo se sube en el BFF y no se audita en sí mismo. El cambio queda
  registrado igualmente cuando la clave de la imagen se asocia a la organización
  (`ORGANIZACION_ACTUALIZADA` o `ORGANIZACION_INFO_PUBLICA_EDITADA`), y las evidencias de
  acreditación tienen su evento en `OrganizacionEvento`.

### Datos personales

Además de ids, la tabla guarda dos datos personales, ambos justificados:

- `ip`: el cliente que originó la acción (clave para investigar un incidente).
- `emailIntento`: únicamente en inicios de sesión fallidos y en pedidos de restablecimiento de
  contraseña (`PASSWORD_RESET_SOLICITADO`) de un email desconocido o inactivo. Sin él no se puede
  distinguir un ataque dirigido a una cuenta del ruido general. No se guarda en ningún otro evento.
  Nunca se guarda el token del enlace de restablecimiento.

### Notificaciones por email (N13)

`NOTIFICACION_FALLIDA` (resultado `FALLO`, actor `SISTEMA`) registra un correo que no se pudo
armar o enviar. El detalle lleva el nombre de la plantilla, el destinatario enmascarado
(`a***@dominio`) y la clase de la excepción; nunca el mensaje del proveedor ni el contenido. Los
envíos exitosos no se registran (volumen sin valor de auditoría). Ver `docs/notificaciones-email.md`.

## Cómo se garantiza

| ASVS | Medida |
|------|--------|
| 16.2.1 | Entidad `Actividad` con cuándo, dónde, quién y qué |
| 16.2.2 | `ocurridoEn` es un `Instant` en UTC; la pantalla lo muestra en hora argentina |
| 16.2.5 | Lista de campos cerrada; nunca se almacenan credenciales ni códigos |
| 16.3.1 | Todas las operaciones de autenticación, con éxito y fallo |
| 16.3.2 | 403 y 429 quedan solo en el registro técnico (decisión D10) |
| 16.3.3 | Reutilización de refresh token y bloqueos de OTP/entrega se registran como `FALLO` |
| 16.4.1 | `TextoSeguro` reemplaza CR/LF, caracteres de control, separadores Unicode y caracteres de formato (bidi, ancho cero) por un espacio y trunca al tamaño de columna; la IP debe ser un literal IP válido |
| 16.4.2 | Entidad `@Immutable` sin setters; el repositorio solo expone insertar y buscar; la API solo tiene `GET /api/actividad` (ADMINISTRADOR); la única operación que borra es la purga por retención, en una interfaz aparte; en PostgreSQL, un trigger (`scripts/sql/V004`) rechaza todo `UPDATE` y todo `DELETE`/`TRUNCATE` fuera de la purga (ver "Inmutabilidad en la base") |

### Inmutabilidad en la base

`scripts/sql/V004__actividad_inmutable.sql` crea un trigger en `actividad`: `UPDATE` siempre falla y
`DELETE`/`TRUNCATE` fallan salvo que la transacción haya fijado `hornero.purga_actividad = 'on'`.
Solo `ActividadRetencionJob` lo hace, con `set_config(..., true)` (equivalente a `SET LOCAL`) como
primera sentencia de su propia transacción, así que el permiso desaparece al confirmar o revertir y
no puede quedar en una conexión del pool. Verificado contra PostgreSQL real: `UPDATE`, `DELETE` y
`TRUNCATE` sueltos fallan; `DELETE` con el parámetro funciona; `UPDATE` con el parámetro sigue
fallando; y el job borró una fila de prueba de 800 días. Si falta el trigger, `EsquemaVerificador`
lo avisa al arrancar (`ESQUEMA_PENDIENTE`). H2 (tests) no tiene el trigger: allí la garantía sigue
siendo la de la aplicación.

### Transacciones

- Las acciones de negocio y de administración se registran **en la misma transacción** que la
  acción: se confirman o se revierten juntas, y si el registro falla la acción también (no hay
  acción sin rastro).
- Los eventos de seguridad (login fallido, bloqueos, reutilización de token) usan una transacción
  **independiente** (`REQUIRES_NEW`): la acción de negocio termina en excepción y se revierte, pero
  la fila debe sobrevivir. Es el mismo tipo de error que el defecto F1 (un rollback que se tragaba
  escrituras de seguridad). Si ese registro falla, se escribe al log técnico y el usuario no se
  ve afectado: la autenticación no depende de la tabla de auditoría.

### IP del cliente

El BFF calcula la IP real (`cf-connecting-ip` detrás del túnel de Cloudflare, o la dirección del
socket) y la envía al MS en `X-Client-IP` en cada llamada proxy, de forma centralizada
(`ts_hornero_bff/src/common/client-ip.ts`). El MS confía en ese encabezado porque solo es
alcanzable desde el BFF (el puerto se publica únicamente en `127.0.0.1`) y aun así valida que sea
un literal IP antes de guardarlo. Si el MS se expusiera directamente, el campo podría falsearse.

## Acceso, retención y rotación

- **Acceso:** `GET /api/actividad` (MS) y `GET /actividad` (BFF), solo ADMINISTRADOR, con filtros por
  usuario, acción, resultado, entidad y rango de fechas, paginado. Pantalla `/actividad` en el
  panel de administración.
- **Retención:** `app.actividad.retencion-dias` (variable `ACTIVIDAD_RETENCION_DIAS`, por defecto
  365). Un job diario borra lo anterior y deja una fila `ACTIVIDAD_PURGADA`. El valor es
  provisorio hasta definir D12.
- **Rotación de logs técnicos:** `docker-compose.yml` limita cada servicio a 5 archivos de 10 MB
  para no llenar la microSD de la Raspberry Pi.
- **Esquema:** la tabla `actividad` la crea `ddl-auto=update`; el trigger de inmutabilidad lo
  instala `scripts/sql/V004` (`make migrate`). Las columnas `accion` y `actor_tipo` se guardan como texto sin `CHECK`, para que
  agregar un valor a `TipoActividad` no requiera migración.

## Límites conocidos

- El trigger frena el SQL ad hoc, pero el dueño de la tabla o un superusuario puede quitarlo
  (`DROP TRIGGER`) o fijar el parámetro de purga. Cerrar ese resto exigiría que la aplicación se
  conecte con un rol de solo inserción/lectura, distinto del dueño de la tabla; no se implementó.
- La acción `REFRESH_TOKEN` genera una fila por cada renovación de sesión (cada 15 minutos por
  sesión activa). Es el costo de registrar todas las operaciones de autenticación; la retención lo
  acota.
- La pantalla muestra el nombre y el email del actor (resueltos por el MS en una sola consulta por
  página) y deja el tipo y el id como texto secundario; si el usuario ya no existe, solo el id.
