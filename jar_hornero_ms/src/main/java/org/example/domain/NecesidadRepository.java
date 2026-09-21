package org.example.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface NecesidadRepository extends JpaRepository<Necesidad, Long> {

    List<Necesidad> findByOrganizacion_Id(Long organizacionId);

    Page<Necesidad> findByOrganizacion_Id(Long organizacionId, Pageable pageable);

    /** `specs/organizacion-acreditacion/spec.md` "Level-Driven Concurrency Caps". */
    long countByOrganizacion_IdAndEstadoIn(Long organizacionId, Collection<EstadoNecesidad> estados);
}
