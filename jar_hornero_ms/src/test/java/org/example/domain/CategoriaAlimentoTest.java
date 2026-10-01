package org.example.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Feature catalogo-articulos, decision 5: the most-demanding categoria across a set wins, ordered
 * by {@link CategoriaAlimento#getNivelMinimo()}.
 */
class CategoriaAlimentoTest {

    @Test
    void masExigente_picksRefrigeradoOverNoPerecedero() {
        CategoriaAlimento resultado = CategoriaAlimento.masExigente(
                List.of(CategoriaAlimento.NO_PERECEDERO, CategoriaAlimento.REFRIGERADO));

        assertThat(resultado).isEqualTo(CategoriaAlimento.REFRIGERADO);
    }

    @Test
    void masExigente_picksCongeladoOverNoPerecedero() {
        CategoriaAlimento resultado = CategoriaAlimento.masExigente(
                List.of(CategoriaAlimento.NO_PERECEDERO, CategoriaAlimento.CONGELADO));

        assertThat(resultado).isEqualTo(CategoriaAlimento.CONGELADO);
    }

    @Test
    void masExigente_singleCategoria_returnsIt() {
        CategoriaAlimento resultado = CategoriaAlimento.masExigente(List.of(CategoriaAlimento.NO_PERECEDERO));

        assertThat(resultado).isEqualTo(CategoriaAlimento.NO_PERECEDERO);
    }

    @Test
    void masExigente_empty_throws() {
        assertThatThrownBy(() -> CategoriaAlimento.masExigente(List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
