package org.example.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizacionRepository extends JpaRepository<Organizacion, Long> {

    List<Organizacion> findByValidada(boolean validada);

    Optional<Organizacion> findByReferente_Id(Long referenteId);

    Optional<Organizacion> findBySlug(String slug);
}
