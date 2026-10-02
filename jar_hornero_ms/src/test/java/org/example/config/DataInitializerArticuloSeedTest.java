package org.example.config;

import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Feature catalogo-articulos, work unit A/I: {@code DataInitializer} must seed the initial
 * catalog idempotently at startup, covering all three {@code CategoriaAlimento} values, and every
 * seeded necesidad/donación must carry articulos/líneas coherent with the new catalog (decision
 * 1: seeded data is not real, so it must not model obsolete pre-catalog shapes).
 *
 * <p>{@code @Transactional} keeps a Hibernate session open across each test method so the
 * lazily-loaded {@code articulos}/{@code lineas} collections can be read without a separate
 * fetch-join query.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class DataInitializerArticuloSeedTest {

    @Autowired
    private ArticuloRepository articuloRepository;

    @Autowired
    private NecesidadRepository necesidadRepository;

    @Autowired
    private DonacionRepository donacionRepository;

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

    @Test
    void everySeededNecesidad_hasAtLeastOneArticulo_andADerivedCategoria() {
        List<Necesidad> necesidades = necesidadRepository.findAll();

        assertThat(necesidades).isNotEmpty();
        assertThat(necesidades).allSatisfy(n -> {
            assertThat(n.getArticulos()).as("necesidad %d articulos", n.getId()).isNotEmpty();
            assertThat(n.getCategoria()).as("necesidad %d categoria", n.getId()).isNotNull();
        });
    }

    @Test
    void everySeededDonacion_hasAtLeastOneLinea_andADerivedCategoria() {
        List<Donacion> donaciones = donacionRepository.findAll();

        assertThat(donaciones).isNotEmpty();
        assertThat(donaciones).allSatisfy(d -> {
            assertThat(d.getLineas()).as("donacion %d lineas", d.getId()).isNotEmpty();
            assertThat(d.getCategoria()).as("donacion %d categoria", d.getId()).isNotNull();
        });
    }
}
