package org.example.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByEmail(String email);

    /** N9: one PK-index probe per authenticated request; no entity is loaded. */
    boolean existsByIdAndActivoTrue(Long id);
}
