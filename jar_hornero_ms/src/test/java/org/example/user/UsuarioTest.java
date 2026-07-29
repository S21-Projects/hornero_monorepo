package org.example.user;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the Java-side half of the grandfathering behavior (design decision
 * #2): every new row written through JPA starts unverified via the field
 * initializer, regardless of which constructor path is used. The other half
 * — the column's {@code default true} backfilling rows that existed before
 * this column was added — is a DDL-level guarantee exercised by
 * {@code ddl-auto=update} against the real schema; it is not something a
 * plain unit test can assert without a live Postgres instance, so it isn't
 * covered here.
 */
class UsuarioTest {

    @Test
    void newInstance_viaNoArgsConstructor_defaultsToUnverified() {
        Referente referente = new Referente();

        assertThat(referente.isEmailVerificado()).isFalse();
    }

    @Test
    void newInstance_viaExplicitConstructor_defaultsToUnverified() {
        Donante donante = new Donante(null, "Donante", "donante@test.com", "encoded", true);

        assertThat(donante.isEmailVerificado()).isFalse();
    }

    @Test
    void setEmailVerificado_true_isRespected() {
        Administrador admin = new Administrador();
        admin.setEmailVerificado(true);

        assertThat(admin.isEmailVerificado()).isTrue();
    }
}
