package org.example.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NecesidadRepository extends JpaRepository<Necesidad, Long> {
}
