package org.example.reporte;

import lombok.RequiredArgsConstructor;
import org.example.acreditacion.AcreditacionService;
import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.domain.EstadoReporte;
import org.example.domain.ReporteOrganizacion;
import org.example.domain.ReporteOrganizacionRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.example.user.Administrador;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Discarding a report, shared by the manual path ({@link ReporteService#descartar}) and the
 * automatic one (a claim on the organizacion was approved), so both write the same events and
 * activity. Joins the caller's transaction.
 */
@Component
@RequiredArgsConstructor
public class ReporteCierre {

    public static final String NOTA_RECLAMADA = "La organización fue reclamada";

    private final ReporteOrganizacionRepository reporteRepository;
    private final AcreditacionService acreditacionService;
    private final ActividadService actividadService;

    @Transactional
    public void descartar(ReporteOrganizacion reporte, Administrador admin, String nota) {
        reporte.setEstado(EstadoReporte.DESCARTADO);
        reporte.setNotaResolucion(nota);
        reporte.setResueltoPor(admin);
        reporte.setResueltoEn(Instant.now());
        reporteRepository.save(reporte);
        acreditacionService.registrarResolucionReclamo(reporte.getOrganizacion(),
                TipoEventoOrganizacion.REPORTE_DESCARTADO, admin,
                "Reporte #" + reporte.getId() + " descartado: " + nota);
        actividadService.registrar(Registro.de(TipoActividad.REPORTE_DESCARTADO)
                .entidad("REPORTE", reporte.getId()).detalle(reporte.getOrganizacion().getNombre())
                .actor(admin).motivo(nota).cambio(EstadoReporte.PENDIENTE, EstadoReporte.DESCARTADO));
    }

    /** Discards every PENDIENTE report on an organizacion (it was just claimed). */
    @Transactional
    public void descartarPendientes(Long organizacionId, Administrador admin, String nota) {
        for (ReporteOrganizacion r : reporteRepository
                .findByOrganizacion_IdAndEstado(organizacionId, EstadoReporte.PENDIENTE)) {
            descartar(r, admin, nota);
        }
    }

    /** Discards every PENDIENTE report filed by a reportante whose account was anonymized. */
    @Transactional
    public void descartarPendientesDeReportante(Long reportanteId, Administrador admin, String nota) {
        for (ReporteOrganizacion r : reporteRepository
                .findByReportante_IdAndEstado(reportanteId, EstadoReporte.PENDIENTE)) {
            descartar(r, admin, nota);
        }
    }
}
