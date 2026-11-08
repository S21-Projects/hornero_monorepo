# Seguridad de evidencias (C3)

Estado del código en la rama `tfg/entrega-4`. Las rutas con número de línea corresponden a esa rama.

## 1. Lo que ya existía

| Control | Dónde |
|---|---|
| Validación por firma de contenido (bytes iniciales), sin consultar el tipo ni el nombre que declara el cliente. JPEG, PNG, WebP y PDF | `ts_hornero_bff/src/upload/image-type.ts:22-57` |
| Nombre de objeto aleatorio: `{prefijo}/{uuid}.{extensión detectada}` | `ts_hornero_bff/src/upload/upload.service.ts:84` |
| Descarga solo por ruta autenticada (`REFERENTE` o `ADMINISTRADOR`) con verificación en el microservicio: clave de la forma `org-evidencia/{orgId}/{archivo}`, fila existente y propietario o administrador | `ts_hornero_bff/src/evidencia-files/evidencia-files.controller.ts:37`; `jar_hornero_ms/src/main/java/org/example/acreditacion/AcreditacionController.java:122-129` |
| `X-Content-Type-Options: nosniff` y `Cache-Control: private, no-store` | `evidencia-files.controller.ts:63,71` |
| La ruta pública `/images` rechaza (403) las claves con prefijo `org-evidencia/` y `reclamo-evidencia/` tras normalizar la ruta | `ts_hornero_bff/src/images/images.controller.ts:21,54` |
| Pruebas: un referente de otra organización recibe 403 al subir | `ts_hornero_bff/src/upload/upload.controller.spec.ts:182-189` |
| Pruebas: un referente de otra organización recibe 403 al descargar (MS) | `jar_hornero_ms/src/test/java/org/example/acreditacion/AcreditacionControllerEvidenciaArchivoTest.java:94` |

Antes de este cambio el tamaño máximo estaba fijo en 5 MB (`upload.module.ts:19`), los PDF se servían en línea y WebP se aceptaba como evidencia.

## 2. Lo que se agregó

| Cambio | Detalle | Pruebas |
|---|---|---|
| Tipos de evidencia: solo JPEG, PNG y PDF | WebP se rechaza para evidencia de acreditación. Las imágenes de perfil y de banner siguen aceptando WebP. Los selectores de archivo de la interfaz de administración ya no ofrecen WebP. | `image-type.spec.ts:115-146`, `upload.service.spec.ts` (bloque `WebP`), `EvidenciaForm.test.tsx:135` |
| Tamaño máximo configurable | Variable `UPLOAD_MAX_MB` (por defecto 5). Un valor inválido o no positivo vuelve al valor por defecto. | `upload-limits.spec.ts` |
| Eliminación de EXIF y GPS | Las imágenes JPEG y PNG de evidencia se recodifican en el servidor con `sharp`: se aplica la orientación EXIF a los píxeles y luego se descartan todos los metadatos. Una imagen corrupta o truncada se rechaza (400) y no se guarda. Los PDF no se modifican. | `evidence-image.spec.ts` (fixture con GPS construido en la prueba; se verifica su ausencia, la rotación aplicada y el rechazo de corruptos), `upload.service.spec.ts` |
| Descarga con `Content-Disposition: attachment` | Todas las evidencias de acreditación, PDF e imágenes. | `evidencia-files.controller.spec.ts:55-90` |
| Evento de descarga por administrador | `EVIDENCIA_ACREDITACION_DESCARGADA` en el registro de actividad: actor, id de la evidencia y organización (en el detalle, sin la clave del objeto). Se registra al autorizar, en el microservicio. Si el registro falla, la autorización falla. La descarga del referente propietario no se registra. | `EvidenciaDescargaAuditorTest`, `AcreditacionControllerEvidenciaArchivoTest` |
| Retención de archivos, desactivada por defecto | Ver sección 4. | `EvidenciaAcreditacionRetencionJobTest`, `ArchivoAcreditacionAlmacen*Test`, `OrganizacionEvidenciaRetencionQueryTest`, `RetencionDesactivadaPorDefectoTest` |
| Descarga de un archivo ya borrado | El microservicio responde 410 (`EVIDENCIA_ARCHIVO_ELIMINADO`) y el BFF lo traduce a 410 con mensaje claro, en lugar de un 500. | `AcreditacionServiceEvidenciaArchivoTest`, `acreditacion.service.spec.ts` |

Vista previa en la interfaz de administración: el cliente (`useEvidenciaArchivo.ts`) descarga el archivo como `blob` con `axios` y muestra la URL de objeto (`blob:`). La cabecera `Content-Disposition` no afecta a esa lectura ni a la URL de objeto, de modo que las imágenes y los PDF se previsualizan igual que antes. No se modificó el cliente. La prueba `useEvidenciaArchivo.test.ts:40` fija que la lectura se hace con `responseType: 'blob'`. Si se agregara un `<iframe>` o un `<img>` apuntando directamente a `/evidencia-files/...`, el PDF se descargaría en lugar de mostrarse.

### Pruebas pedidas

| Prueba | Estado | Ubicación |
|---|---|---|
| Referente de otra organización recibe 403 | Existía | `upload.controller.spec.ts:182-189` (subida); `AcreditacionControllerEvidenciaArchivoTest.java:94` (descarga) |
| `.exe` renombrado `.jpg` es rechazado | Agregada | `upload.service.spec.ts:229` (400 y nada se guarda); `image-type.spec.ts:142` |
| Archivo de 6 MB es rechazado | Agregada | `upload-limits.spec.ts:69` (413). La prueba monta la misma configuración de `multer` sobre un controlador mínimo; no recorre el módulo real. |

## 3. Configuración

| Variable | Servicio | Por defecto | Efecto |
|---|---|---|---|
| `UPLOAD_MAX_MB` | BFF | `5` | Límite por archivo, en megabytes (admite decimales), para todas las subidas. |
| `EVIDENCIA_RETENCION_ENABLED` | MS | `false` | Activa el borrado de archivos de evidencia de acreditación. |
| `EVIDENCIA_RETENCION_MESES` | MS | `12` | Antigüedad del vencimiento a partir de la cual se borra el archivo. |
| `EVIDENCIA_RETENCION_MAX` | MS | `100` | Máximo de archivos por corrida. |
| `EVIDENCIA_RETENCION_CRON` | MS | `0 30 4 * * *` | Horario (zona Buenos Aires). No corre al iniciar. |
| `EVIDENCIA_BORRADO_ENABLED` | MS | `false` | Existente. Solo cubre evidencia de reclamos. No habilita la retención. |

Ningún valor real se versiona: `.env.example` solo trae las variables comentadas con su valor por defecto.

## 4. Retención

- Candidatos: filas con archivo, sin `archivo_eliminado_at`, en estado `REEMPLAZADA` (de inmediato, porque la fila no guarda la fecha del reemplazo) o con `valido_hasta` anterior a hoy menos N meses.
- Por cada archivo: borra el objeto, completa `archivo_eliminado_at`, y registra un evento `EVIDENCIA_ACREDITACION_ARCHIVO_BORRADO` (actor `SISTEMA`). La fila y los eventos de acreditación se conservan. Si el borrado falla, la fila queda sin marcar y se reintenta en la corrida siguiente. Cada corrida deja un resumen en el log (cantidad borrada, fallida y candidata), sin claves.
- Protección contra borrados no deseados, en capas:
  1. Indicador propio `EVIDENCIA_RETENCION_ENABLED`, por defecto `false`. No se reutiliza `EVIDENCIA_BORRADO_ENABLED`: ese valor está en `true` en la Pi para la evidencia de reclamos, de modo que reutilizarlo habilitaría este borrado sin una decisión expresa. Como los entornos locales apuntan al bucket de producción, el indicador no se activa en ningún lado.
  2. Con el indicador apagado (o sin credenciales) el contexto crea un almacén nulo y no se construye ningún cliente S3 para este borrado. `ArchivoAcreditacionAlmacenConfigTest` y `RetencionDesactivadaPorDefectoTest` lo verifican.
  3. El almacén real solo borra claves que cumplen `org-evidencia/{número}/{archivo}` (sin barras ni punto inicial). Cualquier otra clave lanza un error antes de enviar la solicitud (`ArchivoAcreditacionAlmacenS3Test`, 16 casos entre ellos `reclamo-evidencia/`, `org-banner/`, `..`).
  4. El almacén de evidencia de reclamos (`EvidenciaAlmacen`) no se modificó: sigue limitado a `reclamo-evidencia/`.
  5. El job solo procesa hasta `EVIDENCIA_RETENCION_MAX` filas por corrida.
- Esquema: la columna nullable `archivo_eliminado_at` la crea `ddl-auto=update` al iniciar la nueva imagen. No hay script en `scripts/sql` porque `ddl-auto` sí agrega columnas nulas; ver `docs/db-changes.md`.

### Cómo activarla en la Pi (decisión de producción del autor)

Esto borra archivos del bucket de producción y no se puede deshacer: los objetos eliminados no vuelven (el versionado del bucket y la copia de evidencias de C5 todavía no están resueltos). Pasos sugeridos, todos a cargo del autor:

1. Respaldar el bucket de evidencias (o confirmar que existe una copia) antes de activar.
2. Contar candidatos con una consulta de solo lectura:
   `SELECT estado, count(*) FROM organizacion_evidencia WHERE object_key IS NOT NULL AND archivo_eliminado_at IS NULL AND (estado = 'REEMPLAZADA' OR (valido_hasta IS NOT NULL AND valido_hasta < CURRENT_DATE - INTERVAL '12 months')) GROUP BY estado;`
3. En el `.env` de la Pi, agregar `EVIDENCIA_RETENCION_ENABLED=true` y una primera corrida acotada, por ejemplo `EVIDENCIA_RETENCION_MAX=5`.
4. Recrear el servicio: `docker compose up -d ms`. Verificar en el log la advertencia de retención activada.
5. Tras la primera corrida (o ajustando `EVIDENCIA_RETENCION_CRON` para una prueba), revisar el resumen del log y los eventos `EVIDENCIA_ACREDITACION_ARCHIVO_BORRADO`; subir el máximo si el resultado es el esperado.
6. Para desactivarla: quitar la variable (o `false`) y recrear `ms`.

Decisión pendiente relacionada: D1 (vencimiento de evidencias a un año de la aprobación, con período de gracia sin definir). La retención borra archivos de evidencias vencidas hace N meses; conviene fijar D1 antes de activarla.

## 5. Lo que no se hace

- No hay análisis antivirus (no hay ClamAV ni equivalente). La defensa es la validación por firma, la recodificación de imágenes, el tipo de contenido fijado, `nosniff` y `attachment`. Un PDF con contenido activo se almacena y se entrega sin modificar.
- Las imágenes de evidencia de reclamos (`reclamo-evidencia/`) no se recodifican: conservan EXIF y GPS, y siguen aceptando WebP. Comparten la función de subida pero no la ruta de evidencia de acreditación.
- La recodificación descarta también el perfil de color ICC. Las imágenes se vuelven a comprimir (JPEG a calidad 90), de modo que el archivo almacenado no es idéntico al subido.
- El límite de 5 MB que muestra la interfaz de administración está fijo en el cliente; el valor efectivo lo decide el servidor con `UPLOAD_MAX_MB`.
- El carácter privado del bucket en Cloudflare sigue sin poder verificarse desde el repositorio (ver `docs/tfg/inventario.md`).

## 6. Compatibilidad con ARM64 (Raspberry Pi)

- `sharp` 0.35.5 trae binarios precompilados como dependencias opcionales por plataforma, incluidos `@img/sharp-linuxmusl-arm64` y `@img/sharp-libvips-linuxmusl-arm64` (Alpine usa musl). Ambos figuran con integridad en `ts_hornero_bff/package-lock.json`. No tiene script de instalación, por lo que `npm install --ignore-scripts` del `Dockerfile` no lo afecta. Requiere Node 20.9 o superior, y la imagen base es `node:20-alpine`.
- No se construyó la imagen para `linux/arm64` en esta tarea (no se ejecutó Docker). Lo anterior es una verificación por inspección de los paquetes y del lockfile; conviene confirmarlo con un `docker buildx build --platform linux/arm64` o con la primera construcción en la Pi.
