package org.example.config;

import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Feature catalogo-articulos, work unit A: {@code DataInitializer} must seed the initial catalog
 * idempotently at startup, covering all three {@code CategoriaAlimento} values.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class DataInitializerArticuloSeedTest {

    @Autowired
    private ArticuloRepository articuloRepository;

    @Autowired
    private DataInitializer dataInitializer;

    @Test
    void seedsArticulosCoveringEveryCategoria() {
        List<CategoriaAlimento> categorias = articuloRepository.findAll().stream()
                .map(org.example.domain.Articulo::getCategoria)
                .toList();

        assertThat(Set.copyOf(categorias)).containsExactlyInAnyOrder(
                CategoriaAlimento.NO_PERECEDERO, CategoriaAlimento.REFRIGERADO, CategoriaAlimento.CONGELADO);
    }

    @Test
    void seedingTwice_isIdempotent_doesNotDuplicateRows() {
        long before = articuloRepository.count();

        dataInitializer.init();

        assertThat(articuloRepository.count()).isEqualTo(before);
    }
}
