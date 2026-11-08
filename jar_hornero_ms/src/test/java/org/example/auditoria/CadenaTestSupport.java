package org.example.auditoria;

import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** Fixtures shared by the hash-chain tests. */
final class CadenaTestSupport {

    private CadenaTestSupport() {
    }

    static Organizacion organizacion(OrganizacionRepository repo, String prefijo) {
        Organizacion o = new Organizacion();
        o.setNombre(prefijo + " " + System.nanoTime());
        o.setSlug(prefijo.toLowerCase().replace(' ', '-') + "-" + System.nanoTime());
        o.setEstado(EstadoOrganizacion.PENDIENTE);
        o.setNivel(NivelAcreditacion.N0);
        return repo.save(o);
    }

    static OrganizacionEvento evento(OrganizacionEventoRepository repo, Organizacion org, String motivo) {
        return repo.save(OrganizacionEvento.de(org, TipoEventoOrganizacion.REFERENTE_REASIGNADO, null, motivo, null, null));
    }

    /** Inserts a row the way a pre-chain version of the MS did: no prev_hash, no hash. */
    static long insertarSinHash(JdbcTemplate jdbc, long orgId, String motivo) {
        Instant ahora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        jdbc.update("insert into organizacion_evento (organizacion_id, tipo, ocurrido_en, actor_tipo, motivo) "
                        + "values (?, 'REFERENTE_REASIGNADO', ?, 'SISTEMA', ?)",
                orgId, OffsetDateTime.ofInstant(ahora, ZoneOffset.UTC), motivo);
        return jdbc.queryForObject("select max(id) from organizacion_evento where organizacion_id = ?", Long.class, orgId);
    }

    static List<Long> ids(JdbcTemplate jdbc, long orgId) {
        return jdbc.queryForList("select id from organizacion_evento where organizacion_id = ? order by id", Long.class, orgId);
    }
}
