package org.example.actividad;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.repository.Repository;

/**
 * Deliberately extends {@link Repository}, not {@code JpaRepository} (same choice as
 * {@code OrganizacionEventoRepository}): no {@code delete*}, no {@code saveAll}. Append-only is
 * enforceable by reading this one file. The retention purge lives in its own interface.
 */
@org.springframework.stereotype.Repository
public interface ActividadRepository extends Repository<Actividad, Long> {

    Actividad save(Actividad actividad);

    Page<Actividad> findAll(Specification<Actividad> spec, Pageable pageable);
}
