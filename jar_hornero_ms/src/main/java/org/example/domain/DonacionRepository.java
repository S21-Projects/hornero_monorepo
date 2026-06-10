package org.example.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DonacionRepository extends JpaRepository<Donacion, Long> {

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante WHERE d.necesidad.organizacion.id = :orgId")
    List<Donacion> findByOrganizacionId(@Param("orgId") Long orgId);

    @Query("SELECT d FROM Donacion d JOIN FETCH d.donante JOIN FETCH d.necesidad JOIN FETCH d.necesidad.organizacion")
    List<Donacion> findAllWithDonante();
}
