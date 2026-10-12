package org.example.domain;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface DonacionRepository extends JpaRepository<Donacion, Long> {

    /**
     * Unassigned pool donations at ronda-trigger time (AD-9): {@code FONDO_COMUN}, still
     * {@code OFRECIDA}, {@code necesidad IS NULL}. {@code LEFT JOIN FETCH d.lineas} avoids an N+1
     * against {@code donacion_lineas} when {@code EntradaRondaFactory} walks each donación's
     * articulo ids inside the same read transaction (feature catalogo-articulos); {@code DISTINCT}
     * dedupes the parent row fan-out from that one-to-many fetch.
     */
    @Query("SELECT DISTINCT d FROM Donacion d LEFT JOIN FETCH d.lineas "
            + "WHERE d.modalidad = :modalidad AND d.estado = :estado AND d.necesidad IS NULL")
    List<Donacion> findByModalidadAndEstadoAndNecesidadIsNull(@Param("modalidad") ModalidadDonacion modalidad,
                                                                @Param("estado") EstadoDonacion estado);

    /**
     * `diasDesdeUltimaDonacion` input (AD-9): latest {@code fechaOferta} of any donation — direct or
     * pool, once assigned — to this organización's necesidades, excluding {@code CANCELADA}/
     * {@code RECHAZADA}. Empty when the organización has no counted history.
     */
    @Query("SELECT MAX(d.fechaOferta) FROM Donacion d "
            + "WHERE d.necesidad.organizacion.id = :organizacionId AND d.estado NOT IN :excluidos")
    Optional<LocalDate> findUltimaFechaOfertaPorOrganizacion(@Param("organizacionId") Long organizacionId,
                                                              @Param("excluidos") Collection<EstadoDonacion> excluidos);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE n.organizacion.id = :orgId")
    List<Donacion> findByOrganizacionId(@Param("orgId") Long orgId);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante WHERE d.necesidad.organizacion.referente.id = :referenteId")
    List<Donacion> findByOrganizacion_Referente_Id(@Param("referenteId") Long referenteId);

    @Query(
            value = "SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE n.organizacion.id = :orgId",
            countQuery = "SELECT COUNT(d) FROM Donacion d WHERE d.necesidad.organizacion.id = :orgId"
    )
    Page<Donacion> findByOrganizacionId(@Param("orgId") Long orgId, Pageable pageable);

    // LEFT JOIN FETCH (slice 5b): an unassigned FONDO_COMUN donación has necesidad == null and must
    // still be returned, not silently dropped by an inner JOIN FETCH
    // (`specs/donacion-fondo-comun/spec.md` "Reading an unassigned pool donation does not error").
    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante LEFT JOIN FETCH d.necesidad n LEFT JOIN FETCH n.organizacion")
    List<Donacion> findAllWithDonante();

    @Query(
            value = "SELECT d FROM Donacion d JOIN FETCH d.donante LEFT JOIN FETCH d.necesidad n LEFT JOIN FETCH n.organizacion",
            countQuery = "SELECT COUNT(d) FROM Donacion d"
    )
    Page<Donacion> findAllWithDonante(Pageable pageable);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante LEFT JOIN FETCH d.necesidad n LEFT JOIN FETCH n.organizacion WHERE d.id = :id")
    Optional<Donacion> findByIdWithRelations(@Param("id") Long id);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante LEFT JOIN FETCH d.necesidad n LEFT JOIN FETCH n.organizacion WHERE d.donante.id = :donanteId")
    List<Donacion> findByDonante_IdWithRelations(@Param("donanteId") Long donanteId);

    @Query(
            value = "SELECT d FROM Donacion d JOIN FETCH d.donante LEFT JOIN FETCH d.necesidad n LEFT JOIN FETCH n.organizacion WHERE d.donante.id = :donanteId",
            countQuery = "SELECT COUNT(d) FROM Donacion d WHERE d.donante.id = :donanteId"
    )
    Page<Donacion> findByDonante_IdWithRelations(@Param("donanteId") Long donanteId, Pageable pageable);

    @Query(
            value = """
                SELECT d FROM Donacion d
                  JOIN FETCH d.donante dn
                  LEFT JOIN FETCH d.necesidad n
                  LEFT JOIN FETCH n.organizacion o
                WHERE d.estado IN :estados
                  AND (:q IS NULL OR :q = ''
                    OR LOWER(o.nombre)       LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(dn.nombre)      LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(n.descripcion)  LIKE LOWER(CONCAT('%', :q, '%'))
                    OR CAST(d.id AS string) = :q)
                  AND (:soloEstancadas = false
                    OR (d.estado IN (org.example.domain.EstadoDonacion.ACEPTADA, org.example.domain.EstadoDonacion.EN_CAMINO)
                        AND (d.estadoDesde < :corteEnCurso
                             OR (d.estadoDesde IS NULL AND d.fechaOferta <= :fechaEnCurso)))
                    OR (d.estado = org.example.domain.EstadoDonacion.PENDIENTE_CONFIRMACION
                        AND (d.estadoDesde < :corteConfirmacion
                             OR (d.estadoDesde IS NULL AND d.fechaOferta <= :fechaConfirmacion))))
                """,
            countQuery = """
                SELECT COUNT(d) FROM Donacion d
                  LEFT JOIN d.necesidad n
                  LEFT JOIN n.organizacion o
                WHERE d.estado IN :estados
                  AND (:q IS NULL OR :q = ''
                    OR LOWER(o.nombre)        LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(d.donante.nombre) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(n.descripcion)   LIKE LOWER(CONCAT('%', :q, '%'))
                    OR CAST(d.id AS string) = :q)
                  AND (:soloEstancadas = false
                    OR (d.estado IN (org.example.domain.EstadoDonacion.ACEPTADA, org.example.domain.EstadoDonacion.EN_CAMINO)
                        AND (d.estadoDesde < :corteEnCurso
                             OR (d.estadoDesde IS NULL AND d.fechaOferta <= :fechaEnCurso)))
                    OR (d.estado = org.example.domain.EstadoDonacion.PENDIENTE_CONFIRMACION
                        AND (d.estadoDesde < :corteConfirmacion
                             OR (d.estadoDesde IS NULL AND d.fechaOferta <= :fechaConfirmacion))))
                """
    )
    Page<Donacion> findActivas(@Param("estados") Collection<EstadoDonacion> estados,
                                @Param("q") String q,
                                @Param("soloEstancadas") boolean soloEstancadas,
                                @Param("corteEnCurso") Instant corteEnCurso,
                                @Param("fechaEnCurso") LocalDate fechaEnCurso,
                                @Param("corteConfirmacion") Instant corteConfirmacion,
                                @Param("fechaConfirmacion") LocalDate fechaConfirmacion,
                                Pageable pageable);

    /**
     * N12: ids of {@code DIRECTA} (or legacy null-modalidad) donations still {@code OFRECIDA} since
     * before {@code corte}. A null {@code estadoDesde} (row predating the column) falls back to
     * {@code fechaOferta <= fechaCorte}; the caller re-checks exactly under the row lock.
     */
    @Query("SELECT d.id FROM Donacion d WHERE d.estado = org.example.domain.EstadoDonacion.OFRECIDA "
            + "AND (d.modalidad IS NULL OR d.modalidad = org.example.domain.ModalidadDonacion.DIRECTA) "
            + "AND (d.estadoDesde < :corte OR (d.estadoDesde IS NULL AND d.fechaOferta <= :fechaCorte))")
    List<Long> findIdsOfrecidasDirectasDesde(@Param("corte") Instant corte, @Param("fechaCorte") LocalDate fechaCorte);

    /**
     * Row-locks the donación for the duration of the transaction (AD-6/AD-9). Required by
     * {@code EntregaService.verificar}: without this lock, two concurrent verifications each read
     * "the other party hasn't confirmed yet" and the donación can get stuck at
     * {@code PENDIENTE_CONFIRMACION} forever instead of reaching {@code ENTREGADA} exactly once.
     *
     * <p>Locks only the donación row, with no fetch joins: an unassigned FONDO_COMUN donación has
     * no necesidad (an inner join would hide it from the ronda write phase), and Postgres rejects
     * {@code FOR UPDATE} on the nullable side of an outer join. Relations load lazily inside the
     * caller's transaction.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM Donacion d WHERE d.id = :id")
    Optional<Donacion> findByIdForUpdate(@Param("id") Long id);

    /**
     * Compliance-history aggregate backing {@code CumplimientoCalculator} (AD-11, slice 6b): one
     * grouped count per {@code (organizacion.id, estado)}, restricted to {@code ENTREGADA}/
     * {@code RECHAZADA} only. A pool donación with {@code necesidad IS NULL} is excluded by the
     * inner join; {@code CANCELADA} and non-terminal donaciones are excluded by the estado filter.
     */
    @Query("SELECT n.organizacion.id, d.estado, COUNT(d) FROM Donacion d JOIN d.necesidad n "
            + "WHERE d.estado IN :estados GROUP BY n.organizacion.id, d.estado")
    List<Object[]> contarPorOrganizacionYEstado(@Param("estados") Collection<EstadoDonacion> estados);
}
