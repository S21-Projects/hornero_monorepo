package org.example.evidencia;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;
import java.util.concurrent.Executor;

/**
 * Wires the claim evidence store. The S3 adapter exists only when deletion is explicitly enabled
 * ({@code app.evidencia.borrado-habilitado}, opt-in) and the endpoint, bucket and both credentials are
 * all non-blank; otherwise the no-op adapter is used (one startup warning), so the MS and every test
 * boot without object storage. Opt-in because local stacks use the production bucket: credentials
 * alone must never allow a local MS to delete production objects. A factory method is used instead
 * of {@code @ConditionalOnProperty} because compose passes empty strings, and an empty property
 * still counts as present.
 */
@Slf4j
@Configuration
public class EvidenciaAlmacenConfig {

    @Bean
    public EvidenciaAlmacen evidenciaAlmacen(
            @Value("${app.evidencia.borrado-habilitado:false}") boolean borradoHabilitado,
            @Value("${app.evidencia.s3.endpoint:}") String endpoint,
            @Value("${app.evidencia.s3.bucket:}") String bucket,
            @Value("${app.evidencia.s3.region:auto}") String region,
            @Value("${app.evidencia.s3.access-key-id:}") String accessKeyId,
            @Value("${app.evidencia.s3.secret-access-key:}") String secretAccessKey) {
        if (!borradoHabilitado) {
            log.warn("[evidencia] deletion disabled (EVIDENCIA_BORRADO_ENABLED is not true): "
                    + "claim evidence will not be deleted");
            return new EvidenciaAlmacenNoOp();
        }
        if (endpoint.isBlank() || bucket.isBlank() || accessKeyId.isBlank() || secretAccessKey.isBlank()) {
            log.warn("[evidencia] object storage not configured: claim evidence will not be deleted");
            return new EvidenciaAlmacenNoOp();
        }
        S3Client s3 = crearClienteS3(endpoint, region, accessKeyId, secretAccessKey);
        return new EvidenciaAlmacenS3(s3, bucket);
    }

    /** Shared by every store adapter, so the S3-compatible quirks are handled in one place. */
    static S3Client crearClienteS3(String endpoint, String region, String accessKeyId, String secretAccessKey) {
        return S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(region.isBlank() ? "auto" : region))
                .forcePathStyle(true)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKeyId, secretAccessKey)))
                .httpClient(UrlConnectionHttpClient.create())
                // SDK 2.30+ adds integrity checksums to optional operations, which some
                // S3-compatible providers reject; DeleteObjects still sends the one it requires.
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
    }

    /** One daemon thread and a short queue: evidence deletion is rare and must never block a request. */
    @Bean(name = "evidenciaExecutor", destroyMethod = "shutdown")
    public Executor evidenciaExecutor(@Value("${app.evidencia.async:true}") boolean async) {
        if (!async) {
            return new SameThreadExecutor();
        }
        ThreadPoolTaskExecutor pool = new ThreadPoolTaskExecutor();
        pool.setCorePoolSize(1);
        pool.setMaxPoolSize(1);
        pool.setQueueCapacity(50);
        pool.setDaemon(true);
        pool.setThreadNamePrefix("evidencia-");
        // Spring initializes the pool after the bean is returned (InitializingBean).
        return pool;
    }

    /** Runs the task on the caller's thread (tests). */
    static final class SameThreadExecutor implements Executor {
        @Override
        public void execute(Runnable command) {
            command.run();
        }

        @SuppressWarnings("unused")
        public void shutdown() {
            // nothing to release
        }
    }
}
