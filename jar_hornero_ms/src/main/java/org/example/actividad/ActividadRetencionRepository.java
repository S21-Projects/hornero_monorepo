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
}
