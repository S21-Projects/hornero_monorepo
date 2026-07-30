package org.example.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizacionRepository extends JpaRepository<Organizacion, Long> {

    List<Organizacion> findByEstado(EstadoOrganizacion estado);

    Page<Organizacion> findByEstado(EstadoOrganizacion estado, Pageable pageable);

    List<Organizacion> findByReferente_Id(Long referenteId);

    Optional<Organizacion> findByIdAndReferente_Id(Long id, Long referenteId);

    long countByReferente_IdAndEstadoNot(Long referenteId, EstadoOrganizacion estado);

    List<Organizacion> findByReferenteIsNull();

    Optional<Organizacion> findBySlug(String slug);
}
