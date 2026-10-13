package org.example.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReporteOrganizacionRepository extends JpaRepository<ReporteOrganizacion, Long> {

    Page<ReporteOrganizacion> findByEstado(EstadoReporte estado, Pageable pageable);

    List<ReporteOrganizacion> findByOrganizacion_IdAndEstado(Long organizacionId, EstadoReporte estado);

    long countByReportante_IdAndEstado(Long reportanteId, EstadoReporte estado);

    boolean existsByOrganizacion_IdAndReportante_IdAndEstado(Long organizacionId, Long reportanteId, EstadoReporte estado);
}
