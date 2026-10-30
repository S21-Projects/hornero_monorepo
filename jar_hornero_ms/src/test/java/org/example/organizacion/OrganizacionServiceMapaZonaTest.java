package org.example.organizacion;

import org.example.acreditacion.AcreditacionService;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrigenOrganizacion;
import org.example.organizacion.dto.OrganizacionMapaZonaResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Viewport pins: box filter, estados, cap and param validation against a real H2 schema. */
@DataJpaTest
@Import({OrganizacionService.class, org.example.organizacion.radio.RadioCensalNoConfiguradoClient.class, AcreditacionService.class})
@org.springframework.boot.test.mock.mockito.MockBean(org.example.actividad.ActividadService.class)
class OrganizacionServiceMapaZonaTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private OrganizacionService organizacionService;

    private void persistir(String slug, EstadoOrganizacion estado, Double lat, Double lon) {
        Organizacion o = new Organizacion();
        o.setNombre("Comedor " + slug);
        o.setSlug(slug);
        o.setEstado(estado);
        o.setNivel(NivelAcreditacion.N0);
        o.setOrigen(OrigenOrganizacion.RENACOM);
        o.setOrigenId("RN-" + slug);
        o.setAsistentesDeclarados(40);
        o.setLatitud(lat);
        o.setLongitud(lon);
        entityManager.persist(o);
    }

    private List<String> slugs(OrganizacionMapaZonaResponse r) {
        return r.pins().stream().map(p -> p.slug()).toList();
    }

    @Test
    void returnsOnlyPinsInsideTheBox() {
        persistir("dentro", EstadoOrganizacion.SIN_RECLAMAR, -34.6, -58.4);
        persistir("fuera-lat", EstadoOrganizacion.SIN_RECLAMAR, -31.4, -58.4);
        persistir("fuera-lng", EstadoOrganizacion.SIN_RECLAMAR, -34.6, -64.2);
        persistir("sin-coords", EstadoOrganizacion.SIN_RECLAMAR, null, null);
        entityManager.flush();

        OrganizacionMapaZonaResponse r = organizacionService.listarMapaZona(-35.0, -34.0, -59.0, -58.0);

        assertThat(slugs(r)).containsExactly("dentro");
        assertThat(r.truncated()).isFalse();
    }

    @Test
    void boxEdgesAreInclusive() {
        persistir("borde", EstadoOrganizacion.APROBADA, -34.0, -58.0);
        entityManager.flush();

        assertThat(slugs(organizacionService.listarMapaZona(-35.0, -34.0, -59.0, -58.0))).containsExactly("borde");
    }

    @Test
    void onlyAprobadaAndSinReclamarAppear() {
        persistir("aprobada", EstadoOrganizacion.APROBADA, -34.6, -58.4);
        persistir("sin-reclamar", EstadoOrganizacion.SIN_RECLAMAR, -34.6, -58.4);
        persistir("pendiente", EstadoOrganizacion.PENDIENTE, -34.6, -58.4);
        persistir("rechazada", EstadoOrganizacion.RECHAZADA, -34.6, -58.4);
        persistir("inactiva", EstadoOrganizacion.INACTIVA, -34.6, -58.4);
        entityManager.flush();

        assertThat(slugs(organizacionService.listarMapaZona(-35.0, -34.0, -59.0, -58.0)))
                .containsExactly("aprobada", "sin-reclamar");
    }

    @Test
    void truncatesAtTheCapAndFlagsIt() {
        int total = OrganizacionService.MAX_PINES_ZONA + 1;
        for (int i = 0; i < total; i++) {
            persistir("o-" + i, EstadoOrganizacion.SIN_RECLAMAR, -34.5, -58.5);
        }
        entityManager.flush();

        OrganizacionMapaZonaResponse r = organizacionService.listarMapaZona(-35.0, -34.0, -59.0, -58.0);

        assertThat(r.pins()).hasSize(OrganizacionService.MAX_PINES_ZONA);
        assertThat(r.truncated()).isTrue();
    }

    @Test
    void exactlyTheCapIsNotTruncated() {
        for (int i = 0; i < OrganizacionService.MAX_PINES_ZONA; i++) {
            persistir("o-" + i, EstadoOrganizacion.SIN_RECLAMAR, -34.5, -58.5);
        }
        entityManager.flush();

        OrganizacionMapaZonaResponse r = organizacionService.listarMapaZona(-35.0, -34.0, -59.0, -58.0);

        assertThat(r.pins()).hasSize(OrganizacionService.MAX_PINES_ZONA);
        assertThat(r.truncated()).isFalse();
    }

    @Test
    void rejectsInvalidBoxesWith400() {
        assertBadRequest(null, -34.0, -59.0, -58.0);
        assertBadRequest(-35.0, -34.0, -59.0, null);
        assertBadRequest(-91.0, -34.0, -59.0, -58.0);
        assertBadRequest(-35.0, 91.0, -59.0, -58.0);
        assertBadRequest(-35.0, -34.0, -181.0, -58.0);
        assertBadRequest(-35.0, -34.0, -59.0, 181.0);
        assertBadRequest(-34.0, -35.0, -59.0, -58.0);
        assertBadRequest(-35.0, -34.0, -58.0, -59.0);
        assertBadRequest(Double.NaN, -34.0, -59.0, -58.0);
    }

    private void assertBadRequest(Double minLat, Double maxLat, Double minLng, Double maxLng) {
        assertThatThrownBy(() -> organizacionService.listarMapaZona(minLat, maxLat, minLng, maxLng))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
    }
}
