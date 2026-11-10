package org.example.idempotencia;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

public interface IdempotenciaRepository extends JpaRepository<ClaveIdempotencia, Long> {

    Optional<ClaveIdempotencia> findByUsuarioIdAndClaveAndOperacion(Long usuarioId, String clave, String operacion);

    /**
     * Takes over a key that no longer protects anything: an {@code EN_PROCESO} row whose owner
     * most likely crashed ({@code creadaEn < limiteAbandono}) or any row past its expiry. The
     * conditional update is atomic, so only one concurrent retry wins it.
     */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("""
            update ClaveIdempotencia c
               set c.estado = :enProceso, c.huella = :huella, c.creadaEn = :ahora, c.expiraEn = :expiraEn,
                   c.respuestaStatus = null, c.respuestaBody = null
             where c.id = :id
               and ((c.estado = :enProceso and c.creadaEn < :limiteAbandono) or c.expiraEn < :ahora)
            """)
    int reclamar(@Param("id") Long id, @Param("huella") String huella, @Param("ahora") Instant ahora,
                 @Param("expiraEn") Instant expiraEn, @Param("limiteAbandono") Instant limiteAbandono,
                 @Param("enProceso") EstadoIdempotencia enProceso);

    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("""
            update ClaveIdempotencia c
               set c.estado = :completada, c.respuestaStatus = :status, c.respuestaBody = :body
             where c.id = :id and c.estado = :enProceso
            """)
    int completar(@Param("id") Long id, @Param("status") int status, @Param("body") String body,
                  @Param("completada") EstadoIdempotencia completada,
                  @Param("enProceso") EstadoIdempotencia enProceso);

    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("delete from ClaveIdempotencia c where c.id = :id")
    int liberar(@Param("id") Long id);

    /** N15: stored responses may echo the user's data; erasing the account removes the user's keys. */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ClaveIdempotencia c where c.usuarioId = :usuarioId")
    int deleteByUsuarioId(@Param("usuarioId") Long usuarioId);

    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("delete from ClaveIdempotencia c where c.expiraEn < :ahora")
    int purgarExpiradas(@Param("ahora") Instant ahora);
}
