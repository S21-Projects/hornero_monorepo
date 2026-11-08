package org.example.notificacion;

import org.example.domain.NivelAcreditacion;
import org.example.domain.RequisitoAcreditacion;

import java.util.List;

/**
 * N13/D6: facts worth an email, published by the domain services INSIDE their transaction and
 * handled only after it commits ({@link NotificacionListener}). Events carry ids and the few
 * committed values that cannot be re-read (level change, observation), never entities: the handler
 * runs on another thread, after the persistence context is gone, and reloads what it needs.
 */
public sealed interface NotificacionEvento {

    /** A new DIRECTA donation was offered to an organization: tells its referente. */
    record DonacionOfrecida(Long donacionId) implements NotificacionEvento {
    }

    /** The referente accepted or rejected a donation: tells the donante. */
    record DonacionDecidida(Long donacionId, boolean aceptada) implements NotificacionEvento {
    }

    /** N12: an unanswered DIRECTA offer was auto-cancelled: tells the donante. */
    record DonacionVencida(Long donacionId) implements NotificacionEvento {
    }

    /** Both parties confirmed: tells the donante. */
    record EntregaConfirmada(Long donacionId) implements NotificacionEvento {
    }

    /** One ronda proposed these donations to organizations: one summary per referente. */
    record PropuestasAsignadas(List<Long> donacionIds) implements NotificacionEvento {
    }

    /** An admin approved or rejected an organization's registration: tells its referente. */
    record OrganizacionResuelta(Long organizacionId, boolean aprobada) implements NotificacionEvento {
    }

    /** The accreditation level moved (up or down): tells the referente. */
    record NivelAcreditacionCambiado(Long organizacionId, NivelAcreditacion antes, NivelAcreditacion despues,
                                     String motivo) implements NotificacionEvento {
    }

    /** An admin observed a piece of evidence: tells the referente what to fix. */
    record EvidenciaObservada(Long organizacionId, RequisitoAcreditacion requisito, String observacion)
            implements NotificacionEvento {
    }

    /** RN-04: an approved evidence expired; tells the referente and states the end of the grace period. */
    record EvidenciaVencida(Long organizacionId, RequisitoAcreditacion requisito, java.time.LocalDate vencioEl,
                            java.time.LocalDate graciaHasta) implements NotificacionEvento {
    }

    /** RN-04: one reminder, a configurable number of days before the evidence expires. */
    record EvidenciaPorVencer(Long organizacionId, RequisitoAcreditacion requisito, java.time.LocalDate venceEl)
            implements NotificacionEvento {
    }
}
