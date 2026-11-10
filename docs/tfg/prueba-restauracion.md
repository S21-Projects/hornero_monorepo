# Prueba de restauración (plantilla)

> **ESTADO: NO EJECUTADA CONTRA PRODUCCIÓN.** Este documento es una plantilla con el procedimiento exacto y la tabla de resultados vacía. Nadie ha restaurado un respaldo real de producción: los pasos de las secciones 2 a 5 los debe ejecutar el autor en la Raspberry Pi. No se completó ningún resultado.

Alcance: restaurar el último respaldo cifrado en un contenedor PostgreSQL aislado y descartable, medir la duración, comparar los conteos de filas con los de producción y verificar la cadena de hashes de auditoría. Nunca se conecta a la base real.

## 1. Requisitos

- Acceso a la Pi con un usuario del grupo `docker`, en la copia del repositorio que ya tiene `scripts/backup/` actualizado.
- `BACKUP_PASSPHRASE` disponible (se guarda fuera de la Pi; ver sección C.3 del documento de despliegue).
- La imagen del microservicio de la Pi (para la verificación de la cadena): `docker compose --env-file .env images ms`. El verificador corre con esa imagen contra la base descartable, sin credenciales de ningún bucket, de modo que no puede tocar el almacenamiento. Usa memoria (una JVM adicional): hacerlo en un momento de poca carga.

## 2. Tomar el respaldo y los conteos de producción

El orden importa: los conteos esperados son los de producción en el momento del respaldo. Si hay escrituras entre ambos pasos, los conteos pueden diferir sin que el respaldo esté mal; para una comparación exacta, detener `ms` unos segundos (`docker compose stop ms`) y reanudarlo (`docker compose start ms`) al terminar este paso.

```bash
cd /ruta/al/repositorio
scripts/backup/backup.sh            # respaldo real: anotar el nombre del archivo que informa
for t in usuarios organizaciones necesidades donaciones refresh_tokens organizacion_evidencia organizacion_evento asignaciones rondas; do
  n="$(docker compose --env-file .env exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAX -c 'select count(*) from $t'")"
  echo "$t=$n"
done > /tmp/conteos-esperados.txt
cat /tmp/conteos-esperados.txt
```

## 3. Medir el tamaño del dump cifrado

El tamaño que importa para la tabla de costos de R2 es el del archivo **cifrado**, que es el que se sube. Dos formas:

1. Local, sin subir: `scripts/backup/backup.sh --no-upload` (con `BACKUP_S3_BUCKET` configurado) deja `backups/hornero-<fecha>.dump.enc`; medirlo con `wc -c backups/hornero-<fecha>.dump.enc` (bytes). El cifrado agrega unos pocos bytes de encabezado y relleno, y el tamaño no depende de la sal aleatoria.
2. En el bucket, ya subido: listar el prefijo con la imagen de AWS CLI, pasando las credenciales por nombre:

```bash
set -a; . ./.env; set +a      # solo en la Pi, el .env tiene permisos 600
AWS_ACCESS_KEY_ID="$BACKUP_AWS_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_AWS_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto \
  docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION \
  amazon/aws-cli:2.27.50 s3 ls "s3://$BACKUP_S3_BUCKET/hornero/daily/" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" --human-readable --summarize
```

El almacenamiento en régimen es 17 copias (7 + 4 + 6) por este tamaño (`docs/tfg/seguridad-c5.md`, sección 3.5).

## 4. Ejecutar el simulacro

Con el archivo cifrado (descargado del bucket o el local de la sección 3) y los conteos de la sección 2:

```bash
IMG="$(docker compose --env-file .env images ms | awk 'NR==2{print $2":"$3}')"
BACKUP_PASSPHRASE='...' scripts/backup/restore-check.sh backups/hornero-<fecha>.dump.enc \
  --expect-file /tmp/conteos-esperados.txt --ms-image "$IMG" | tee /tmp/simulacro.txt
```

Qué hace el script: restaura en un PostgreSQL descartable de la misma imagen que el compose, mide la duración de `pg_restore`, compara cada conteo con el esperado (una diferencia da `FAILED`), revisa en SQL, sin calcular hashes, que cada evento sellado enlace con el anterior de su organización y, con `--ms-image`, arranca el microservicio contra la base restaurada y lee el resultado de la verificación que el propio `VerificadorCadena` ejecuta al iniciar. El hash canónico no se reimplementó en el script. Al final borra los contenedores y la red.

La salida termina con una fila Markdown lista para pegar en la tabla de la sección 5. La duración que informa es solo la de `pg_restore`; el tiempo total incluye el descifrado y el arranque del microservicio, que se puede medir con `time` alrededor del comando.

Interpretación:

- `RESULT: OK` y código de salida 0: restauración correcta, conteos iguales, cadena íntegra.
- Cadena `ROTA`: el verificador encontró un evento alterado; la restauración no es confiable hasta compararla con las anclas publicadas (`docs/tfg/seguridad-c4.md`).
- Un arranque del microservicio sobre una base anterior a la cadena de hashes sella primero los eventos heredados y luego verifica, por lo que en ese caso "íntegra" solo significa "consistente desde el relleno".

## 5. Resultados

| Fecha (UTC) | Archivo | Tamaño (bytes) | Duración (s) | Conteos restaurado/esperado | Cadena de hashes | Resultado |
|---|---|---|---|---|---|---|
| 2026-11-09 20:50 | hornero-20261109T205038Z.dump.enc | 549680 (dump sin cifrar: 549657) | respaldo 1; restauración <1 (`pg_restore`); total 10 | 9/9 tablas controladas iguales | dump anterior a la cadena; verificador OK (2734 eventos en 2731 cadenas, 0 pendientes de sellar) | `RESULT: OK` (código de salida 0) |

Datos de la ejecución del 2026-11-09:

- Ejecutó: el autor (Luciano), en su equipo de desarrollo.
- Entorno: local (`.env.local`, datos de demostración), no producción. Valida el procedimiento, no el estado de la base de la Raspberry Pi; queda pendiente repetirlo allí.
- Respaldo: `backup.sh --no-upload` con un bucket ficticio y una passphrase aleatoria descartable, solo para ejercitar el cifrado. No se subió nada.
- Imágenes: `postgres:16-alpine` (servidor 16.15) y `hornero-tfg-ms:latest` para el verificador.
- `ms`: no estaba en ejecución (solo se levantó `postgres` con `--no-deps`), por lo que los conteos no cambiaron entre el respaldo y la verificación.
- Cadena: la base de origen es anterior a la cadena de hashes, así que el resultado significa "consistente desde el relleno", no integridad histórica (ver sección 4).
- Los archivos de la prueba (volcado, copia cifrada, passphrase) se eliminaron después de registrar el resultado.

## 6. Prueba del procedimiento en un entorno local (no es un resultado)

Para comprobar que el script funciona se corrió contra una base PostgreSQL 16 descartable en el equipo de desarrollo, con los datos de demostración que genera el propio microservicio (6 usuarios, 3 organizaciones, 3 eventos). No es un respaldo de producción y no debe confundirse con la tabla de la sección 5. Resultados observados el 2026-11-08:

| Caso | Resultado |
|---|---|
| Dump cifrado, conteos esperados correctos, verificador real | `RESULT: OK`, cadena verificada (3 eventos en 3 cadenas) |
| Un evento alterado a mano antes del dump | `RESULT: FAILED`, cadena `ROTA` (primer evento roto id=1, motivo CONTENIDO); los enlaces SQL no lo detectan, el verificador sí |
| Conteo esperado distinto del restaurado | `RESULT: FAILED`, marcado como `MISMATCH` |
| Sin `--ms-image` ni conteos | `RESULT: OK` con advertencia; cadena marcada "no ejecutada" |
