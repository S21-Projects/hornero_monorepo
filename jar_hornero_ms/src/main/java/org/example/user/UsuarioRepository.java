package org.example.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
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

    /** N15: guard rail against anonymizing the last administrator able to sign in. */
    @Query("select count(a) from Administrador a where a.activo = true")
    long countAdministradoresActivos();

    /** N13: recipients of the daily digest (the caller also requires a verified email). */
    @Query("select a from Administrador a where a.activo = true")
    List<Administrador> findAdministradoresActivos();

    /** M1: id/name/email of several users in one query (no entity loaded). */
    @Query("select u.id as id, u.nombre as nombre, u.email as email from Usuario u where u.id in :ids")
    List<UsuarioResumen> findResumenByIdIn(@Param("ids") Collection<Long> ids);

    interface UsuarioResumen {
        Long getId();

        String getNombre();

        String getEmail();
    }

    /**
     * Row lock (SELECT ... FOR UPDATE) on the user. Taken before counting a referente's
     * organizaciones so two transactions assigning different organizaciones to the same referente
     * serialize on this row instead of both passing the cap check.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.id = :id")
    Optional<Usuario> findByIdForUpdate(@Param("id") Long id);
}
