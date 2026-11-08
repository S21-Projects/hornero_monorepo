package org.example.auditoria;

import org.example.domain.Organizacion;
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
import static org.example.auditoria.CadenaTestSupport.ids;
import static org.example.auditoria.CadenaTestSupport.organizacion;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class VerificadorCadenaTest {

    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private OrganizacionEventoRepository eventoRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private VerificadorCadena verificador;

    private List<Long> cadena(Organizacion org, int n) {
        for (int i = 1; i <= n; i++) {
            evento(eventoRepository, org, "evento " + i);
        }
        return ids(jdbc, org.getId());
    }

    @Test
    void anUntouchedChainVerifies() {
        Organizacion a = organizacion(organizacionRepository, "Verif ok A");
        Organizacion b = organizacion(organizacionRepository, "Verif ok B");
        cadena(a, 4);
        cadena(b, 3);

        VerificadorCadena.Resultado r = verificador.verificar();

        assertThat(r.integra()).isTrue();
        assertThat(r.primerIdRoto()).isNull();
        assertThat(r.eventos()).isGreaterThanOrEqualTo(7);
        assertThat(r.raiz()).hasSize(64);
    }

    @Test
    void editingAnEventByHandIsDetectedAtThatEvent() {
        Organizacion org = organizacion(organizacionRepository, "Verif tamper");
        List<Long> ids = cadena(org, 5);

        jdbc.update("update organizacion_evento set motivo = 'alterado' where id = ?", ids.get(2));

        VerificadorCadena.Resultado r = verificador.verificar();
        assertThat(r.integra()).isFalse();
        assertThat(r.primerIdRoto()).isEqualTo(ids.get(2));
        assertThat(r.motivo()).isEqualTo("CONTENIDO");
    }

    @Test
    void changingTheActorIsDetected() {
        Organizacion org = organizacion(organizacionRepository, "Verif actor");
        List<Long> ids = cadena(org, 3);

        jdbc.update("update organizacion_evento set actor_usuario_id = 999 where id = ?", ids.get(1));

        assertThat(verificador.verificar().primerIdRoto()).isEqualTo(ids.get(1));
    }

    @Test
    void aDeletedMiddleRowIsDetectedAtItsSuccessor() {
        Organizacion org = organizacion(organizacionRepository, "Verif delete");
        List<Long> ids = cadena(org, 5);

        jdbc.update("delete from organizacion_evento where id = ?", ids.get(2));

        VerificadorCadena.Resultado r = verificador.verificar();
        assertThat(r.integra()).isFalse();
        assertThat(r.primerIdRoto()).isEqualTo(ids.get(3));
        assertThat(r.motivo()).isEqualTo("ENLACE");
        assertThat(r.incidencias()).as("one defect, one report: the chain resynchronizes after it").isEqualTo(1);
    }

    @Test
    void aReorderedRowIsDetected() {
        Organizacion org = organizacion(organizacionRepository, "Verif reorder");
        List<Long> ids = cadena(org, 4);

        // Swap the positions of the 2nd and 3rd events (their ids), leaving content and hashes intact.
        jdbc.update("update organizacion_evento set id = -1 where id = ?", ids.get(1));
        jdbc.update("update organizacion_evento set id = ? where id = ?", ids.get(1), ids.get(2));
        jdbc.update("update organizacion_evento set id = ? where id = -1", ids.get(2));

        VerificadorCadena.Resultado r = verificador.verificar();
        assertThat(r.integra()).isFalse();
        assertThat(r.primerIdRoto()).isEqualTo(ids.get(1));
        assertThat(r.motivo()).isEqualTo("ENLACE");
    }

    @Test
    void anEventMovedToAnotherOrganizationIsDetected() {
        Organizacion a = organizacion(organizacionRepository, "Verif mover A");
        Organizacion b = organizacion(organizacionRepository, "Verif mover B");
        List<Long> ids = cadena(a, 3);
        cadena(b, 1);

        jdbc.update("update organizacion_evento set organizacion_id = ? where id = ?", b.getId(), ids.get(2));

        assertThat(verificador.verificar().integra()).isFalse();
    }

    @Test
    void deletingTheLastEventsOfAChainChangesTheAnchorRootEvenThoughTheChainStaysConsistent() {
        Organizacion org = organizacion(organizacionRepository, "Verif cola");
        List<Long> ids = cadena(org, 4);
        VerificadorCadena.Resultado antes = verificador.verificar();

        jdbc.update("delete from organizacion_evento where id = ?", ids.get(3));

        VerificadorCadena.Resultado despues = verificador.verificar();
        assertThat(despues.integra()).as("a truncated tail is not visible from inside the table").isTrue();
        assertThat(despues.raiz()).as("but the root published as an anchor does change").isNotEqualTo(antes.raiz());
        assertThat(despues.eventos()).isEqualTo(antes.eventos() - 1);
    }

    @Test
    void unsealedRowsAtTheEndArePendingNotBroken_butUnsealedRowsBeforeASealedOneAre() {
        Organizacion pendiente = organizacion(organizacionRepository, "Verif pendiente");
        evento(eventoRepository, pendiente, "sellado");
        CadenaTestSupport.insertarSinHash(jdbc, pendiente.getId(), "heredado");
        VerificadorCadena.Resultado r1 = verificador.verificar();
        assertThat(r1.integra()).isTrue();
        assertThat(r1.pendientes()).isEqualTo(1);

        Organizacion roto = organizacion(organizacionRepository, "Verif hueco");
        List<Long> ids = cadena(roto, 3);
        jdbc.update("update organizacion_evento set hash = null, prev_hash = null where id = ?", ids.get(1));
        VerificadorCadena.Resultado r2 = verificador.verificar();
        assertThat(r2.integra()).isFalse();
        assertThat(r2.primerIdRoto()).isEqualTo(ids.get(1));
    }

    @Test
    void verifiesAcrossPagesAndOrganizations() {
        Organizacion a = organizacion(organizacionRepository, "Verif paginas A");
        Organizacion b = organizacion(organizacionRepository, "Verif paginas B");
        cadena(a, 7);
        List<Long> idsB = cadena(b, 7);

        assertThat(new VerificadorCadena(jdbc, 3).verificar().integra()).isTrue();

        jdbc.update("update organizacion_evento set motivo = 'x' where id = ?", idsB.get(5));
        assertThat(new VerificadorCadena(jdbc, 3).verificar().primerIdRoto()).isEqualTo(idsB.get(5));
    }

    @Test
    void sealingCompletesLegacyRowsAndTheyVerifyAfterwards() {
        Organizacion org = organizacion(organizacionRepository, "Verif backfill");
        CadenaTestSupport.insertarSinHash(jdbc, org.getId(), "uno");
        CadenaTestSupport.insertarSinHash(jdbc, org.getId(), "dos");
        CadenaTestSupport.insertarSinHash(jdbc, org.getId(), "tres");
        assertThat(verificador.verificar().pendientes()).isEqualTo(3);

        int sellados = verificador.cadena().completarPendientes();

        assertThat(sellados).isGreaterThanOrEqualTo(3);
        VerificadorCadena.Resultado r = verificador.verificar();
        assertThat(r.integra()).isTrue();
        assertThat(r.pendientes()).isZero();
        assertThat(verificador.cadena().completarPendientes()).as("idempotent").isZero();
    }
}
