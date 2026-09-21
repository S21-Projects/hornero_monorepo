package org.example.acreditacion;

import org.example.config.AcreditacionBackfill;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AD-7: the startup backfill is idempotent and seeds a {@code MIGRACION_INICIAL} genesis event
 * for every pre-existing row — the highest-risk correctness gap this phase covers, per the
 * design's own flag: without it, the replay invariant is false for all legacy data.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class AcreditacionBackfillTest {

    @Autowired
    private OrganizacionRepository organizacionRepository;

    @Autowired
    private OrganizacionEventoRepository eventoRepository;

    @Autowired
    private AcreditacionBackfill acreditacionBackfill;

    @Test
    @Transactional
    void backfillAssignsNivelAndGenesisEventsPerEstado() throws Exception {
        Organizacion aprobada = crearYPersistir(EstadoOrganizacion.APROBADA);
        Organizacion pendiente = crearYPersistir(EstadoOrganizacion.PENDIENTE);
        Organizacion rechazada = crearYPersistir(EstadoOrganizacion.RECHAZADA);

        acreditacionBackfill.run(null);

        Organizacion aprobadaReloaded = organizacionRepository.findById(aprobada.getId()).orElseThrow();
        assertThat(aprobadaReloaded.getNivel()).isEqualTo(NivelAcreditacion.N1);
        List<OrganizacionEvento> eventosAprobada =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(aprobada.getId());
        assertThat(eventosAprobada).hasSize(1);
        assertThat(eventosAprobada.get(0).getTipo()).isEqualTo(TipoEventoOrganizacion.MIGRACION_INICIAL);
        assertThat(eventosAprobada.get(0).getNivelAntes()).isEqualTo(NivelAcreditacion.N0);
        assertThat(eventosAprobada.get(0).getNivelDespues()).isEqualTo(NivelAcreditacion.N1);

        Organizacion pendienteReloaded = organizacionRepository.findById(pendiente.getId()).orElseThrow();
        assertThat(pendienteReloaded.getNivel()).isEqualTo(NivelAcreditacion.N0);
        List<OrganizacionEvento> eventosPendiente =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(pendiente.getId());
        assertThat(eventosPendiente).hasSize(1);
        assertThat(eventosPendiente.get(0).getTipo()).isEqualTo(TipoEventoOrganizacion.MIGRACION_INICIAL);
        assertThat(eventosPendiente.get(0).getNivelAntes()).isEqualTo(NivelAcreditacion.N0);
        assertThat(eventosPendiente.get(0).getNivelDespues()).isEqualTo(NivelAcreditacion.N0);

        Organizacion rechazadaReloaded = organizacionRepository.findById(rechazada.getId()).orElseThrow();
        assertThat(rechazadaReloaded.getNivel()).isEqualTo(NivelAcreditacion.N0);
        List<OrganizacionEvento> eventosRechazada =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(rechazada.getId());
        assertThat(eventosRechazada)
                .extracting(OrganizacionEvento::getTipo)
                .containsExactlyInAnyOrder(
                        TipoEventoOrganizacion.MIGRACION_INICIAL, TipoEventoOrganizacion.REGISTRO_RECHAZADO);
    }

    @Test
    @Transactional
    void secondRunOverTheSameRowsIsANoOp() throws Exception {
        Organizacion aprobada = crearYPersistir(EstadoOrganizacion.APROBADA);

        acreditacionBackfill.run(null);
        int eventosDespuesDePrimeraCorrida =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(aprobada.getId()).size();
        NivelAcreditacion nivelDespuesDePrimeraCorrida =
                organizacionRepository.findById(aprobada.getId()).orElseThrow().getNivel();

        acreditacionBackfill.run(null);

        List<OrganizacionEvento> eventosDespuesDeSegundaCorrida =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(aprobada.getId());
        assertThat(eventosDespuesDeSegundaCorrida).hasSize(eventosDespuesDePrimeraCorrida);

        NivelAcreditacion nivelDespuesDeSegundaCorrida =
                organizacionRepository.findById(aprobada.getId()).orElseThrow().getNivel();
        assertThat(nivelDespuesDeSegundaCorrida).isEqualTo(nivelDespuesDePrimeraCorrida);
    }

    private Organizacion crearYPersistir(EstadoOrganizacion estado) {
        Organizacion organizacion = new Organizacion();
        organizacion.setNombre("Org " + estado + " " + System.nanoTime());
        organizacion.setSlug("org-" + estado.name().toLowerCase() + "-" + System.nanoTime());
        organizacion.setEstado(estado);
        organizacion.setNivel(null);
        return organizacionRepository.save(organizacion);
    }
}
