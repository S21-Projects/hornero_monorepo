package org.example.domain;

import org.springframework.data.repository.Repository;

import java.util.Collection;
import java.util.List;

/**
 * Deliberately extends {@link Repository}, not {@code JpaRepository} (AD-3): that interface would
 * hand every caller {@code delete}, {@code deleteAll}, {@code deleteById} and {@code saveAll}.
 * Declaring only {@code save} (implemented by {@link OrganizacionEventoSellado}, which seals the hash
 * chain) and two finders makes append-only enforceable by reading one file.
 */
@org.springframework.stereotype.Repository
public interface OrganizacionEventoRepository
        extends Repository<OrganizacionEvento, Long>, OrganizacionEventoSellado {

    /** Implemented by {@link OrganizacionEventoSellado}: seals the hash chain, then inserts. */
    @Override
    OrganizacionEvento save(OrganizacionEvento evento);

    List<OrganizacionEvento> findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(Long organizacionId);

    List<OrganizacionEvento> findByOrganizacion_IdAndTipoIn(
            Long organizacionId, Collection<TipoEventoOrganizacion> tipos);
}
