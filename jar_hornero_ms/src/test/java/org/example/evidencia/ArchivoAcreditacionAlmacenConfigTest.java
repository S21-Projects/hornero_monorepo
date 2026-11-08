package org.example.evidencia;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Local stacks share the production bucket. Credentials alone, and even the claim-evidence
 * deletion flag, must never be enough to build a store that can delete accreditation files.
 */
class ArchivoAcreditacionAlmacenConfigTest {

    private final ArchivoAcreditacionAlmacenConfig config = new ArchivoAcreditacionAlmacenConfig();
    private static final String ENDPOINT = "https://example.r2.cloudflarestorage.com";

    @Test
    void usesNoOpStoreWhenRetentionIsNotEnabledEvenWithFullCredentials() {
        ArchivoAcreditacionAlmacen almacen = config.archivoAcreditacionAlmacen(
                false, ENDPOINT, "hornero-images", "auto", "key", "secret");

        assertThat(almacen).isInstanceOf(ArchivoAcreditacionAlmacenNoOp.class);
        assertThat(almacen.disponible()).isFalse();
    }

    @Test
    void usesNoOpStoreWhenEnabledButCredentialsAreMissing() {
        assertThat(config.archivoAcreditacionAlmacen(true, "", "hornero-images", "auto", "key", "secret"))
                .isInstanceOf(ArchivoAcreditacionAlmacenNoOp.class);
        assertThat(config.archivoAcreditacionAlmacen(true, ENDPOINT, "", "auto", "key", "secret"))
                .isInstanceOf(ArchivoAcreditacionAlmacenNoOp.class);
        assertThat(config.archivoAcreditacionAlmacen(true, ENDPOINT, "hornero-images", "auto", "", "secret"))
                .isInstanceOf(ArchivoAcreditacionAlmacenNoOp.class);
        assertThat(config.archivoAcreditacionAlmacen(true, ENDPOINT, "hornero-images", "auto", "key", ""))
                .isInstanceOf(ArchivoAcreditacionAlmacenNoOp.class);
    }

    @Test
    void buildsTheS3StoreOnlyWhenEnabledAndFullyConfigured() throws Exception {
        ArchivoAcreditacionAlmacen almacen = config.archivoAcreditacionAlmacen(
                true, ENDPOINT, "hornero-images", "auto", "key", "secret");

        assertThat(almacen).isInstanceOf(ArchivoAcreditacionAlmacenS3.class);
        ((AutoCloseable) almacen).close();
    }

    @Test
    void noOpStoreDeletesNothing() {
        assertThat(new ArchivoAcreditacionAlmacenNoOp().borrar("org-evidencia/1/a.jpg")).isFalse();
    }
}
