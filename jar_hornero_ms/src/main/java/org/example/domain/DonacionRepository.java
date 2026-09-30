package org.example.domain;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface DonacionRepository extends JpaRepository<Donacion, Long> {

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE n.organizacion.id = :orgId")
    List<Donacion> findByOrganizacionId(@Param("orgId") Long orgId);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante WHERE d.necesidad.organizacion.referente.id = :referenteId")
    List<Donacion> findByOrganizacion_Referente_Id(@Param("referenteId") Long referenteId);

    @Query(
            value = "SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE n.organizacion.id = :orgId",
            countQuery = "SELECT COUNT(d) FROM Donacion d WHERE d.necesidad.organizacion.id = :orgId"
    )
    Page<Donacion> findByOrganizacionId(@Param("orgId") Long orgId, Pageable pageable);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad JOIN FETCH d.necesidad.organizacion")
    List<Donacion> findAllWithDonante();

    @Query(
            value = "SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion",
            countQuery = "SELECT COUNT(d) FROM Donacion d"
    )
    Page<Donacion> findAllWithDonante(Pageable pageable);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE d.id = :id")
    Optional<Donacion> findByIdWithRelations(@Param("id") Long id);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE d.donante.id = :donanteId")
    List<Donacion> findByDonante_IdWithRelations(@Param("donanteId") Long donanteId);

    @Query(
            value = "SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE d.donante.id = :donanteId",
            countQuery = "SELECT COUNT(d) FROM Donacion d WHERE d.donante.id = :donanteId"
    )
    Page<Donacion> findByDonante_IdWithRelations(@Param("donanteId") Long donanteId, Pageable pageable);

    @Query(
            value = """
                SELECT d FROM Donacion d
                  JOIN FETCH d.donante dn
                  JOIN FETCH d.necesidad n
                  JOIN FETCH n.organizacion o
                WHERE d.estado IN :estados
                  AND (:q IS NULL OR :q = ''
                    OR LOWER(o.nombre)       LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(dn.nombre)      LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(n.descripcion)  LIKE LOWER(CONCAT('%', :q, '%'))
                    OR CAST(d.id AS string) = :q)
                """,
            countQuery = """
                SELECT COUNT(d) FROM Donacion d
                WHERE d.estado IN :estados
                  AND (:q IS NULL OR :q = ''
                    OR LOWER(d.necesidad.organizacion.nombre) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(d.donante.nombre)                LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(d.necesidad.descripcion)         LIKE LOWER(CONCAT('%', :q, '%'))
                    OR CAST(d.id AS string) = :q)
                """
    )
    Page<Donacion> findActivas(@Param("estados") Collection<EstadoDonacion> estados,
                                @Param("q") String q, Pageable pageable);

    /**
     * Row-locks the donación for the duration of the transaction (AD-6/AD-9). Required by
     * {@code EntregaService.verificar}: without this lock, two concurrent verifications each read
     * "the other party hasn't confirmed yet" and the donación can get stuck at
     * {@code PENDIENTE_CONFIRMACION} forever instead of reaching {@code ENTREGADA} exactly once.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE d.id = :id")
    Optional<Donacion> findByIdForUpdate(@Param("id") Long id);
}
