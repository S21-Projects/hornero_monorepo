# Política de datos personales y de respaldo

Decisiones D11 (respaldo y recuperación) y D12 (protección de datos personales), aprobadas el
2026-10-13. Redactado para incorporarse al documento de tesis; el seguimiento de implementación
está en `odd/tasks/seguridad-calidad.md` (tarea N15).

## 1. Protección de datos personales (D12)

### 1.1 Marco

Hornero trata datos personales de donantes y referentes (nombre, correo electrónico, ubicación
de entrega) y, por lo tanto, se rige por la Ley 25.326 de Protección de los Datos Personales. Las
medidas se orientan por sus principios de **finalidad** (art. 4, inc. 3: los datos se usan solo
para el fin con que se recolectaron), **proporcionalidad** (art. 4, inc. 1: datos adecuados y no
excesivos) y **seguridad** (art. 9), y por el **derecho de supresión** (art. 16).

### 1.2 Datos tratados y finalidad

| Dato | Titular | Finalidad | Visibilidad |
|------|---------|-----------|-------------|
| Nombre y correo | Todos los usuarios | Identificación, autenticación, notificaciones | El propio usuario y administradores; el nombre del donante solo lo ve la organización receptora (D5) |
| Coordenadas de la donación | Donante | Asignación por cercanía y coordinación de la entrega | Organización receptora y administradores |
| Teléfono, mensaje y archivos de evidencia de un reclamo de organización | Referente | Que un administrador verifique que quien reclama es responsable del comedor | Administradores y el propio referente |
| Detalle de texto libre de un reporte de organización | Usuario que reporta | Que un administrador evalúe el reporte | Administradores |
| IP y correo intentado en logins fallidos | Cualquier visitante | Detección de ataques (registro de actividades) | Solo administradores |

### 1.3 Derecho de supresión: anonimización

Ante un pedido de baja, un administrador **anonimiza** la cuenta en lugar de borrarla:

- el nombre se reemplaza por "Usuario eliminado";
- el correo se reemplaza por un valor irreversible y único que no permite recuperar el original
  ni volver a iniciar sesión;
- se eliminan los datos de contacto y ubicación asociados al usuario;
- sus reclamos y reportes pendientes se cierran automáticamente (reclamos rechazados con el motivo
  "El solicitante dio de baja su cuenta", reportes descartados con la nota "El reportante dio de
  baja su cuenta"), con los mismos eventos y actividad que una resolución manual;
- los reclamos que presentó conservan su fila (estado, organización, resolución) pero pierden el
  teléfono, el mensaje y las referencias a los archivos de evidencia; los reportes que presentó
  pierden el detalle de texto libre;
- los archivos de evidencia de esos reclamos se **borran del bucket** una vez confirmada la
  anonimización (ver 1.7);
- la cuenta queda desactivada y sus sesiones revocadas.

Las donaciones y el registro de actividades **se conservan sin datos identificatorios**. Borrar
los registros rompería la trazabilidad, que es un requisito central del sistema; anonimizar
satisface la supresión de los datos personales sin destruir la historia operativa. La propia
anonimización queda registrada como actividad (quién la ejecutó y cuándo), sin datos del titular.

### 1.4 Minimización de la ubicación

Las coordenadas exactas de una donación solo son necesarias mientras la donación está en curso.
**Treinta días después de que una donación llega a un estado terminal** (entregada, rechazada o
cancelada), sus coordenadas se reducen a dos decimales (precisión aproximada de 1 km): siguen
siendo útiles para métricas territoriales, pero ya no permiten ubicar un domicilio.

Se descartó el **cifrado a nivel de campo**: exigiría administrar claves en el mismo servidor que
guarda los datos, lo que agrega riesgo operativo sin proteger frente a quien ya accede al
servidor. La minimización elimina el dato sensible en lugar de esconderlo.

### 1.5 Plazos de conservación

La ley exige destruir los datos cuando dejan de ser necesarios para su finalidad (art. 4, inc. 7).

| Información | Plazo | Motivo |
|-------------|-------|--------|
| Registro de actividades | 365 días | Investigación de incidentes y rendición de cuentas |
| Correo intentado en logins fallidos | 90 días | Dato sensible cuya utilidad para detectar ataques se agota antes |
| Coordenadas precisas de donaciones terminadas | 30 días | Ver 1.4 |
| Tokens de sesión, recuperación e idempotencia | Hasta su vencimiento (horas o días) | Datos técnicos de vida corta |
| Archivos de evidencia de reclamos de un usuario anonimizado | Se borran al anonimizar; el barrido nocturno reintenta lo que falle | Ver 1.7 |
| Archivos de evidencia huérfanos (sin fila que los referencie) | Se borran tras 7 días de gracia (hasta 500 por corrida) | Ver 1.7 |

### 1.6 Fuera de alcance (documentado)

- Exportación de los datos del titular (derecho de acceso, art. 14) y baja autogestionada: se
  atienden por pedido al administrador.
- Políticas de conservación de los respaldos (sección 2), que contienen datos personales por
  definición: se protegen con cifrado y acceso restringido en lugar de anonimización.

### 1.7 Borrado de los archivos de evidencia de reclamos

Los archivos que acompañan un reclamo (posibles fotos de documentos) viven en el bucket R2 bajo
`reclamo-evidencia/{organizacionId}/{referenteId}/`. El microservicio los borra en dos casos y
nunca toca otro prefijo del bucket (`org-evidencia/`, `org-banner/`, `org-profile/`):

- **Al anonimizar a un referente.** Las claves se copian antes de limpiar las filas y los archivos
  se borran **después de confirmada la transacción**: si la anonimización se revierte, no se borra
  nada. Se borran las claves referenciadas por sus reclamos y cualquier archivo suelto que quede
  bajo su identificador. Un fallo del almacenamiento no deshace la anonimización: se registra
  como actividad fallida y lo reintenta el barrido.
- **Barrido nocturno de huérfanos** (03:50, hora de Buenos Aires, y una vez al iniciar el
  servicio). Borra solo los archivos de `reclamo-evidencia/` con forma de clave válida que ningún
  reclamo referencia y que tienen más de 7 días (la gracia cubre una subida cuyo reclamo aún no se
  confirmó), hasta 500 por corrida. Se puede apagar con `EVIDENCIA_BARRIDO_ENABLED=false`.
- **Solo en producción.** Ambos mecanismos requieren `EVIDENCIA_BORRADO_ENABLED=true` (por
  defecto está apagado). El entorno local usa el mismo bucket de R2 que producción, así que ahí
  nunca se habilita: sin la variable el MS no lista ni borra nada.

Sin configuración de almacenamiento (`AWS_*` vacías) el servicio arranca igual y no borra nada,
con una advertencia al iniciar. El registro de actividades guarda solo cantidades: nunca claves,
rutas ni identificadores de organización (ver `docs/registro-actividades.md`).

## 2. Respaldo y recuperación (D11)

### 2.1 Objetivos

| Indicador | Valor | Significado |
|-----------|-------|-------------|
| **RPO** (Recovery Point Objective) | 24 horas | Pérdida máxima de datos aceptada: el respaldo es diario |
| **RTO** (Recovery Time Objective) | 4 horas | Tiempo máximo para volver a operar desde la copia externa |

### 2.2 Esquema

- **Frecuencia:** respaldo diario automático de la base de datos (`pg_dump`, temporizador de
  systemd).
- **Retención:** 14 días en el servidor y 30 días en la copia externa.
- **Copia externa:** bucket privado en Cloudflare R2, separado del de imágenes, con credenciales
  propias y de alcance limitado.
- **Cifrado:** los respaldos contienen datos personales, por lo que se cifran (AES-256 con
  derivación PBKDF2) antes de salir del servidor. La frase de cifrado se guarda **fuera** del
  servidor: si este se pierde, la clave debe sobrevivir.
- **Verificación:** cada respaldo se valida al generarse, y un simulacro de restauración
  (`make restore-check`) restaura en una base descartable y verifica el contenido.

### 2.3 Responsables

| Rol | Responsable |
|-----|-------------|
| Custodia de la frase de cifrado (y su copia externa) | A designar por el equipo |
| Acceso al bucket de respaldos | A designar por el equipo |
| Ejecución de una restauración real | A designar por el equipo |
| Simulacro de restauración | A designar; frecuencia: una vez por cuatrimestre |

### 2.4 Riesgo residual

Las imágenes y evidencias almacenadas en R2 no forman parte de este esquema; dependen de la
durabilidad del proveedor. Se documenta como riesgo residual.

## Referencias

- Ley 25.326 de Protección de los Datos Personales (arts. 4 incs. 1, 3 y 7; 9; 14 y 16).
- NIST SP 800-92, *Guide to Computer Security Log Management* (conservación de registros).
- OWASP ASVS 5.0, V16 (registro de seguridad) y V14 (protección de datos).
- Procedimiento operativo: `docs/deploy-rpi-cloudflare.md`, Parte C.
