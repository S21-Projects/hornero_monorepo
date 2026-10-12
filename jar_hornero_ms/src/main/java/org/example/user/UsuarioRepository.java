package org.example.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByEmail(String email);

    /** N9: one PK-index probe per authenticated request; no entity is loaded. */
    boolean existsByIdAndActivoTrue(Long id);

    /** M1: id/name/email of several users in one query (no entity loaded). */
    @Query("select u.id as id, u.nombre as nombre, u.email as email from Usuario u where u.id in :ids")
    List<UsuarioResumen> findResumenByIdIn(@Param("ids") Collection<Long> ids);

    interface UsuarioResumen {
        Long getId();

        String getNombre();

        String getEmail();
    }
}
