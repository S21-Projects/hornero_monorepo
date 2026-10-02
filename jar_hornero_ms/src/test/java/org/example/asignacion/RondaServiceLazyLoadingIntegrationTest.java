package org.example.asignacion;

import org.example.asignacion.worker.AsignadorClient;
import org.example.asignacion.worker.dto.CandidatoEntradaV1;
import org.example.asignacion.worker.dto.DonacionEntradaV1;
import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.asignacion.worker.dto.SalidaRondaV1;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.DonacionLinea;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoRonda;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadArticulo;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.Ronda;
import org.example.domain.UnidadArticulo;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * DEFECT 1 regression (end-to-end finding against a fresh DB): {@code RondaService.ejecutar}
 * read the pool/candidates inside a {@code TransactionTemplate} read phase but built the worker
 * input (which walks {@code Donacion.lineas} and {@code Necesidad.articulos}) *after* that
 * transaction closed, so real (not mocked) lazy collections threw
 * {@code LazyInitializationException}. {@code RondaServiceTest} mocks every repository and never
 * opens a real Hibernate session, so it never caught this. This test uses real repositories and a
 * real Spring-managed transaction to prove the full read+build path survives.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class RondaServiceLazyLoadingIntegrationTest {

    @Autowired
    private RondaService rondaService;

    @Autowired
    private OrganizacionRepository organizacionRepository;

    @Autowired
    private NecesidadRepository necesidadRepository;

    @Autowired
    private DonacionRepository donacionRepository;

    @Autowired
    private ArticuloRepository articuloRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @MockBean
    private AsignadorClient asignadorClient;

    private Articulo arroz;

    @BeforeEach
    void setUp() {
        when(asignadorClient.ejecutar(any(EntradaRondaV1.class))).thenReturn(new SalidaRondaV1());

        arroz = new Articulo();
        arroz.setNombre("Arroz Test Lazy");
        arroz.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        arroz.setUnidad(UnidadArticulo.KG);
        arroz.setActivo(true);
        arroz = articuloRepository.save(arroz);
    }

    @Test
    void ejecutar_conDonacionesYNecesidadesReales_noFallaPorLazyInitialization() {
        Referente referente = new Referente(null, "Ref Test", "ref-lazy@test.com", "hash", true);
        referente = (Referente) usuarioRepository.save(referente);

        Organizacion org = new Organizacion();
        org.setNombre("Comedor Lazy Test");
        org.setValidada(true);
        org.setNivel(NivelAcreditacion.N1);
        org.setReferente(referente);
        org.setLatitud(-31.40);
        org.setLongitud(-64.20);
        org = organizacionRepository.save(org);

        Necesidad necesidad = new Necesidad();
        necesidad.setOrganizacion(org);
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setPrioridad(PrioridadNecesidad.MEDIA);
        necesidad.setFechaVencimiento(LocalDate.now().plusDays(30));
        NecesidadArticulo na = new NecesidadArticulo();
        na.setArticulo(arroz);
        na.setNecesidad(necesidad);
        necesidad.getArticulos().add(na);
        necesidad = necesidadRepository.save(necesidad);

        Donante donante = new Donante(null, "Donante Lazy Test", "donante-lazy@test.com", "hash", true);
        donante = (Donante) usuarioRepository.save(donante);

        Donacion donacion = new Donacion();
        donacion.setDonante(donante);
        donacion.setEstado(EstadoDonacion.OFRECIDA);
        donacion.setModalidad(ModalidadDonacion.FONDO_COMUN);
        donacion.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        donacion.setLatitud(-31.41);
        donacion.setLongitud(-64.18);
        donacion.setFechaOferta(LocalDate.now().minusDays(2));
        DonacionLinea linea = new DonacionLinea();
        linea.setArticulo(arroz);
        linea.setCantidad(BigDecimal.TEN);
        linea.setDonacion(donacion);
        donacion.getLineas().add(linea);
        final Long donacionId = donacionRepository.save(donacion).getId();
        final Long necesidadId = necesidad.getId();

        // Deliberately does not assert the entrada's total donaciones/candidatos counts: the
        // app context (and its H2 DB) is shared across the full @SpringBootTest suite, so other
        // tests' and DataInitializer's own seeded pool/candidates may legitimately be present too.
        // This test only needs to prove its own fixtures survive the read+build path without a
        // LazyInitializationException, and carry the right articulo ids.
        Ronda ronda = rondaService.ejecutar(99L);

        assertThat(ronda.getEstado()).isEqualTo(EstadoRonda.COMPLETADA);

        ArgumentCaptor<EntradaRondaV1> captor = ArgumentCaptor.forClass(EntradaRondaV1.class);
        verify(asignadorClient).ejecutar(captor.capture());
        EntradaRondaV1 entrada = captor.getValue();

        DonacionEntradaV1 miDonacion = entrada.getDonaciones().stream()
                .filter(d -> d.getId().equals(donacionId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Test donación not found in the built entrada"));
        assertThat(miDonacion.getArticuloIds()).containsExactly(arroz.getId());

        CandidatoEntradaV1 miCandidato = entrada.getCandidatos().stream()
                .filter(c -> c.getNecesidadId().equals(necesidadId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Test necesidad not found in the built entrada"));
        assertThat(miCandidato.getArticuloIds()).containsExactly(arroz.getId());
    }
}
