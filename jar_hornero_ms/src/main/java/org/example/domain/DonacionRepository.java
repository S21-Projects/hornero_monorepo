package org.example.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DonacionRepository extends JpaRepository<Donacion, Long> {

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE n.organizacion.id = :orgId")
    List<Donacion> findByOrganizacionId(@Param("orgId") Long orgId);

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
}
