package org.example.auth.otp;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CodigoVerificacionRepository extends JpaRepository<CodigoVerificacion, Long> {

    Optional<CodigoVerificacion> findTopByEmailAndUsadoFalseOrderByCreadoEnDesc(String email);

    /** N15: the issued codes keep the plain email; erasing the account removes them. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from CodigoVerificacion c where lower(c.email) = lower(:email)")
    int deleteByEmailIgnoreCase(@Param("email") String email);
}
