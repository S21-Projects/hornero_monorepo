package org.example.organizacion;

import org.example.acreditacion.AcreditacionService;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.organizacion.dto.OrganizacionResponse;
import org.example.user.Referente;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.LongStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Admin listing: pagination, sinReferente / referenteIds / q filters against a real H2 schema. */
@DataJpaTest
@Import({OrganizacionService.class, org.example.organizacion.radio.RadioCensalNoConfiguradoClient.class, AcreditacionService.class})
@org.springframework.boot.test.mock.mockito.MockBean(org.example.actividad.ActividadService.class)
class OrganizacionServiceListarTodasTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private OrganizacionService organizacionService;

    private Referente ana;
    private Referente beto;

    private Referente referente(String email) {
        Referente r = new Referente();
        r.setNombre(email);
        r.setEmail(email);
        r.setPassword("x");
        r.setActivo(true);
        return entityManager.persist(r);
    }

    private Organizacion org(String nombre, Referente referente) {
        Organizacion o = new Organizacion();
        o.setNombre(nombre);
        o.setSlug(nombre.toLowerCase().replaceAll("[^a-z0-9]+", "-"));
        o.setEstado(referente == null ? EstadoOrganizacion.SIN_RECLAMAR : EstadoOrganizacion.APROBADA);
        o.setNivel(NivelAcreditacion.N0);
        o.setReferente(referente);
        return entityManager.persist(o);
    }

    @BeforeEach
    void datos() {
        ana = referente("ana@test.com");
        beto = referente("beto@test.com");
        org("Comedor Sol", ana);
        org("Merendero Luna", ana);
        org("Comedor Estrella", beto);
        org("Comedor Norte", null);
        org("Copa de Leche 100% Sur", null);
        org("Copa de Leche Oeste", null);
        entityManager.flush();
    }

    private static PageRequest pagina(int page, int size) {
        return PageRequest.of(page, size, Sort.by("id"));
    }

    private static List<String> nombres(Page<OrganizacionResponse> p) {
        return p.getContent().stream().map(OrganizacionResponse::getNombre).toList();
    }

    @Test
    void sinFiltrosListaTodasPaginadas() {
        Page<OrganizacionResponse> p = organizacionService.listarTodas(null, null, null, pagina(0, 4));

        assertThat(p.getTotalElements()).isEqualTo(6);
        assertThat(p.getTotalPages()).isEqualTo(2);
        assertThat(p.getContent()).hasSize(4);
    }

    @Test
    void sinReferenteDevuelveSoloLasHuerfanas() {
        Page<OrganizacionResponse> p = organizacionService.listarTodas(true, null, null, pagina(0, 20));

        assertThat(nombres(p)).containsExactly("Comedor Norte", "Copa de Leche 100% Sur", "Copa de Leche Oeste");
        assertThat(p.getTotalElements()).isEqualTo(3);
    }

    @Test
    void sinReferenteFalseNoFiltra() {
        assertThat(organizacionService.listarTodas(false, null, null, pagina(0, 20)).getTotalElements())
                .isEqualTo(6);
    }

    @Test
    void referenteIdsDevuelveLasOrganizacionesDeEsosReferentes() {
        Page<OrganizacionResponse> p = organizacionService.listarTodas(
                null, List.of(ana.getId(), beto.getId()), null, pagina(0, 100));
        Page<OrganizacionResponse> soloAna = organizacionService.listarTodas(
                null, List.of(ana.getId()), null, pagina(0, 100));

        assertThat(nombres(p)).containsExactly("Comedor Sol", "Merendero Luna", "Comedor Estrella");
        assertThat(nombres(soloAna)).containsExactly("Comedor Sol", "Merendero Luna");
    }

    @Test
    void qEsInsensibleAMayusculasYBuscaSubcadena() {
        Page<OrganizacionResponse> p = organizacionService.listarTodas(true, null, "  COMEDOR ", pagina(0, 20));

        assertThat(nombres(p)).containsExactly("Comedor Norte");
    }

    @Test
    void qTratalosComodinesLikeComoTexto() {
        assertThat(nombres(organizacionService.listarTodas(true, null, "100%", pagina(0, 20))))
                .containsExactly("Copa de Leche 100% Sur");
        assertThat(organizacionService.listarTodas(true, null, "%", pagina(0, 20)).getTotalElements())
                .isEqualTo(1);
        assertThat(organizacionService.listarTodas(true, null, "_", pagina(0, 20)).getTotalElements())
                .isZero();
    }

    @Test
    void qEnBlancoNoFiltra() {
        assertThat(organizacionService.listarTodas(true, null, "   ", pagina(0, 20)).getTotalElements())
                .isEqualTo(3);
    }

    @Test
    void masDeCienReferenteIdsSeRechazaConBadRequest() {
        List<Long> ids = LongStream.rangeClosed(1, OrganizacionService.MAX_REFERENTE_IDS + 1).boxed().toList();

        assertThatThrownBy(() -> organizacionService.listarTodas(null, ids, null, pagina(0, 20)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("referenteIds");
    }
}
