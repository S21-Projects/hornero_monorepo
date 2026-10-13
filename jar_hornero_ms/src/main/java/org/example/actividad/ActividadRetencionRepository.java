package org.example.actividad;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

/**
 * The ONLY operation that removes activity rows: the retention purge (D12). Kept apart from
 * {@link ActividadRepository} so that interface stays insert + find only. It deletes by age and
 * nothing else; no caller can target an individual row.
 */
@org.springframework.stereotype.Repository
public interface ActividadRetencionRepository extends Repository<Actividad, Long> {

    @Modifying
    @Query("delete from Actividad a where a.ocurridoEn < :limite")
    int purgarAnterioresA(@Param("limite") Instant limite);

    /**
     * Native on purpose: the entity is {@code @Immutable} with {@code updatable = false} columns.
     * Sets only {@code email_intento} to NULL, which is all the V006 trigger accepts.
     */
    @Modifying
    @Query(value = "update actividad set email_intento = null where email_intento is not null and ocurrido_en < :limite",
            nativeQuery = true)
    int anularEmailIntentoAnterioresA(@Param("limite") Instant limite);
}
