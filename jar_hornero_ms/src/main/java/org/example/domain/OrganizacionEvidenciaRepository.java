package org.example.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Evidencia rows are also never hard-deleted (only {@code estado} mutates), so — like
 * {@link OrganizacionEventoRepository} (AD-3) — this extends the bare {@link Repository} marker
 * interface rather than {@code JpaRepository}, declaring only {@code save}, {@code findById} and
 * the two finders the service needs. {@code findById} is a read, not an update, so it does not
 * weaken the append-only guarantee the reflection test in
 * {@code OrganizacionEvidenciaRepositoryTest} enforces.
 */
@org.springframework.stereotype.Repository
public interface OrganizacionEvidenciaRepository extends Repository<OrganizacionEvidencia, Long> {

    OrganizacionEvidencia save(OrganizacionEvidencia evidencia);

    Optional<OrganizacionEvidencia> findById(Long id);

    List<OrganizacionEvidencia> findByOrganizacion_Id(Long organizacionId);

    List<OrganizacionEvidencia> findByOrganizacion_IdAndRequisitoAndEstadoNot(
            Long organizacionId, RequisitoAcreditacion requisito, EstadoEvidencia estadoDistinto);

    /**
     * AD-12 (tesis-core-features, slice 2): backs the evidence-file access-authorization endpoint —
     * a syntactically valid {@code objectKey} under this organizacion's prefix must also match an
     * existing row, {@code REEMPLAZADA} included (legajo history stays viewable). A read, so the
     * append-only reflection test above stays green.
     */
    boolean existsByOrganizacion_IdAndObjectKey(Long organizacionId, String objectKey);

    boolean existsByOrganizacion_IdAndObjectKeyAndArchivoEliminadoAtIsNotNull(Long organizacionId, String objectKey);

    /**
     * Retention candidates: rows that still have a file and whose file is no longer needed, i.e.
     * {@code REEMPLAZADA}, or expired before {@code corte}. Oldest row first so a capped run makes
     * steady progress. A read; the job marks the rows it handled through {@code save}.
     */
    @Query("SELECT e FROM OrganizacionEvidencia e JOIN FETCH e.organizacion "
            + "WHERE e.objectKey IS NOT NULL AND e.archivoEliminadoAt IS NULL "
            + "AND (e.estado = :reemplazada OR (e.validoHasta IS NOT NULL AND e.validoHasta < :corte)) "
            + "ORDER BY e.id")
    List<OrganizacionEvidencia> buscarParaRetencion(
            @Param("reemplazada") EstadoEvidencia reemplazada,
            @Param("corte") LocalDate corte,
            Pageable pageable);

    Optional<OrganizacionEvidencia> findFirstByOrganizacion_IdAndObjectKey(Long organizacionId, String objectKey);

    /**
     * AD-8 (tesis-core-features, slice 4a): backs the cross-org audit queue. {@code vencidas =
     * true} returns any row whose {@code validoHasta} has passed regardless of {@code estado}
     * ("Vencidas" takes precedence per `specs/auditoria-cola-global/spec.md` "Pendientes vs
     * Vencidas Tabs"); {@code vencidas = false} returns only non-expired {@code PENDIENTE} rows.
     * {@code requisitos} is always a non-empty collection (all values when the caller applies no
     * {@code requisito}/{@code nivel} filter — {@code AcreditacionService} resolves that), and
     * {@code tipoEvidencia} is an optional equality filter. A read, so the append-only reflection
     * test ({@code declaresNoDeleteMethod}) stays green.
     */
    @Query(
            value = "SELECT e FROM OrganizacionEvidencia e JOIN FETCH e.organizacion o "
                    + "WHERE ("
                    + "  (:vencidas = true AND e.validoHasta IS NOT NULL AND e.validoHasta < :hoy)"
                    + "  OR (:vencidas = false AND e.estado = :estadoPendiente "
                    + "      AND (e.validoHasta IS NULL OR e.validoHasta >= :hoy))"
                    + ") "
                    + "AND e.requisito IN :requisitos "
                    + "AND (:tipoEvidencia IS NULL OR e.tipoEvidencia = :tipoEvidencia)",
            countQuery = "SELECT COUNT(e) FROM OrganizacionEvidencia e "
                    + "WHERE ("
                    + "  (:vencidas = true AND e.validoHasta IS NOT NULL AND e.validoHasta < :hoy)"
                    + "  OR (:vencidas = false AND e.estado = :estadoPendiente "
                    + "      AND (e.validoHasta IS NULL OR e.validoHasta >= :hoy))"
                    + ") "
                    + "AND e.requisito IN :requisitos "
                    + "AND (:tipoEvidencia IS NULL OR e.tipoEvidencia = :tipoEvidencia)")
    Page<OrganizacionEvidencia> buscarCola(
            @Param("vencidas") boolean vencidas,
            @Param("estadoPendiente") EstadoEvidencia estadoPendiente,
            @Param("hoy") LocalDate hoy,
            @Param("requisitos") Collection<RequisitoAcreditacion> requisitos,
            @Param("tipoEvidencia") TipoEvidencia tipoEvidencia,
            Pageable pageable);
}
