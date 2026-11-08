package org.example.acreditacion;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionRepository;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;
import org.example.user.Administrador;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The change's headline invariant (`specs/organizacion-evento-log/spec.md` "Replay Equals Stored
 * Level"): drives a real organizacion through the full N0→N1→N2→N3→N2 sequence via the actual
 * service methods (not hand-built events) and asserts
 * {@code AcreditacionReplay.reconstruir(log) == org.getNivel()}. This is the end-to-end assembly
 * proof — task 1.2/2.7's own RED/GREEN cycles already cover the invariant's components.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class AcreditacionInvariantTest {

    @Autowired
    private AcreditacionService acreditacionService;

    @Autowired
    private OrganizacionRepository organizacionRepository;

    @Autowired
    private OrganizacionEventoRepository eventoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Test
    @Transactional
    void replayMatchesStoredLevelAfterAFullUpDownSequence() {
        Administrador admin = usuarioRepository.save(new Administrador(null, "Admin IT", "admin-it@test.com", "x", true));

        Organizacion organizacion = new Organizacion();
        organizacion.setNombre("Comedor Invariante");
        organizacion.setSlug("comedor-invariante-" + System.nanoTime());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setNivel(NivelAcreditacion.N0);
        organizacion = organizacionRepository.save(organizacion);

        // N0 -> N1
        aprobarRequisitos(organizacion, admin, RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO,
                RequisitoAcreditacion.NO_DISCRIMINACION, RequisitoAcreditacion.SEDE_INSCRIPTA_INDIVIDUALMENTE);
        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N1, "cumple N1", admin.getId());

        // N1 -> N2
        aprobarRequisitos(organizacion, admin, RequisitoAcreditacion.CONDICIONES_SANITARIAS_ADECUADAS,
                RequisitoAcreditacion.SIN_KIOSCO_MISMO_DOMICILIO, RequisitoAcreditacion.RADIO_50KM_BANCO_ALIMENTOS);
        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N2, "cumple N2", admin.getId());

        // N2 -> N3
        aprobarRequisitos(organizacion, admin, RequisitoAcreditacion.PERSONERIA_JURIDICA_O_AVAL,
                RequisitoAcreditacion.ACEPTA_AUDITORIAS_SIN_AVISO);
        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N3, "cumple N3", admin.getId());

        // N3 -> N2 (lowered with a reason)
        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N2, "evidencia vencida", admin.getId());

        Organizacion reloaded = organizacionRepository.findById(organizacion.getId()).orElseThrow();
        List<org.example.domain.OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());

        NivelAcreditacion replayed = AcreditacionReplay.reconstruir(eventos);

        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N2);
        assertThat(replayed).isEqualTo(reloaded.getNivel());
    }

    private void aprobarRequisitos(Organizacion org, Administrador admin, RequisitoAcreditacion... requisitos) {
        for (RequisitoAcreditacion requisito : Arrays.asList(requisitos)) {
            var evidencia = acreditacionService.cargarEvidencia(org, requisito, TipoEvidencia.DECLARACION,
                    "declaración", LocalDate.now(), null, admin.getId());
            acreditacionService.aprobarEvidencia(evidencia.getId(), admin.getId());
        }
    }

    @Autowired
    private org.example.domain.OrganizacionEvidenciaRepository evidenciaRepository;

    @Autowired
    private VigenciaEvidenciaService vigencia;

    @Test
    @Transactional
    void expiringEvidenceNeverChangesTheDerivedLevelAndAnAdminCanStillLower() {
        Administrador admin = usuarioRepository.save(new Administrador(null, "Admin IV", "admin-iv@test.com", "x", true));
        Organizacion organizacion = new Organizacion();
        organizacion.setNombre("Comedor Vencimiento");
        organizacion.setSlug("comedor-vencimiento-" + System.nanoTime());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setNivel(NivelAcreditacion.N0);
        organizacion = organizacionRepository.save(organizacion);

        aprobarRequisitos(organizacion, admin, RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO,
                RequisitoAcreditacion.NO_DISCRIMINACION, RequisitoAcreditacion.SEDE_INSCRIPTA_INDIVIDUALMENTE);
        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N1, "cumple N1", admin.getId());

        for (var e : evidenciaRepository.findByOrganizacion_Id(organizacion.getId())) {
            e.fijarValidoHasta(LocalDate.now().minusDays(1));
            evidenciaRepository.save(e);
        }
        assertThat(vigencia.idsParaVencer()).hasSize(3);
        vigencia.idsParaVencer().forEach(vigencia::vencer);

        List<org.example.domain.OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
        assertThat(eventos).filteredOn(e -> e.getTipo() == org.example.domain.TipoEventoOrganizacion.EVIDENCIA_VENCIDA)
                .hasSize(3);
        assertThat(organizacionRepository.findById(organizacion.getId()).orElseThrow().getNivel())
                .isEqualTo(NivelAcreditacion.N1);
        assertThat(AcreditacionReplay.reconstruir(eventos)).isEqualTo(NivelAcreditacion.N1);

        acreditacionService.cambiarNivel(organizacion.getId(), NivelAcreditacion.N0, "gracia vencida", admin.getId());
        eventos = eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
        assertThat(AcreditacionReplay.reconstruir(eventos)).isEqualTo(NivelAcreditacion.N0);
        assertThat(organizacionRepository.findById(organizacion.getId()).orElseThrow().getNivel())
                .isEqualTo(NivelAcreditacion.N0);
    }
}
