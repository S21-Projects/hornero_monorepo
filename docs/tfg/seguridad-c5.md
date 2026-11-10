# Respaldo y copia de evidencias (C5)

Estado del código en la rama `tfg/entrega-4`. Este documento describe lo que se hizo en el repositorio. **Nada de esto se aplicó a producción**: no se tocó la Raspberry Pi, ningún bucket ni el panel de Cloudflare. Los pasos que quedan a cargo del autor figuran en la sección 5.

## 1. Lo que ya existía

| Elemento | Dónde |
|---|---|
| `pg_dump -Fc` diario, verificación del archivo, copia cifrada opcional (`BACKUP_S3_BUCKET`), poda local por `BACKUP_RETENTION_DAYS` | `scripts/backup/backup.sh` |
| Cifrado AES-256-CBC con PBKDF2 (600 000 iteraciones) | `scripts/backup/common.sh` (`encrypt_file`, `decrypt_file`) |
| Simulacro de restauración en un PostgreSQL descartable, con conteo de filas de las tablas principales | `scripts/backup/restore-check.sh` (versión anterior) |
| Temporizador diario 03:15 | `deploy/systemd/hornero-backup.{service,timer}` |
| Retención remota: una única regla por antigüedad (30 días, decisión D11) descrita en el documento de despliegue, no aplicada por código | `docs/deploy-rpi-cloudflare.md`, sección C.3 |

## 2. Lo que dice la documentación de Cloudflare R2

Consulta realizada el 2026-11-08 a la documentación oficial.

| Pregunta | Respuesta | Fuente |
|---|---|---|
| ¿Hay reglas de ciclo de vida con filtro por prefijo y borrado después de N días? | Sí. "When you create an object lifecycle rule, you can specify which prefix you would like it to apply to"; el ejemplo usa `Expiration: { Days: 90 }`. Máximo de 1000 reglas. | https://developers.cloudflare.com/r2/buckets/object-lifecycles/ |
| ¿Desde cuándo se cuenta la antigüedad? | La página no lo dice de forma explícita. Indica que los objetos se eliminan normalmente dentro de las 24 horas posteriores al vencimiento, de modo que los plazos son aproximados. | misma página |
| ¿Hay versionado de objetos? | No. `PutBucketVersioning` y `GetBucketVersioning` figuran como operaciones no implementadas. | https://developers.cloudflare.com/r2/api/s3/api/ |
| ¿Hay replicación entre buckets? | No. `PutBucketReplication` y `GetBucketReplication` figuran como no implementadas. | misma página |
| ¿`CopyObject` está implementado? | Sí. | misma página |
| ¿Hay alguna protección contra el borrado? | Existen "bucket locks": impiden borrar o sobrescribir objetos durante un período o indefinidamente, por prefijo, y tienen precedencia sobre las reglas de ciclo de vida. No se usaron (ver 4.2). | https://developers.cloudflare.com/r2/buckets/bucket-locks/ |

Limitación de la consulta: se leyó la documentación pública; no se verificó el comportamiento real del plan del autor ni se aplicó ninguna regla.

## 3. Retención 7 diarias, 4 semanales, 6 mensuales

### 3.1 Por qué por prefijo

Una regla de ciclo de vida solo filtra por prefijo y antigüedad. Con un único prefijo no se puede expresar "conservar 7 diarias, 4 semanales y 6 mensuales", porque una copia semanal y una diaria tienen la misma antigüedad y el mismo prefijo. Por eso `backup.sh` sube a prefijos distintos y el vencimiento lo resuelve R2.

### 3.2 Qué hace `backup.sh`

Con `BACKUP_S3_BUCKET` configurado (sin cambios: sigue siendo opcional, cifrado y con la negativa a usar el bucket de imágenes), cada ejecución sube el archivo cifrado a:

| Prefijo | Cuándo | Variable |
|---|---|---|
| `<BACKUP_S3_PREFIX>daily/` | Siempre | |
| `<BACKUP_S3_PREFIX>weekly/` | El día ISO de `BACKUP_WEEKLY_DAY` (1 = lunes ... 7 = domingo, por defecto 7) | `BACKUP_WEEKLY_DAY` |
| `<BACKUP_S3_PREFIX>monthly/` | El día 01 del mes | |

El día se calcula en UTC, el mismo reloj que el nombre del archivo. Cada copia es una subida independiente del mismo archivo cifrado. Si `BACKUP_S3_PREFIX` no termina en `/`, se agrega. `--no-upload` muestra las claves que usaría sin subir nada. **Ningún código borra de un bucket**: lo único que se elimina son archivos locales (`BACKUP_RETENTION_DAYS`, sin cambios).

Compatibilidad: `restore-check.sh` recibe un archivo local, de modo que descargar de cualquiera de los tres prefijos funciona igual que antes. Los objetos subidos antes de este cambio están directamente bajo `hornero/` (ver 3.4).

### 3.3 Reglas que debe crear el autor en Cloudflare (NO aplicadas)

Bucket de respaldos (privado, distinto del de imágenes) → Settings → Object lifecycle rules. Tres reglas de eliminación:

| Regla | Prefijo | Eliminar objetos después de | Copias que quedan |
|---|---|---|---|
| diarias | `hornero/daily/` | 7 días | 7 |
| semanales | `hornero/weekly/` | 28 días | 4 |
| mensuales | `hornero/monthly/` | 186 días (6 x 31) | 6 |

Los plazos son aproximados: R2 elimina "típicamente dentro de las 24 horas" posteriores al vencimiento, de modo que puede haber transitoriamente una copia más. **No crear la regla única de 30 días sobre `hornero/`** que describía la versión anterior de la sección C.3: borraría las copias semanales y mensuales. Esta retención reemplaza el valor de 30 días de la decisión D11.

### 3.4 Objetos anteriores a este cambio

Si ya se hubiera subido algún archivo con la versión anterior, quedó como `hornero/hornero-<fecha>.dump.enc`, sin prefijo de nivel y fuera de las tres reglas. Si existen, agregar una regla temporal con prefijo `hornero/hornero-` (no coincide con `hornero/daily/...`) o borrarlos a mano.

### 3.5 Tamaño de almacenamiento

El almacenamiento en régimen es 17 copias (7 + 4 + 6) por el tamaño de un dump cifrado. El tamaño del dump cifrado real no se midió (no se accedió a producción); el procedimiento para medirlo está en `docs/tfg/prueba-restauracion.md`.

## 4. Copia de las evidencias

### 4.1 Versionado

R2 no ofrece versionado ni replicación (sección 2). Por lo tanto la opción "activar el versionado del bucket" no existe y se entrega la alternativa pedida.

### 4.2 `scripts/backup/evidence-copy.sh`

Copia aditiva de los prefijos privados `org-evidencia/` y `reclamo-evidencia/` del bucket de origen a un segundo bucket (por defecto bajo `evidencia-copia/`). Propiedades verificadas con un `rclone` simulado (no se ejecutó contra ningún bucket):

| Propiedad | Detalle |
|---|---|
| Desactivado por defecto | No hace nada salvo con `EVIDENCE_COPY_ENABLED=true` y todas las variables `EVIDENCE_COPY_*` presentes |
| Nunca borra | Usa `rclone copy` (no `sync` ni `move`) con `--immutable`: no elimina nada en origen ni en destino y se niega a sobrescribir un objeto de destino cuyo origen cambió |
| Solo evidencia privada | Rechaza cualquier prefijo distinto de los dos permitidos; nunca copia las imágenes públicas |
| Segundo bucket | Se niega si origen y destino son el mismo bucket |
| Credenciales | Por variables de entorno `RCLONE_CONFIG_*`, no por argumentos ni archivo de configuración. El token de origen solo necesita lectura |
| `--dry-run` | Lista qué copiaría y no copia |

Temporizador: `deploy/systemd/hornero-evidence-copy.service` y `.timer`. El `.timer` está **entero comentado** (domingos 04:30) y nadie lo instala; no se ejecutó.

Consecuencia que el autor debe decidir: la copia conserva objetos que la aplicación borra en el origen (retención de evidencia, anonimización de un usuario). Si se activa, el segundo bucket necesita su propia regla de ciclo de vida (por ejemplo, 90 días sobre `evidencia-copia/`) para no conservar indefinidamente datos que la política manda eliminar. Los bucket locks no se usaron porque impedirían ese vencimiento.

## 5. Qué debe hacer el autor

En el panel de Cloudflare:

1. Crear el bucket privado de respaldos y su token solo de ese bucket (sección C.3 del documento de despliegue), si no existe.
2. Crear las tres reglas de la sección 3.3 y no crear la de 30 días.
3. Si se activa la copia de evidencias: crear el segundo bucket, un token de solo lectura para el origen, otro de escritura para el destino y la regla de vencimiento del destino. Comprobar además que el bucket de imágenes no tenga acceso público directo (advertencia ya reportada en C3 y C4).

En la Raspberry Pi:

1. Actualizar el repositorio y, en el `.env`, completar `BACKUP_*` (la variable nueva es opcional: `BACKUP_WEEKLY_DAY`).
2. Reinstalar o recargar la unidad si se modificó (`systemctl daemon-reload`); la unidad `hornero-backup` no cambió.
3. Correr una vez `scripts/backup/backup.sh --no-upload` y revisar las claves que informa; luego una corrida real y comprobar los prefijos en el bucket.
4. Ejecutar el simulacro de restauración según `docs/tfg/prueba-restauracion.md` y completar la tabla.
5. Solo si se decide la copia de evidencias: configurar `EVIDENCE_COPY_*`, probar con `--dry-run` y habilitar el temporizador.

## 6. Pruebas realizadas

Todas locales, sin acceso a producción ni a ningún bucket real.

| Qué | Cómo | Resultado |
|---|---|---|
| Niveles de retención por fecha | `retention_tiers` con cinco combinaciones de día de semana, día del mes y día semanal | Correcto (diaria siempre; semanal el día elegido; mensual el día 01) |
| Subida por prefijos | `backup.sh` completo con un `docker` simulado que registra las llamadas (domingo: `daily/` y `weekly/`) | Dos subidas a las claves esperadas |
| Validaciones | `BACKUP_WEEKLY_DAY=9`, prefijo sin barra, `--no-upload` | Rechazo; barra agregada; claves informadas sin subir |
| Copia de evidencias | `rclone` simulado: desactivado, `--dry-run`, mismo bucket, prefijo no permitido | Comportamiento esperado en los cuatro casos |
| Simulacro con cadena de hashes | Ver `docs/tfg/prueba-restauracion.md`, sección 6 | Detecta un evento alterado |
