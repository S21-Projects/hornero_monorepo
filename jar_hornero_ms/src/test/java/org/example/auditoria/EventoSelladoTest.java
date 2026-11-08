package org.example.auditoria;

import jakarta.persistence.EntityManager;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.example.auditoria.CadenaTestSupport.evento;
import static org.example.auditoria.CadenaTestSupport.organizacion;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class EventoSelladoTest {

    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private OrganizacionEventoRepository eventoRepository;
    @Autowired private EntityManager em;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void everySavedEventIsLinkedToThePreviousOneOfItsOrganization() {
        Organizacion a = organizacion(organizacionRepository, "Sellado A");
        Organizacion b = organizacion(organizacionRepository, "Sellado B");

        OrganizacionEvento a1 = evento(eventoRepository, a, "a1");
        OrganizacionEvento b1 = evento(eventoRepository, b, "b1");
        OrganizacionEvento a2 = evento(eventoRepository, a, "a2");
        OrganizacionEvento a3 = evento(eventoRepository, a, "a3");

        assertThat(a1.getPrevHash()).isEqualTo(CadenaHash.GENESIS);
        assertThat(b1.getPrevHash()).as("each organization has its own chain").isEqualTo(CadenaHash.GENESIS);
        assertThat(a2.getPrevHash()).isEqualTo(a1.getHash());
        assertThat(a3.getPrevHash()).isEqualTo(a2.getHash());
        assertThat(a1.getHash()).hasSize(64).isNotEqualTo(b1.getHash());
    }

    @Test
    void theStoredHashSurvivesAReadFromTheDatabase() {
        Organizacion org = organizacion(organizacionRepository, "Sellado round trip");
        OrganizacionEvento guardado = evento(eventoRepository, org, "motivo con ñ, acentos á y\nsalto de línea");
        em.flush();
        em.clear();

        OrganizacionEvento leido = eventoRepository
                .findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(org.getId()).get(0);

        CadenaHash.Contenido contenido = new CadenaHash.Contenido(org.getId(), leido.getTipo().name(),
                leido.getOcurridoEn(), leido.getActorUsuarioId(), leido.getActorTipo(), null, null, null, null,
                leido.getMotivo(), leido.getPayload());
        assertThat(CadenaHash.hash(leido.getPrevHash(), contenido)).isEqualTo(guardado.getHash()).isEqualTo(leido.getHash());
    }

    @Test
    void anEventSavedAfterAnUnsealedOneCompletesTheChainFirst() {
        Organizacion org = organizacion(organizacionRepository, "Sellado heredado");
        CadenaTestSupport.insertarSinHash(jdbc, org.getId(), "legacy 1");
        CadenaTestSupport.insertarSinHash(jdbc, org.getId(), "legacy 2");

        OrganizacionEvento nuevo = evento(eventoRepository, org, "nuevo");

        List<String> hashes = jdbc.queryForList(
                "select hash from organizacion_evento where organizacion_id = ? order by id", String.class, org.getId());
        assertThat(hashes).hasSize(3).doesNotContainNull();
        assertThat(nuevo.getPrevHash()).isEqualTo(hashes.get(1));
    }
}
