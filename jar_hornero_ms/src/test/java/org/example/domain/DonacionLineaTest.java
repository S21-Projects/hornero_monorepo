package org.example.domain;

import org.example.user.Donante;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Feature catalogo-articulos, C4: {@code DonacionLinea} cascades with its owning {@code Donacion}
 * (save and orphan removal), mirroring the existing {@code Necesidad.donaciones} convention.
 */
@DataJpaTest
class DonacionLineaTest {

    @Autowired
    private DonacionRepository donacionRepository;

    @Autowired
    private ArticuloRepository articuloRepository;

    @Autowired
    private org.example.user.UsuarioRepository usuarioRepository;

    private Articulo articulo(String nombre) {
        Articulo a = new Articulo();
        a.setNombre(nombre);
        a.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        a.setUnidad(UnidadArticulo.KG);
        a.setActivo(true);
        return articuloRepository.save(a);
    }

    private Donante donante() {
        Donante d = new Donante();
        d.setNombre("Donante Test");
        d.setEmail("donante.test@test.com");
        d.setPassword("hash");
        d.setActivo(true);
        return (Donante) usuarioRepository.save(d);
    }

    @Test
    void save_cascadesLineasWithTheDonacion() {
        Articulo arroz = articulo("Arroz");
        Donacion d = new Donacion();
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setFechaOferta(LocalDate.now());
        d.setDonante(donante());
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        d.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        d.setLatitud(-34.6);
        d.setLongitud(-58.4);

        DonacionLinea linea = new DonacionLinea();
        linea.setArticulo(arroz);
        linea.setCantidad(new BigDecimal("3.5"));
        linea.setDonacion(d);
        d.setLineas(new java.util.ArrayList<>(List.of(linea)));

        Donacion saved = donacionRepository.save(d);

        assertThat(saved.getLineas()).hasSize(1);
        assertThat(saved.getLineas().get(0).getId()).isNotNull();
        assertThat(saved.getLineas().get(0).getCantidad()).isEqualByComparingTo("3.5");
    }

    @Test
    void removingALinea_orphanRemoval_deletesItOnFlush() {
        Articulo arroz = articulo("Arroz");
        Donacion d = new Donacion();
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setFechaOferta(LocalDate.now());
        d.setDonante(donante());
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        d.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        d.setLatitud(-34.6);
        d.setLongitud(-58.4);

        DonacionLinea linea = new DonacionLinea();
        linea.setArticulo(arroz);
        linea.setCantidad(BigDecimal.ONE);
        linea.setDonacion(d);
        d.setLineas(new java.util.ArrayList<>(List.of(linea)));
        Donacion saved = donacionRepository.saveAndFlush(d);
        Long donacionId = saved.getId();

        saved.getLineas().clear();
        donacionRepository.saveAndFlush(saved);

        Donacion reloaded = donacionRepository.findById(donacionId).orElseThrow();
        assertThat(reloaded.getLineas()).isEmpty();
    }
}
