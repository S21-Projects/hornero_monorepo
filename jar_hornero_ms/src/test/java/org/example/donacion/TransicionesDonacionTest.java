package org.example.donacion;

import org.example.domain.EstadoDonacion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * AD-5's single coordinated transition table. Slice 3a adds the delivery-code entries
 * ({@code ACEPTADA}/{@code EN_CAMINO} → {@code PENDIENTE_CONFIRMACION} → {@code ENTREGADA}) on top
 * of the pre-existing donation lifecycle. {@code overrideEstado} deliberately stays outside this
 * table (`DonacionService.overrideEstado` never calls it).
 */
class TransicionesDonacionTest {

    @ParameterizedTest
    @CsvSource({
            "OFRECIDA,ACEPTADA",
            "OFRECIDA,RECHAZADA",
            "OFRECIDA,CANCELADA",
            "ACEPTADA,EN_CAMINO",
            "ACEPTADA,CANCELADA",
            "ACEPTADA,PENDIENTE_CONFIRMACION",
            "EN_CAMINO,PENDIENTE_CONFIRMACION",
            "EN_CAMINO,CANCELADA",
            "PENDIENTE_CONFIRMACION,ENTREGADA",
    })
    void esValida_permittedPair_isTrue(EstadoDonacion desde, EstadoDonacion hacia) {
        assertThat(TransicionesDonacion.esValida(desde, hacia)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "OFRECIDA,EN_CAMINO",
            "OFRECIDA,PENDIENTE_CONFIRMACION",
            "OFRECIDA,ENTREGADA",
            "ACEPTADA,ACEPTADA",
            "ACEPTADA,RECHAZADA",
            "ACEPTADA,ENTREGADA",
            "EN_CAMINO,ACEPTADA",
            "EN_CAMINO,ENTREGADA",
            "PENDIENTE_CONFIRMACION,CANCELADA",
            "PENDIENTE_CONFIRMACION,OFRECIDA",
            "ENTREGADA,OFRECIDA",
            "RECHAZADA,OFRECIDA",
            "CANCELADA,OFRECIDA",
    })
    void esValida_rejectedPair_isFalse(EstadoDonacion desde, EstadoDonacion hacia) {
        assertThat(TransicionesDonacion.esValida(desde, hacia)).isFalse();
    }

    @Test
    void validar_permittedPair_doesNotThrow() {
        org.assertj.core.api.Assertions.assertThatCode(
                        () -> TransicionesDonacion.validar(EstadoDonacion.ACEPTADA, EstadoDonacion.PENDIENTE_CONFIRMACION))
                .doesNotThrowAnyException();
    }

    @Test
    void validar_rejectedPair_throws400() {
        assertThatThrownBy(() -> TransicionesDonacion.validar(EstadoDonacion.OFRECIDA, EstadoDonacion.ENTREGADA))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400");
    }
}
