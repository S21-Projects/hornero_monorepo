package org.example.acreditacion;

import org.example.acreditacion.dto.EvidenciaResponse;
import org.example.domain.EstadoEvidencia;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.OrganizacionEvidenciaRepository;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEventoOrganizacion;
import org.example.domain.TipoEvidencia;
import org.example.user.Administrador;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * `specs/organizacion-evidencia/spec.md` — submission, replacement-appends-not-overwrites, and
 * the admin-only audit lifecycle (approve/observe).
 */
@DataJpaTest
@Import(AcreditacionService.class)
class AcreditacionServiceEvidenciaTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private AcreditacionService acreditacionService;

    @Autowired
    private OrganizacionEvidenciaRepository evidenciaRepository;

    @Autowired
    private OrganizacionEventoRepository eventoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private Organizacion organizacion;
    private Referente referente;
    private Administrador administrador;

    @BeforeEach
    void setUp() {
        referente = usuarioRepository.save(new Referente(null, "Ref", "ref@test.com", "x", true));
        administrador = usuarioRepository.save(new Administrador(null, "Admin", "admin@test.com", "x", true));

        organizacion = new Organizacion();
        organizacion.setNombre("Comedor Test");
        organizacion.setSlug("comedor-evidencia-" + System.nanoTime());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setNivel(NivelAcreditacion.N0);
        organizacion = entityManager.persistFlushFind(organizacion);
    }

    @Test
    void submittingNewRequisitoInsertsPendienteRowAndAppendsEvent() {
        OrganizacionEvidencia evidencia = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION,
                "declaración", LocalDate.now(), null, referente.getId());

        assertThat(evidencia.getEstado()).isEqualTo(EstadoEvidencia.PENDIENTE);

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
        assertThat(eventos).extracting(OrganizacionEvento::getTipo)
                .containsExactly(TipoEventoOrganizacion.EVIDENCIA_ADJUNTADA);
    }

    @Test
    void submittingOverExistingApprovedRowReplacesItAndAppendsBothEvents() {
        OrganizacionEvidencia primera = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION,
                "primera", LocalDate.now(), null, referente.getId());
        acreditacionService.aprobarEvidencia(primera.getId(), administrador.getId());

        OrganizacionEvidencia segunda = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION,
                "segunda", LocalDate.now(), null, referente.getId());

        OrganizacionEvidencia primeraReloaded = entityManager.find(OrganizacionEvidencia.class, primera.getId());
        assertThat(primeraReloaded.getEstado()).isEqualTo(EstadoEvidencia.REEMPLAZADA);
        assertThat(primeraReloaded.getDeclaracion()).isEqualTo("primera");
        assertThat(segunda.getEstado()).isEqualTo(EstadoEvidencia.PENDIENTE);

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(organizacion.getId());
        assertThat(eventos).extracting(OrganizacionEvento::getTipo)
                .containsExactly(
                        TipoEventoOrganizacion.EVIDENCIA_ADJUNTADA,
                        TipoEventoOrganizacion.REQUISITO_APROBADO,
                        TipoEventoOrganizacion.EVIDENCIA_ADJUNTADA,
                        TipoEventoOrganizacion.EVIDENCIA_REEMPLAZADA);
    }

    @Test
    void referenteCannotApproveDirectly() {
        OrganizacionEvidencia evidencia = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION,
                "declaración", LocalDate.now(), null, referente.getId());

        assertThatThrownBy(() -> acreditacionService.aprobarEvidencia(evidencia.getId(), referente.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");

        OrganizacionEvidencia reloaded = entityManager.find(OrganizacionEvidencia.class, evidencia.getId());
        assertThat(reloaded.getEstado()).isEqualTo(EstadoEvidencia.PENDIENTE);
    }

    @Test
    void adminApprovesPendingEvidenceSettingAuditFieldsAndAppendingEvent() {
        OrganizacionEvidencia evidencia = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.SIN_KIOSCO_MISMO_DOMICILIO, TipoEvidencia.DECLARACION,
                "declaración", LocalDate.now(), null, referente.getId());

        OrganizacionEvidencia aprobada = acreditacionService.aprobarEvidencia(evidencia.getId(), administrador.getId());

        assertThat(aprobada.getEstado()).isEqualTo(EstadoEvidencia.APROBADA);
        assertThat(aprobada.getRevisadoPor()).isEqualTo(administrador.getId());
        assertThat(aprobada.getRevisadoEn()).isNotNull();

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdAndTipoIn(
                        organizacion.getId(), List.of(TipoEventoOrganizacion.REQUISITO_APROBADO));
        assertThat(eventos).hasSize(1);
    }

    @Test
    void adminObservesPendingEvidenceWithReasonRecordedOnTheEvent() {
        OrganizacionEvidencia evidencia = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.RADIO_50KM_BANCO_ALIMENTOS, TipoEvidencia.DECLARACION,
                "declaración", LocalDate.now(), null, referente.getId());

        OrganizacionEvidencia observada = acreditacionService.observarEvidencia(
                evidencia.getId(), "foto poco clara", administrador.getId());

        assertThat(observada.getEstado()).isEqualTo(EstadoEvidencia.OBSERVADA);

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdAndTipoIn(
                        organizacion.getId(), List.of(TipoEventoOrganizacion.REQUISITO_OBSERVADO));
        assertThat(eventos).hasSize(1);
        assertThat(eventos.get(0).getMotivo()).isEqualTo("foto poco clara");
    }

    // --- Task 4b.1 (D-02): audit-queue read — GET .../acreditacion/evidencias ---

    @Test
    void listingEvidenciasReturnsEveryRowWithIdAndEstado() {
        OrganizacionEvidencia pendiente = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION,
                "pendiente", LocalDate.now(), null, referente.getId());
        OrganizacionEvidencia aprobada = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.SIN_KIOSCO_MISMO_DOMICILIO, TipoEvidencia.DECLARACION,
                "aprobada", LocalDate.now(), null, referente.getId());
        acreditacionService.aprobarEvidencia(aprobada.getId(), administrador.getId());

        List<EvidenciaResponse> resultado = acreditacionService.evidencias(organizacion.getId(), null);

        assertThat(resultado).extracting(EvidenciaResponse::id)
                .containsExactlyInAnyOrder(pendiente.getId(), aprobada.getId());
        assertThat(resultado).filteredOn(e -> e.id().equals(pendiente.getId()))
                .extracting(EvidenciaResponse::estado)
                .containsExactly(EstadoEvidencia.PENDIENTE);
        assertThat(resultado).filteredOn(e -> e.id().equals(aprobada.getId()))
                .extracting(EvidenciaResponse::estado)
                .containsExactly(EstadoEvidencia.APROBADA);
    }

    @Test
    void listingEvidenciasWithEstadoFilterReturnsOnlyMatchingRows() {
        OrganizacionEvidencia pendiente = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION,
                "pendiente", LocalDate.now(), null, referente.getId());
        OrganizacionEvidencia aprobada = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.SIN_KIOSCO_MISMO_DOMICILIO, TipoEvidencia.DECLARACION,
                "aprobada", LocalDate.now(), null, referente.getId());
        acreditacionService.aprobarEvidencia(aprobada.getId(), administrador.getId());

        List<EvidenciaResponse> resultado =
                acreditacionService.evidencias(organizacion.getId(), EstadoEvidencia.PENDIENTE);

        assertThat(resultado).extracting(EvidenciaResponse::id).containsExactly(pendiente.getId());
    }

    @Test
    void listingEvidenciasForOrganizacionWithNoneReturnsEmptyListNotNull() {
        List<EvidenciaResponse> resultado = acreditacionService.evidencias(organizacion.getId(), null);

        assertThat(resultado).isNotNull();
        assertThat(resultado).isEmpty();
    }

    // --- Phase 6 defect (Slice B): objectKey must persist on FOTO/DOCUMENTO submissions ---

    @Test
    void submittingFotoEvidenceWithObjectKeyPersistsItOnTheSavedRow() {
        OrganizacionEvidencia evidencia = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.FOTO,
                null, LocalDate.now(), null, referente.getId(),
                "org-evidencia/" + organizacion.getId() + "/foto.jpg");

        OrganizacionEvidencia reloaded =
                evidenciaRepository.findById(evidencia.getId()).orElseThrow();
        assertThat(reloaded.getObjectKey()).isEqualTo("org-evidencia/" + organizacion.getId() + "/foto.jpg");
    }

    @Test
    void submittingDeclaracionEvidenceWithNullObjectKeyPersistsNullOnTheSavedRow() {
        OrganizacionEvidencia evidencia = acreditacionService.cargarEvidencia(
                organizacion, RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.DECLARACION,
                "declaración", LocalDate.now(), null, referente.getId());

        OrganizacionEvidencia reloaded =
                evidenciaRepository.findById(evidencia.getId()).orElseThrow();
        assertThat(reloaded.getObjectKey()).isNull();
    }
}
