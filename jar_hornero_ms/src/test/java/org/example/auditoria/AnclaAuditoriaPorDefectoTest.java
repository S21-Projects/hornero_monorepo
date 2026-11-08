package org.example.auditoria;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/** The application as it boots by default (no env vars) cannot write an anchor to any bucket. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class AnclaAuditoriaPorDefectoTest {

    @Autowired private AnclaAuditoriaAlmacen almacen;

    @Test
    void theDefaultContextWiresTheNoOpStore() {
        assertThat(almacen).isInstanceOf(AnclaAuditoriaAlmacenNoOp.class);
        assertThat(almacen).isNotInstanceOf(AnclaAuditoriaAlmacenS3.class);
        assertThat(almacen.disponible()).isFalse();
    }
}
