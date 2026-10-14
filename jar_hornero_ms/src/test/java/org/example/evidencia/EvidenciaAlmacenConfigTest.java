package org.example.evidencia;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EvidenciaAlmacenConfigTest {

    private final EvidenciaAlmacenConfig config = new EvidenciaAlmacenConfig();

    @Test
    void usesNoOpStoreUnlessDeletionIsExplicitlyEnabledEvenWithFullCredentials() {
        // Local stacks share the production bucket: credentials alone must never enable deletion.
        EvidenciaAlmacen almacen = config.evidenciaAlmacen(
                false, "https://example.r2.cloudflarestorage.com", "hornero-images", "auto", "key", "secret");

        assertThat(almacen).isInstanceOf(EvidenciaAlmacenNoOp.class);
    }
}
