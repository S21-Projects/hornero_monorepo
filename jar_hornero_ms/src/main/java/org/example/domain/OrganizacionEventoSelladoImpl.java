package org.example.domain;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.example.auditoria.CadenaEventos;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;

/** See {@link OrganizacionEventoSellado}. */
public class OrganizacionEventoSelladoImpl implements OrganizacionEventoSellado {

    @PersistenceContext
    private EntityManager em;

    private final CadenaEventos cadena;

    /**
     * Built from the two infrastructure beans rather than injecting the {@code CadenaEventos}
     * component, so that JPA test slices (which do not scan components) can still create the
     * repository. {@code CadenaEventos} holds no state.
     */
    public OrganizacionEventoSelladoImpl(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
        this.cadena = new CadenaEventos(jdbc, transactionManager);
    }

    @Override
    @Transactional
    public OrganizacionEvento save(OrganizacionEvento evento) {
        cadena.sellar(evento);
        em.persist(evento);
        return evento;
    }
}
