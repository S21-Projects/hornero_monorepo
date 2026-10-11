package org.example.organizacion;

import org.example.acreditacion.AcreditacionService;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEventoRepository;
import org.example.user.Administrador;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Back-compat regression (design's "Backwards-Compatible Projection" section,
 * `specs/organizacion-acreditacion/spec.md` "Existing approved organizacion migrates to N1"): the
 * live admin `validar()`/`rechazar()` actions delegate to `AcreditacionService` (AD-6) instead of
 * duplicating the write, so the ladder and the legacy `estado`/`validada` flip cannot diverge.
 * Real Spring/H2 context (not Mockito) so the delegation is proven end-to-end, not by a stub.
 */
@DataJpaTest
@Import({OrganizacionService.class, AcreditacionService.class})
@org.springframework.boot.test.mock.mockito.MockBean(org.example.actividad.ActividadService.class)
class OrganizacionServiceValidarRechazarTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private OrganizacionService organizacionService;

    @Autowired
    private OrganizacionEventoRepository eventoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private Administrador administrador;

    @BeforeEach
    void setUp() {
        administrador = usuarioRepository.save(new Administrador(null, "Admin", "admin@test.com", "x", true));
    }

    private Organizacion persistPendiente() {
        Organizacion organizacion = new Organizacion();
        organizacion.setNombre("Comedor Validar");
        organizacion.setSlug("comedor-validar-" + System.nanoTime());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setNivel(NivelAcreditacion.N0);
        return entityManager.persistFlushFind(organizacion);
    }

    @Test
    void validarOnPendienteYieldsN1AndAprobadaAndOneEvent() {
        Organizacion organizacion = persistPendiente();

        organizacionService.validar(organizacion.getId(), administrador.getId());

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N1);
        assertThat(reloaded.getEstado()).isEqualTo(EstadoOrganizacion.APROBADA);
        assertThat(reloaded.getValidada()).isTrue();

        List<?> eventos = eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
        assertThat(eventos).hasSize(1);
    }

    @Test
    void findBySlugPublicStill404sForN0AndOkForN1() {
        Organizacion pendiente = persistPendiente();
        assertThatThrownBy(() -> organizacionService.findBySlugPublic(pendiente.getSlug()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");

        Organizacion validado = persistPendiente();
        organizacionService.validar(validado.getId(), administrador.getId());

        assertThat(organizacionService.findBySlugPublic(validado.getSlug()).isValidada()).isTrue();
    }

    @Test
    void rechazarOnPendienteSetsRechazadaWithoutRaisingNivel() {
        Organizacion organizacion = persistPendiente();

        organizacionService.rechazar(organizacion.getId(), administrador.getId());

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getEstado()).isEqualTo(EstadoOrganizacion.RECHAZADA);
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N0);
    }
}
