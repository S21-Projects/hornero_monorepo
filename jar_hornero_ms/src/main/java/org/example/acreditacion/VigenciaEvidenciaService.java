package org.example.acreditacion;

import org.example.domain.EstadoEvidencia;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.OrganizacionEvidenciaRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.example.notificacion.NotificacionEvento;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * RN-04 work units, one transaction each (called by {@link EvidenciaVigenciaJob} through this
 * proxy). {@link #vencer} moves one APROBADA row to VENCIDA and appends an {@code EVIDENCIA_VENCIDA}
 * event with actor SISTEMA through the sealed chain; the event log is insert-only, so only the
 * row state is updated. Nothing here touches the organization's level or its needs.
 */
@Service
public class VigenciaEvidenciaService {

    private final OrganizacionEvidenciaRepository evidenciaRepository;
    private final OrganizacionEventoRepository eventoRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;
    private final int graciaDias;
    private final int recordatorioDias;

    public VigenciaEvidenciaService(
            OrganizacionEvidenciaRepository evidenciaRepository,
            OrganizacionEventoRepository eventoRepository,
            ApplicationEventPublisher eventPublisher,
            Clock clock,
            @Value("${app.evidencia.vigencia.gracia-dias:30}") int graciaDias,
            @Value("${app.evidencia.vigencia.recordatorio-dias:30}") int recordatorioDias) {
        this.evidenciaRepository = evidenciaRepository;
        this.eventoRepository = eventoRepository;
        this.eventPublisher = eventPublisher;
        this.clock = clock;
        this.graciaDias = Math.max(0, graciaDias);
        this.recordatorioDias = Math.max(0, recordatorioDias);
    }

    private LocalDate hoy() {
        return LocalDate.now(clock);
    }

    @Transactional(readOnly = true)
    public List<Long> idsParaVencer() {
        return evidenciaRepository.findIdsAprobadasVencidasAntesDe(EstadoEvidencia.APROBADA, hoy());
    }

    /** Returns true when the row was moved; false when it is no longer an expired APROBADA row (idempotent). */
    @Transactional
    public boolean vencer(Long evidenciaId) {
        OrganizacionEvidencia e = evidenciaRepository.findById(evidenciaId).orElse(null);
        LocalDate hoy = hoy();
        if (e == null || e.getEstado() != EstadoEvidencia.APROBADA || e.getValidoHasta() == null
                || !e.getValidoHasta().isBefore(hoy)) {
            return false;
        }
        e.setEstado(EstadoEvidencia.VENCIDA);
        evidenciaRepository.save(e);
        LocalDate graciaHasta = VigenciaEvidencia.finDeGracia(e.getValidoHasta(), graciaDias);
        eventoRepository.save(OrganizacionEvento.deEvidencia(e.getOrganizacion(),
                TipoEventoOrganizacion.EVIDENCIA_VENCIDA, null,
                "Evidencia vencida el " + e.getValidoHasta() + " para " + e.getRequisito()
                        + "; gracia hasta " + graciaHasta,
                e.getRequisito(), e.getId()));
        eventPublisher.publishEvent(new NotificacionEvento.EvidenciaVencida(
                e.getOrganizacion().getId(), e.getRequisito(), e.getValidoHasta(), graciaHasta));
        return true;
    }

    @Transactional(readOnly = true)
    public List<Long> idsParaRecordar() {
        if (recordatorioDias == 0) {
            return List.of();
        }
        LocalDate hoy = hoy();
        return evidenciaRepository.findIdsParaRecordatorio(EstadoEvidencia.APROBADA, hoy, hoy.plusDays(recordatorioDias));
    }

    /** Sends the single reminder of a row and remembers it; false when already sent or no longer due. */
    @Transactional
    public boolean recordar(Long evidenciaId) {
        OrganizacionEvidencia e = evidenciaRepository.findById(evidenciaId).orElse(null);
        LocalDate hoy = hoy();
        if (e == null || e.getEstado() != EstadoEvidencia.APROBADA || e.getRecordatorioVencimientoAt() != null
                || e.getValidoHasta() == null || e.getValidoHasta().isBefore(hoy)
                || e.getValidoHasta().isAfter(hoy.plusDays(recordatorioDias))) {
            return false;
        }
        e.setRecordatorioVencimientoAt(Instant.now(clock));
        evidenciaRepository.save(e);
        eventPublisher.publishEvent(new NotificacionEvento.EvidenciaPorVencer(
                e.getOrganizacion().getId(), e.getRequisito(), e.getValidoHasta()));
        return true;
    }
}
