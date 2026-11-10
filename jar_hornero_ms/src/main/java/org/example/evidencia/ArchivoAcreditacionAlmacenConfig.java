package org.example.evidencia;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the store that can delete accreditation evidence files. The S3 adapter (and the S3 client
 * behind it) is only built when {@code app.evidencia.retencion.habilitada} is true AND the endpoint,
 * bucket and both credentials are non-blank; in every other case the no-op store is returned and no
 * S3 client exists at all.
 *
 * <p>The flag is deliberately NOT {@code app.evidencia.borrado-habilitado}: that one is already true
 * on the Raspberry Pi to delete claim evidence, so reusing it would switch on deletion of
 * accreditation files as a side effect. Local stacks share the production bucket, so this one is
 * opt-in, defaults to false, and is separate from the claim flag.
 */
@Slf4j
@Configuration
public class ArchivoAcreditacionAlmacenConfig {

    @Bean
    public ArchivoAcreditacionAlmacen archivoAcreditacionAlmacen(
            @Value("${app.evidencia.retencion.habilitada:false}") boolean retencionHabilitada,
            @Value("${app.evidencia.s3.endpoint:}") String endpoint,
            @Value("${app.evidencia.s3.bucket:}") String bucket,
            @Value("${app.evidencia.s3.region:auto}") String region,
            @Value("${app.evidencia.s3.access-key-id:}") String accessKeyId,
            @Value("${app.evidencia.s3.secret-access-key:}") String secretAccessKey) {
        if (!retencionHabilitada) {
            log.info("[evidencia] accreditation file retention disabled (EVIDENCIA_RETENCION_ENABLED is not true)");
            return new ArchivoAcreditacionAlmacenNoOp();
        }
        if (endpoint.isBlank() || bucket.isBlank() || accessKeyId.isBlank() || secretAccessKey.isBlank()) {
            log.warn("[evidencia] retention enabled but object storage is not configured: nothing will be deleted");
            return new ArchivoAcreditacionAlmacenNoOp();
        }
        log.warn("[evidencia] accreditation file retention is ENABLED: expired and replaced evidence files "
                + "will be deleted from the bucket");
        return new ArchivoAcreditacionAlmacenS3(
                EvidenciaAlmacenConfig.crearClienteS3(endpoint, region, accessKeyId, secretAccessKey), bucket);
    }
}
