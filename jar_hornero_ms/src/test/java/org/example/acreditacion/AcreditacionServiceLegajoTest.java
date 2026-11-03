package org.example.acreditacion;

import org.example.acreditacion.dto.LegajoResponse;
import org.example.acreditacion.dto.RequisitoEnLegajo;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.EstadoRequisitoLegajo;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;
import org.example.user.Administrador;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * `specs/organizacion-legajo/spec.md`: assembly lists every union requisito (even unfulfilled
 * ones), reflects VIGENTE/VENCIDA per requisito, carries the full chronological event log, and
 * always includes the not-system-verified disclosure.
 */
@DataJpaTest
@Import(AcreditacionService.class)
class AcreditacionServiceLegajoTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private AcreditacionService acreditacionService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private Organizacion organizacion;
    private Administrador administrador;

    @BeforeEach
    void setUp() {
        administrador = usuarioRepository.save(new Administrador(null, "Admin", "admin@test.com", "x", true));

        organizacion = new Organizacion();
        organizacion.setNombre("Comedor Legajo");
        organizacion.setSlug("comedor-legajo-" + System.nanoTime());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setNivel(NivelAcreditacion.N0);
        organizacion = entityManager.persistFlushFind(organizacion);
    }

    @Test
    void legajoListsAllEightRequisitosWithN2N3ShowingFaltante() {
        var evidencia = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO, TipoEvidencia.DECLARACION, "d",
                LocalDate.now(), null, administrador.getId());
        acreditacionService.aprobarEvidencia(evidencia.getId(), administrador.getId());

        LegajoResponse legajo = acreditacionService.legajo(organizacion.getId());

        assertThat(legajo.requisitos()).hasSize(RequisitoAcreditacion.values().length);
        RequisitoEnLegajo n2Requisito = legajo.requisitos().stream()
                .filter(r -> r.requisito() == RequisitoAcreditacion.CONDICIONES_SANITARIAS_ADECUADAS)
                .findFirst().orElseThrow();
        assertThat(n2Requisito.estado()).isEqualTo(EstadoRequisitoLegajo.FALTANTE);
    }

    @Test
    void legajoReflectsVigenteVsVencidaPerRequisito() {
        var vigenteEvidencia = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.CONDICIONES_SANITARIAS_ADECUADAS, TipoEvidencia.DECLARACION, "d",
                LocalDate.now(), LocalDate.now().plusMonths(6), administrador.getId());
        acreditacionService.aprobarEvidencia(vigenteEvidencia.getId(), administrador.getId());

        var vencidaEvidencia = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.RADIO_50KM_BANCO_ALIMENTOS, TipoEvidencia.DECLARACION, "d",
                LocalDate.now().minusYears(1), LocalDate.now().minusDays(1), administrador.getId());
        acreditacionService.aprobarEvidencia(vencidaEvidencia.getId(), administrador.getId());

        LegajoResponse legajo = acreditacionService.legajo(organizacion.getId());

        RequisitoEnLegajo condiciones = legajo.requisitos().stream()
                .filter(r -> r.requisito() == RequisitoAcreditacion.CONDICIONES_SANITARIAS_ADECUADAS)
                .findFirst().orElseThrow();
        assertThat(condiciones.estado()).isEqualTo(EstadoRequisitoLegajo.APROBADA);
        assertThat(condiciones.expirada()).isFalse();

        RequisitoEnLegajo radio = legajo.requisitos().stream()
                .filter(r -> r.requisito() == RequisitoAcreditacion.RADIO_50KM_BANCO_ALIMENTOS)
                .findFirst().orElseThrow();
        assertThat(radio.estado()).isEqualTo(EstadoRequisitoLegajo.APROBADA);
        assertThat(radio.expirada()).isTrue();

        Organizacion reloaded = entityManager.find(Organizacion.class, organizacion.getId());
        assertThat(reloaded.getNivel()).isEqualTo(NivelAcreditacion.N0);
    }

    @Test
    void legajoIncludesFullEventLogInChronologicalOrder() {
        var e1 = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO, TipoEvidencia.DECLARACION, "d",
                LocalDate.now(), null, administrador.getId());
        acreditacionService.aprobarEvidencia(e1.getId(), administrador.getId());
        var e2 = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION, "d",
                LocalDate.now(), null, administrador.getId());
        acreditacionService.observarEvidencia(e2.getId(), "revisar", administrador.getId());

        LegajoResponse legajo = acreditacionService.legajo(organizacion.getId());

        assertThat(legajo.eventos()).hasSize(4);
        assertThat(legajo.eventos()).isSortedAccordingTo(
                java.util.Comparator.comparing(org.example.acreditacion.dto.EventoResponse::ocurridoEn));
    }

    @Test
    void requisitoObservadoShowsObservadaNotPendienteOrFaltante() {
        var evidencia = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION, "d",
                LocalDate.now(), null, administrador.getId());
        acreditacionService.observarEvidencia(evidencia.getId(), "revisar foto", administrador.getId());

        LegajoResponse legajo = acreditacionService.legajo(organizacion.getId());

        RequisitoEnLegajo requisito = legajo.requisitos().stream()
                .filter(r -> r.requisito() == RequisitoAcreditacion.NO_DISCRIMINACION)
                .findFirst().orElseThrow();
        assertThat(requisito.estado()).isEqualTo(EstadoRequisitoLegajo.OBSERVADA);
        assertThat(requisito.observacion()).isEqualTo("revisar foto");
        assertThat(requisito.cargadoEn()).isNotNull();
        assertThat(requisito.auditadoEn()).isNotNull();
    }

    @Test
    void faltanteAndPendienteRequisitosCarryNoObservacion() {
        acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION, "d",
                LocalDate.now(), null, administrador.getId());

        LegajoResponse legajo = acreditacionService.legajo(organizacion.getId());

        RequisitoEnLegajo pendiente = legajo.requisitos().stream()
                .filter(r -> r.requisito() == RequisitoAcreditacion.NO_DISCRIMINACION)
                .findFirst().orElseThrow();
        assertThat(pendiente.observacion()).isNull();
        assertThat(pendiente.cargadoEn()).isNotNull();

        RequisitoEnLegajo faltante = legajo.requisitos().stream()
                .filter(r -> r.requisito() == RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO)
                .findFirst().orElseThrow();
        assertThat(faltante.observacion()).isNull();
        assertThat(faltante.cargadoEn()).isNull();
    }

    @Test
    void disclosureIsPresentRegardlessOfLevel() {
        LegajoResponse legajoN0 = acreditacionService.legajo(organizacion.getId());
        assertThat(legajoN0.disclosure()).isNotBlank();
    }

    /**
     * task 2.24 (AD-12 follow-up): {@code RequisitoEnLegajo} must carry {@code objectKey} so the
     * referente's own acreditación view (`acreditacion.tsx`) can resolve the authenticated
     * evidence-file route, the same way the audit queue and legajo screens already do.
     */
    @Test
    void requisitoEnLegajoCarriesObjectKeyForFotoEvidence() {
        var evidencia = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO, TipoEvidencia.FOTO, null,
                LocalDate.now(), null, administrador.getId(),
                "org-evidencia/" + organizacion.getId() + "/foto.jpg");
        acreditacionService.aprobarEvidencia(evidencia.getId(), administrador.getId());

        LegajoResponse legajo = acreditacionService.legajo(organizacion.getId());

        RequisitoEnLegajo requisito = legajo.requisitos().stream()
                .filter(r -> r.requisito() == RequisitoAcreditacion.SERVICIO_REGULAR_GRATUITO)
                .findFirst().orElseThrow();
        assertThat(requisito.objectKey()).isEqualTo("org-evidencia/" + organizacion.getId() + "/foto.jpg");
    }

    @Test
    void requisitoEnLegajoObjectKeyIsNullForDeclaracionEvidence() {
        var evidencia = acreditacionService.cargarEvidencia(organizacion,
                RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION, "d",
                LocalDate.now(), null, administrador.getId());
        acreditacionService.aprobarEvidencia(evidencia.getId(), administrador.getId());

        LegajoResponse legajo = acreditacionService.legajo(organizacion.getId());

        RequisitoEnLegajo requisito = legajo.requisitos().stream()
                .filter(r -> r.requisito() == RequisitoAcreditacion.NO_DISCRIMINACION)
                .findFirst().orElseThrow();
        assertThat(requisito.objectKey()).isNull();
    }
}
