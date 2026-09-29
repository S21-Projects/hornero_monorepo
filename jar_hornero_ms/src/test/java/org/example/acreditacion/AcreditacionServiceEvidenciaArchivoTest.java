package org.example.acreditacion;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.OrganizacionEvidenciaRepository;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * AD-12 (tesis-core-features slice 2): {@code existeArchivoEvidencia} backs the MS's evidence-file
 * access-authorization endpoint — a syntactically valid {@code objectKey} under the organizacion's
 * prefix must also match an existing {@code OrganizacionEvidencia} row.
 */
@DataJpaTest
@Import(AcreditacionService.class)
class AcreditacionServiceEvidenciaArchivoTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private AcreditacionService acreditacionService;

    @Autowired
    private OrganizacionEvidenciaRepository evidenciaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private Organizacion organizacion;

    @BeforeEach
    void setUp() {
        organizacion = new Organizacion();
        organizacion.setNombre("Comedor Archivo");
        organizacion.setSlug("comedor-archivo-" + System.nanoTime());
        organizacion.setEstado(EstadoOrganizacion.PENDIENTE);
        organizacion.setNivel(NivelAcreditacion.N0);
        organizacion = entityManager.persistFlushFind(organizacion);
    }

    private String claveDe(Organizacion org, String filename) {
        return "org-evidencia/" + org.getId() + "/" + filename;
    }

    @Test
    void aMatchingRowIsAcceptedSilently() {
        String key = claveDe(organizacion, "foto.jpg");
        evidenciaRepository.save(OrganizacionEvidencia.nueva(organizacion, RequisitoAcreditacion.NO_DISCRIMINACION,
                TipoEvidencia.FOTO, null, LocalDate.now(), null, 1L, key));

        acreditacionService.existeArchivoEvidencia(organizacion.getId(), key);
        // no exception == 204 at the controller
    }

    @Test
    void aValidKeyWithNoMatchingRowIs404() {
        String key = claveDe(organizacion, "no-existe.jpg");

        assertThatThrownBy(() -> acreditacionService.existeArchivoEvidencia(organizacion.getId(), key))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void aForeignPrefixIs400() {
        assertThatThrownBy(() ->
                acreditacionService.existeArchivoEvidencia(organizacion.getId(), "org-evidencia/999999/foto.jpg"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void aTraversalAttemptIs400() {
        assertThatThrownBy(() -> acreditacionService.existeArchivoEvidencia(
                organizacion.getId(), "org-evidencia/" + organizacion.getId() + "/../etc/passwd"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void anExtraPathSegmentIs400() {
        assertThatThrownBy(() -> acreditacionService.existeArchivoEvidencia(
                organizacion.getId(), "org-evidencia/" + organizacion.getId() + "/sub/foto.jpg"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void aReplazadaRowStillMatches() {
        String key = claveDe(organizacion, "historica.jpg");
        OrganizacionEvidencia reemplazada = OrganizacionEvidencia.nueva(organizacion,
                RequisitoAcreditacion.NO_DISCRIMINACION, TipoEvidencia.FOTO, null, LocalDate.now(), null, 1L, key);
        reemplazada.setEstado(org.example.domain.EstadoEvidencia.REEMPLAZADA);
        evidenciaRepository.save(reemplazada);

        acreditacionService.existeArchivoEvidencia(organizacion.getId(), key);
        // no exception — legajo history stays viewable
    }
}
