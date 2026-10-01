package org.example.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AsignacionRepository extends JpaRepository<Asignacion, Long> {

    /**
     * Orgs the ronda must exclude for this donación (AD-9): a rejected/devuelta assignment
     * ({@link EstadoAsignacion#RECHAZADA}) does not offer the same organización a second chance at
     * the same donación in a later ronda.
     */
    @Query("SELECT a.organizacion.id FROM Asignacion a WHERE a.donacion.id = :donacionId AND a.estado = :estado")
    List<Long> findOrganizacionIdsByDonacionIdAndEstado(@Param("donacionId") Long donacionId,
                                                          @Param("estado") EstadoAsignacion estado);

    List<Asignacion> findByDonacion_IdOrderByCreadaEnDesc(Long donacionId);
}
