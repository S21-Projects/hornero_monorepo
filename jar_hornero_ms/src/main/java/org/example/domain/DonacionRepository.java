package org.example.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DonacionRepository extends JpaRepository<Donacion, Long> {

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante WHERE d.necesidad.organizacion.id = :orgId")
    List<Donacion> findByOrganizacionId(@Param("orgId") Long orgId);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante WHERE d.necesidad.organizacion.referente.id = :referenteId")
    List<Donacion> findByOrganizacion_Referente_Id(@Param("referenteId") Long referenteId);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad JOIN FETCH d.necesidad.organizacion")
    List<Donacion> findAllWithDonante();

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE d.id = :id")
    Optional<Donacion> findByIdWithRelations(@Param("id") Long id);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad n JOIN FETCH n.organizacion WHERE d.donante.id = :donanteId")
    List<Donacion> findByDonante_IdWithRelations(@Param("donanteId") Long donanteId);
}
