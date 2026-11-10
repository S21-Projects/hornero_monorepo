package org.example.auditoria;

import lombok.extern.slf4j.Slf4j;
import org.example.evidencia.EvidenciaAlmacenConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.services.s3.S3Client;

/**
 * Wires the store that publishes audit anchors. The S3 adapter, and the S3 client behind it, exist
 * only when {@code app.auditoria.ancla.habilitada} (env {@code AUDITORIA_ANCLA_ENABLED}) is true AND
 * the endpoint, bucket and both credentials are non-blank. In every other case the no-op store is
 * returned and no S3 client is built.
 *
 * <p>The flag is deliberately its own: not {@code EVIDENCIA_BORRADO_ENABLED} (on in production for
 * claim evidence) and not {@code EVIDENCIA_RETENCION_ENABLED}. Local stacks share the production
 * bucket, so writing there must be an explicit, separate, default-off decision.
 */
@Slf4j
@Configuration
public class AnclaAuditoriaConfig {

    /** Creates the S3 client; a seam so a test can prove it is never called when the flag is off. */
    @FunctionalInterface
    interface ClienteS3Factory {
        S3Client crear(String endpoint, String region, String accessKeyId, String secretAccessKey);
    }

    @Bean
    public AnclaAuditoriaAlmacen anclaAuditoriaAlmacen(
            @Value("${app.auditoria.ancla.habilitada:false}") boolean habilitada,
            @Value("${app.evidencia.s3.endpoint:}") String endpoint,
            @Value("${app.evidencia.s3.bucket:}") String bucket,
            @Value("${app.evidencia.s3.region:auto}") String region,
            @Value("${app.evidencia.s3.access-key-id:}") String accessKeyId,
            @Value("${app.evidencia.s3.secret-access-key:}") String secretAccessKey) {
        return crear(habilitada, endpoint, bucket, region, accessKeyId, secretAccessKey,
                EvidenciaAlmacenConfig::crearClienteS3);
    }

    AnclaAuditoriaAlmacen crear(boolean habilitada, String endpoint, String bucket, String region,
                                String accessKeyId, String secretAccessKey, ClienteS3Factory fabrica) {
        if (!habilitada) {
            log.info("[auditoria] anchor publishing disabled (AUDITORIA_ANCLA_ENABLED is not true): "
                    + "no bucket will be written");
            return new AnclaAuditoriaAlmacenNoOp();
        }
        if (endpoint.isBlank() || bucket.isBlank() || accessKeyId.isBlank() || secretAccessKey.isBlank()) {
            log.warn("[auditoria] anchor publishing enabled but object storage is not configured: nothing will be written");
            return new AnclaAuditoriaAlmacenNoOp();
        }
        log.warn("[auditoria] anchor publishing is ENABLED: the daily anchor is written under audit/anchors/ "
                + "in the configured bucket");
        return new AnclaAuditoriaAlmacenS3(fabrica.crear(endpoint, region, accessKeyId, secretAccessKey), bucket);
    }
}
