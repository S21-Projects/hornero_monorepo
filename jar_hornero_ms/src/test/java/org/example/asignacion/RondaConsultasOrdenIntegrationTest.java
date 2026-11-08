package org.example.asignacion;

import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.UnidadArticulo;
import org.example.user.Donante;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RN-05: the two queries that feed a ronda return their rows in a fixed order, so the worker input
 * does not depend on whatever order the database happens to produce. Runs on H2, which only proves
 * the JPQL {@code ORDER BY} is applied, not PostgreSQL's physical row order.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class RondaConsultasOrdenIntegrationTest {

    @Autowired private NecesidadRepository necesidadRepository;
    @Autowired private DonacionRepository donacionRepository;
    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private ArticuloRepository articuloRepository;
    @Autowired private UsuarioRepository usuarioRepository;

    private Organizacion organizacion(String s) {
        Organizacion org = new Organizacion();
        org.setNombre("Comedor orden " + s);
        org.setValidada(true);
        org.setNivel(NivelAcreditacion.N1);
        return organizacionRepository.save(org);
    }

    private Necesidad necesidad(Organizacion org, LocalDate publicada) {
        Necesidad n = new Necesidad();
        n.setOrganizacion(org);
        n.setEstado(EstadoNecesidad.ABIERTA);
        n.setPrioridad(PrioridadNecesidad.MEDIA);
        n.setFechaPublicacion(publicada);
        return necesidadRepository.save(n);
    }

    @Test
    void candidatas_oldestPublishedFirstThenLowerId_nullDatesLast() {
        String s = UUID.randomUUID().toString().substring(0, 8);
        Organizacion org = organizacion(s);
        // Inserted so that id order is the reverse of age order.
        Necesidad reciente = necesidad(org, LocalDate.of(2026, 3, 1));
        Necesidad sinFecha = necesidad(org, null);
        Necesidad vieja = necesidad(org, LocalDate.of(2026, 1, 1));
        Necesidad mismaFechaPosterior = necesidad(org, LocalDate.of(2026, 1, 1));

        List<Long> mios = List.of(reciente.getId(), sinFecha.getId(), vieja.getId(), mismaFechaPosterior.getId());
        List<Long> orden = necesidadRepository
                .findByEstadoInWithOrganizacion(EnumSet.of(EstadoNecesidad.ABIERTA, EstadoNecesidad.EN_PROGRESO))
                .stream().map(Necesidad::getId).filter(mios::contains).toList();

        assertThat(orden).containsExactly(
                vieja.getId(), mismaFechaPosterior.getId(), reciente.getId(), sinFecha.getId());
    }

    @Test
    void pool_isOrderedByAscendingId() {
        String s = UUID.randomUUID().toString().substring(0, 8);
        Articulo arroz = new Articulo();
        arroz.setNombre("Arroz orden " + s);
        arroz.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        arroz.setUnidad(UnidadArticulo.KG);
        arroz.setActivo(true);
        articuloRepository.save(arroz);
        Donante donante = (Donante) usuarioRepository.save(
                new Donante(null, "Donante orden " + s, "orden-" + s + "@test.com", "hash", true));

        List<Long> creadas = new java.util.ArrayList<>();
        for (int i = 0; i < 4; i++) {
            Donacion d = new Donacion();
            d.setDonante(donante);
            d.setEstado(EstadoDonacion.OFRECIDA);
            d.setModalidad(ModalidadDonacion.FONDO_COMUN);
            d.setCategoria(CategoriaAlimento.NO_PERECEDERO);
            d.setLatitud(-31.41);
            d.setLongitud(-64.18);
            d.setFechaOferta(LocalDate.of(2026, 1, 1).plusDays(4 - i));
            creadas.add(donacionRepository.save(d).getId());
        }

        List<Long> orden = donacionRepository
                .findByModalidadAndEstadoAndNecesidadIsNull(ModalidadDonacion.FONDO_COMUN, EstadoDonacion.OFRECIDA)
                .stream().map(Donacion::getId).filter(creadas::contains).toList();

        assertThat(orden).isEqualTo(creadas.stream().sorted().toList());
        assertThat(Set.copyOf(orden)).hasSize(4);
    }
}
