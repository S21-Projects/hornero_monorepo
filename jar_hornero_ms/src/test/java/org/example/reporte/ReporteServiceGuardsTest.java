package org.example.reporte;

import org.example.acreditacion.AcreditacionService;
import org.example.actividad.ActividadService;
import org.example.auth.VerificacionService;
import org.example.reclamo.ReclamoService;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.MotivoReporte;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.ReporteOrganizacion;
import org.example.domain.ReporteOrganizacionRepository;
import org.example.reporte.dto.CrearReporteRequest;
import org.example.user.Donante;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** DB-only race that H2 slices cannot reproduce: the ux_reporte_pendiente unique index (V009). */
class ReporteServiceGuardsTest {

    private final ReporteOrganizacionRepository reporteRepository = mock(ReporteOrganizacionRepository.class);
    private final OrganizacionRepository organizacionRepository = mock(OrganizacionRepository.class);
    private final UsuarioRepository usuarioRepository = mock(UsuarioRepository.class);
    private final ReporteService service = new ReporteService(reporteRepository, organizacionRepository,
            usuarioRepository, mock(AcreditacionService.class), mock(ActividadService.class),
            mock(VerificacionService.class), mock(ReporteCierre.class),
            mock(ReclamoService.class), java.time.Clock.systemUTC(), LimitesReporte.POR_DEFECTO);

    @Test
    void crear_whenTheUniqueIndexRejectsAConcurrentDuplicate_is409() {
        Organizacion o = new Organizacion();
        o.setId(4L);
        o.setNombre("Comedor");
        o.setEstado(EstadoOrganizacion.SIN_RECLAMAR);
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(new Donante(7L, "Dona", "d@test.com", "x", true)));
        when(organizacionRepository.findById(4L)).thenReturn(Optional.of(o));
        when(reporteRepository.existsByOrganizacion_IdAndReportante_IdAndEstado(any(), any(), any())).thenReturn(false);
        when(reporteRepository.saveAndFlush(any(ReporteOrganizacion.class)))
                .thenThrow(new DataIntegrityViolationException("ux_reporte_pendiente"));

        assertThatThrownBy(() -> service.crear(new CrearReporteRequest(4L, MotivoReporte.INACTIVO, null, null), 7L))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).isEqualTo(ReporteService.MSG_REPORTE_PENDIENTE);
                });
    }

    @Test
    void crear_rethrowsAnyOtherIntegrityViolation_insteadOfCallingItAPendingDuplicate() {
        Organizacion o = new Organizacion();
        o.setId(4L);
        o.setNombre("Comedor");
        o.setEstado(EstadoOrganizacion.SIN_RECLAMAR);
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(new Donante(7L, "Dona", "d@test.com", "x", true)));
        when(organizacionRepository.findById(4L)).thenReturn(Optional.of(o));
        DataIntegrityViolationException otra = new DataIntegrityViolationException("value too long for column detalle");
        when(reporteRepository.saveAndFlush(any(ReporteOrganizacion.class))).thenThrow(otra);

        assertThatThrownBy(() -> service.crear(new CrearReporteRequest(4L, MotivoReporte.INACTIVO, null, null), 7L))
                .isSameAs(otra);
    }

    @Test
    void crear_recognisesTheIndexNameInTheCauseChain() {
        Organizacion o = new Organizacion();
        o.setId(4L);
        o.setNombre("Comedor");
        o.setEstado(EstadoOrganizacion.SIN_RECLAMAR);
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(new Donante(7L, "Dona", "d@test.com", "x", true)));
        when(organizacionRepository.findById(4L)).thenReturn(Optional.of(o));
        when(reporteRepository.saveAndFlush(any(ReporteOrganizacion.class))).thenThrow(
                new DataIntegrityViolationException("could not execute statement",
                        new RuntimeException("duplicate key value violates unique constraint \"UX_REPORTE_PENDIENTE\"")));

        assertThatThrownBy(() -> service.crear(new CrearReporteRequest(4L, MotivoReporte.INACTIVO, null, null), 7L))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }
}
