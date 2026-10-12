package org.example.auth.reset;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /** Atomic single-use gate: returns 1 only for the one caller that consumed the token. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update PasswordResetToken t set t.usadoEn = :now where t.id = :id and t.usadoEn is null")
    int marcarUsado(@Param("id") Long id, @Param("now") Instant now);

    /** Voids every still-unused link of the user (a newer request or a completed reset supersedes them). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update PasswordResetToken t set t.usadoEn = :now where t.usuarioId = :usuarioId and t.usadoEn is null")
    int invalidarPendientes(@Param("usuarioId") Long usuarioId, @Param("now") Instant now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from PasswordResetToken t where t.expiraEn < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
