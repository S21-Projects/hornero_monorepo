package org.example.evidencia;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/** The application as it boots by default (no env vars) can delete no accreditation file. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class RetencionDesactivadaPorDefectoTest {

    @Autowired
    private ArchivoAcreditacionAlmacen almacen;
    @Autowired
    private EvidenciaAcreditacionRetencionJob job;

    @Test
    void theDefaultContextWiresTheNoOpStoreAndAJobThatDoesNothing() {
        assertThat(almacen).isInstanceOf(ArchivoAcreditacionAlmacenNoOp.class);
        assertThat(almacen).isNotInstanceOf(ArchivoAcreditacionAlmacenS3.class);
        assertThat(job.ejecutar()).isZero();
    }
}
