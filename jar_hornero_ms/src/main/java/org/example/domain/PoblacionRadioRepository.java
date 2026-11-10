package org.example.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface PoblacionRadioRepository extends JpaRepository<PoblacionRadio, String> {

    /**
     * One grouped scan for the live vulnerability of a ronda: per radio with at least one comedor and a
     * known population, {@code (codigo_radio, habitantes, comedores, necesidades)}. Necesidades count
     * the open, not-yet-expired ones of those comedores (the "uncovered" definition of {@code findMapa}).
     * Portable SQL (no percentile_cont, derived tables instead of CTEs: H2 returned wrong counts for a
     * bound-parameter CTE): the median and the formula live in
     * {@code VulnerabilidadCalculator}.
     */
    @Query(nativeQuery = true, value = """
            SELECT com.codigo_radio, p.habitantes, com.comedores, com.necesidades
            FROM (
              SELECT o.codigo_radio AS codigo_radio, COUNT(*) AS comedores,
                     COALESCE(SUM(nec.abiertas), 0) AS necesidades
              FROM organizaciones o
              LEFT JOIN (
                SELECT n.organizacion_id AS organizacion_id, COUNT(*) AS abiertas
                FROM necesidades n
                WHERE n.estado IN (:estadosNec)
                  AND (n.fecha_vencimiento IS NULL OR n.fecha_vencimiento >= :hoy)
                GROUP BY n.organizacion_id
              ) nec ON nec.organizacion_id = o.id
              WHERE o.estado IN (:estadosOrg)
                AND o.latitud IS NOT NULL AND o.longitud IS NOT NULL AND o.codigo_radio IS NOT NULL
              GROUP BY o.codigo_radio
            ) com
            JOIN poblacion_radio p ON p.codigo_radio = com.codigo_radio
            WHERE p.habitantes > 0
            """)
    List<Object[]> zonasConComedores(@Param("estadosOrg") Collection<String> estadosOrg,
                                     @Param("estadosNec") Collection<String> estadosNec,
                                     @Param("hoy") LocalDate hoy);
}
