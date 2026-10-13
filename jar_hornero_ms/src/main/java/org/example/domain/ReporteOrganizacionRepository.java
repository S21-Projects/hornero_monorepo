package org.example.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ReporteOrganizacionRepository extends JpaRepository<ReporteOrganizacion, Long> {

    Page<ReporteOrganizacion> findByEstado(EstadoReporte estado, Pageable pageable);

    List<ReporteOrganizacion> findByOrganizacion_IdAndEstado(Long organizacionId, EstadoReporte estado);

    List<ReporteOrganizacion> findByReportante_IdAndEstado(Long reportanteId, EstadoReporte estado);

    /** Every report filed by a user, any state: used by the anonymization flow. */
    List<ReporteOrganizacion> findByReportante_Id(Long reportanteId);

    long countByReportante_IdAndEstado(Long reportanteId, EstadoReporte estado);

    /** Reports a user created at or after {@code desde}, any state: the rolling-window rate limit. */
    long countByReportante_IdAndCreadoEnGreaterThanEqual(Long reportanteId, Instant desde);

    boolean existsByOrganizacion_IdAndReportante_IdAndEstado(Long organizacionId, Long reportanteId, EstadoReporte estado);
}
