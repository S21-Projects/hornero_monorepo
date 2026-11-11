package org.example.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

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

    /** All assignments of one ronda, best score first (ties by id), with their relations fetched. */
    @Query("SELECT a FROM Asignacion a JOIN FETCH a.ronda JOIN FETCH a.donacion JOIN FETCH a.organizacion "
            + "LEFT JOIN FETCH a.necesidad WHERE a.ronda.id = :rondaId ORDER BY a.score DESC, a.id ASC")
    List<Asignacion> findByRondaIdConRelaciones(@Param("rondaId") Long rondaId);

    /**
     * The vigente (still-{@code PROPUESTA}) assignment for a donación, if any — resolved to
     * ACEPTADA/RECHAZADA/CANCELADA by {@code DonacionService} (slice 5c-ii, AD-3).
     */
    Optional<Asignacion> findFirstByDonacion_IdAndEstadoOrderByCreadaEnDesc(Long donacionId, EstadoAsignacion estado);

    /** N12: donations whose vigente (still-PROPUESTA) assignment was created before {@code corte}. */
    @Query("SELECT DISTINCT a.donacion.id FROM Asignacion a WHERE a.estado = org.example.domain.EstadoAsignacion.PROPUESTA "
            + "AND a.creadaEn < :corte")
    List<Long> findDonacionIdsConPropuestaAnteriorA(@Param("corte") Instant corte);
}
