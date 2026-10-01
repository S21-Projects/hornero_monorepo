package org.example.domain;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Repository slice tests for the {@code articulos} catalog (feature catalogo-articulos, work
 * unit A / C1).
 */
@DataJpaTest
class ArticuloRepositoryTest {

    @Autowired
    private ArticuloRepository articuloRepository;

    private Articulo articulo(String nombre, CategoriaAlimento categoria, UnidadArticulo unidad, boolean activo) {
        Articulo a = new Articulo();
        a.setNombre(nombre);
        a.setCategoria(categoria);
        a.setUnidad(unidad);
        a.setActivo(activo);
        return a;
    }

    @Test
    void save_persistsAndFindByIdReturnsIt() {
        Articulo saved = articuloRepository.save(
                articulo("Arroz", CategoriaAlimento.NO_PERECEDERO, UnidadArticulo.KG, true));

        Articulo found = articuloRepository.findById(saved.getId()).orElseThrow();

        assertThat(found.getNombre()).isEqualTo("Arroz");
        assertThat(found.getCategoria()).isEqualTo(CategoriaAlimento.NO_PERECEDERO);
        assertThat(found.getUnidad()).isEqualTo(UnidadArticulo.KG);
        assertThat(found.isActivo()).isTrue();
    }

    @Test
    void activo_defaultsToTrue_whenNotExplicitlySet() {
        Articulo a = new Articulo();
        a.setNombre("Fideos");
        a.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        a.setUnidad(UnidadArticulo.PAQUETE);

        Articulo saved = articuloRepository.save(a);

        assertThat(saved.isActivo()).isTrue();
    }

    @Test
    void findByActivoTrue_excludesDeactivatedArticulos() {
        articuloRepository.save(articulo("Leche", CategoriaAlimento.REFRIGERADO, UnidadArticulo.LITRO, true));
        articuloRepository.save(articulo("Queso viejo", CategoriaAlimento.REFRIGERADO, UnidadArticulo.KG, false));

        List<Articulo> activos = articuloRepository.findByActivoTrue();

        assertThat(activos).extracting(Articulo::getNombre).containsExactly("Leche");
    }
}
