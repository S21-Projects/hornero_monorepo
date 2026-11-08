package org.example.auditoria;

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.s3.S3Client;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Local stacks share the production bucket. No credentials, no other flag (EVIDENCIA_BORRADO_ENABLED,
 * EVIDENCIA_RETENCION_ENABLED) may be enough to build anything that writes to it.
 */
class AnclaAuditoriaConfigTest {

    private static final String ENDPOINT = "https://example.r2.cloudflarestorage.com";

    private final AnclaAuditoriaConfig config = new AnclaAuditoriaConfig();
    private final AtomicInteger clientesCreados = new AtomicInteger();
    private final AnclaAuditoriaConfig.ClienteS3Factory fabrica = (e, r, k, s) -> {
        clientesCreados.incrementAndGet();
        return mock(S3Client.class);
    };

    @Test
    void withTheFlagOffNoS3ClientIsEverBuilt_evenWithFullCredentials() {
        AnclaAuditoriaAlmacen almacen = config.crear(false, ENDPOINT, "hornero-images", "auto", "key", "secret", fabrica);

        assertThat(almacen).isInstanceOf(AnclaAuditoriaAlmacenNoOp.class);
        assertThat(almacen.disponible()).isFalse();
        assertThat(clientesCreados).hasValue(0);
    }

    @Test
    void enabledButIncompleteConfigurationAlsoBuildsNoClient() {
        assertThat(config.crear(true, "", "b", "auto", "k", "s", fabrica)).isInstanceOf(AnclaAuditoriaAlmacenNoOp.class);
        assertThat(config.crear(true, ENDPOINT, "", "auto", "k", "s", fabrica)).isInstanceOf(AnclaAuditoriaAlmacenNoOp.class);
        assertThat(config.crear(true, ENDPOINT, "b", "auto", "", "s", fabrica)).isInstanceOf(AnclaAuditoriaAlmacenNoOp.class);
        assertThat(config.crear(true, ENDPOINT, "b", "auto", "k", "", fabrica)).isInstanceOf(AnclaAuditoriaAlmacenNoOp.class);
        assertThat(clientesCreados).hasValue(0);
    }

    @Test
    void buildsTheS3StoreOnlyWhenEnabledAndFullyConfigured() {
        AnclaAuditoriaAlmacen almacen = config.crear(true, ENDPOINT, "hornero-images", "auto", "key", "secret", fabrica);

        assertThat(almacen).isInstanceOf(AnclaAuditoriaAlmacenS3.class);
        assertThat(clientesCreados).hasValue(1);
    }

    @Test
    void noOpPublishesNothing() {
        assertThat(new AnclaAuditoriaAlmacenNoOp().publicar(java.time.LocalDate.now(), "x")).isFalse();
    }
}
