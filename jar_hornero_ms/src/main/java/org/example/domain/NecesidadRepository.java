package org.example.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface NecesidadRepository extends JpaRepository<Necesidad, Long> {

    List<Necesidad> findByOrganizacion_Id(Long organizacionId);

    Page<Necesidad> findByOrganizacion_Id(Long organizacionId, Pageable pageable);

    /** D2/N4: public listings skip expired necesidades. */
    Page<Necesidad> findByEstadoNot(EstadoNecesidad estado, Pageable pageable);

    Page<Necesidad> findByOrganizacion_IdAndEstadoNot(Long organizacionId, EstadoNecesidad estado, Pageable pageable);

    /** `specs/organizacion-acreditacion/spec.md` "Level-Driven Concurrency Caps". */
    long countByOrganizacion_IdAndEstadoIn(Long organizacionId, Collection<EstadoNecesidad> estados);

    /**
     * Broad open-necesidad fetch for a ronda (AD-9): estado filter only. The remaining AD-9
     * eligibility predicate (not past {@code fechaVencimiento}, organización with a referente,
     * organización with coordinates, organización above N0) is applied in Java by
     * {@code RondaService}, so it stays covered by plain unit tests instead of a JPQL fixture.
     * {@code LEFT JOIN FETCH n.articulos} avoids an N+1 against {@code necesidad_articulos} when
     * {@code EntradaRondaFactory} walks each candidate's articulo ids inside the same read
     * transaction (feature catalogo-articulos); {@code DISTINCT} dedupes the parent row fan-out
     * from that one-to-many fetch.
     */
    @Query("SELECT DISTINCT n FROM Necesidad n JOIN FETCH n.organizacion o LEFT JOIN FETCH o.referente "
            + "LEFT JOIN FETCH n.articulos WHERE n.estado IN :estados")
    List<Necesidad> findByEstadoInWithOrganizacion(@Param("estados") Collection<EstadoNecesidad> estados);

    /**
     * D2/N3: bulk-moves necesidades in {@code estados} whose {@code fechaVencimiento} is strictly
     * before {@code hoy} to {@code destino}. A null {@code fechaVencimiento} never matches (never
     * expires); the boundary day itself is not expired. Returns the number of rows updated.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Necesidad n SET n.estado = :destino "
            + "WHERE n.estado IN :estados AND n.fechaVencimiento < :hoy")
    int cambiarEstadoDeVencidas(@Param("estados") Collection<EstadoNecesidad> estados,
                                @Param("hoy") LocalDate hoy,
                                @Param("destino") EstadoNecesidad destino);
}
