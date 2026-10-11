package org.example.organizacion;

import org.example.acreditacion.AcreditacionService;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.example.organizacion.dto.AsignarReferenteRequest;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * `specs/organizacion-evento-log/spec.md` "Reassignment Is a Logged Non-Accreditation Event":
 * reassigning (or unassigning) a referente appends `REFERENTE_REASIGNADO` and leaves
 * `nivel`/`estado`/`validada` byte-identical — this is a non-accreditation event.
 */
@DataJpaTest
@Import({OrganizacionService.class, AcreditacionService.class})
@org.springframework.boot.test.mock.mockito.MockBean(org.example.actividad.ActividadService.class)
class OrganizacionServiceAsignarReferenteTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private OrganizacionService organizacionService;

    @Autowired
    private OrganizacionEventoRepository eventoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private Referente nuevoReferente;

    @BeforeEach
    void setUp() {
        nuevoReferente = usuarioRepository.save(new Referente(null, "Nuevo Ref", "nuevo@test.com", "x", true));
    }

    private Organizacion persistOrganizacionAt(NivelAcreditacion nivel, EstadoOrganizacion estado) {
        Organizacion organizacion = new Organizacion();
        organizacion.setNombre("Comedor Reasignar");
        organizacion.setSlug("comedor-reasignar-" + System.nanoTime());
        organizacion.setEstado(estado);
        organizacion.setNivel(nivel);
        organizacion.setValidada(estado == EstadoOrganizacion.APROBADA);
        return entityManager.persistFlushFind(organizacion);
    }

    @Test
    void reassigningAppendsEventAndLeavesAccreditationByteIdentical() {
        Organizacion organizacion = persistOrganizacionAt(NivelAcreditacion.N2, EstadoOrganizacion.APROBADA);

        organizacionService.asignarReferente(organizacion.getId(),
                new AsignarReferenteRequest(nuevoReferente.getId()));

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N2);
        assertThat(reloaded.getEstado()).isEqualTo(EstadoOrganizacion.APROBADA);
        assertThat(reloaded.getValidada()).isTrue();

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
        assertThat(eventos).extracting(OrganizacionEvento::getTipo)
                .containsExactly(TipoEventoOrganizacion.REFERENTE_REASIGNADO);
    }

    @Test
    void unassigningAlsoAppendsEventAndLeavesAccreditationUntouched() {
        Organizacion organizacion = persistOrganizacionAt(NivelAcreditacion.N1, EstadoOrganizacion.APROBADA);
        organizacion.setReferente(nuevoReferente);
        entityManager.persistAndFlush(organizacion);

        organizacionService.asignarReferente(organizacion.getId(), new AsignarReferenteRequest(null));

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getReferente()).isNull();
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N1);
        assertThat(reloaded.getEstado()).isEqualTo(EstadoOrganizacion.APROBADA);

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
        assertThat(eventos).extracting(OrganizacionEvento::getTipo)
                .containsExactly(TipoEventoOrganizacion.REFERENTE_REASIGNADO);
    }
}
