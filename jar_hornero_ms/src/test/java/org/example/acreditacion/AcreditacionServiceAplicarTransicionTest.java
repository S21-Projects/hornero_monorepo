package org.example.acreditacion;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Import;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

/**
 * AD-3: {@code aplicarTransicion} is the single writer of {@code nivel} and always appends its
 * event in the same transaction. Uses a real Spring/H2 context (unlike the Mockito-based
 * transition/projection tests) specifically to exercise transactional rollback.
 */
@DataJpaTest
@Import(AcreditacionService.class)
class AcreditacionServiceAplicarTransicionTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private AcreditacionService acreditacionService;

    @SpyBean
    private OrganizacionEventoRepository eventoRepository;

    @Test
    void writesNivelProjectsLegacyAndAppendsExactlyOneEvent() {
        Organizacion organizacion = persistOrganizacion();

        acreditacionService.aplicarTransicion(organizacion, NivelAcreditacion.N1, null, "sube",
                TipoEventoOrganizacion.NIVEL_ELEVADO);

        entityManager.flush();
        entityManager.clear();

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N1);
        assertThat(reloaded.getEstado()).isEqualTo(EstadoOrganizacion.APROBADA);

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
        assertThat(eventos).hasSize(1);
        assertThat(eventos.get(0).getTipo()).isEqualTo(TipoEventoOrganizacion.NIVEL_ELEVADO);
        assertThat(eventos.get(0).getNivelAntes()).isEqualTo(NivelAcreditacion.N0);
        assertThat(eventos.get(0).getNivelDespues()).isEqualTo(NivelAcreditacion.N1);
    }

    @Test
    void forcedFailureAfterNivelWriteLeavesNeitherPersisted() {
        Organizacion organizacion = persistOrganizacion();
        doThrow(new RuntimeException("boom")).when(eventoRepository).save(any());

        assertThatThrownBy(() -> acreditacionService.aplicarTransicion(organizacion, NivelAcreditacion.N1,
                null, "sube", TipoEventoOrganizacion.NIVEL_ELEVADO))
                .isInstanceOf(RuntimeException.class);

        entityManager.clear();

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N0);

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
        assertThat(eventos).isEmpty();
    }

    private Organizacion persistOrganizacion() {
        Organizacion organizacion = new Organizacion();
        organizacion.setNombre("Comedor Test");
        organizacion.setSlug("comedor-test-" + System.nanoTime());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setNivel(NivelAcreditacion.N0);
        return entityManager.persistFlushFind(organizacion);
    }
}
