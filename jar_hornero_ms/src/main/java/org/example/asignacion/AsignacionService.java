package org.example.asignacion;

import lombok.RequiredArgsConstructor;
import org.example.asignacion.dto.AsignacionResponse;
import org.example.domain.Asignacion;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.AsignacionRepository;
import org.example.domain.Organizacion;
import org.example.domain.Ronda;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Read-side query over {@code Asignacion} history (AD-9, spec `ronda-asignacion`): the owning
 * donante, any referente involved in the donación's assignment history, and admin may see it;
 * everyone else is denied.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AsignacionService {

    private final DonacionRepository donacionRepository;
    private final AsignacionRepository asignacionRepository;

    public List<AsignacionResponse> historial(Long donacionId, Long actorId, boolean esAdmin) {
        Donacion donacion = donacionRepository.findByIdWithRelations(donacionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"));
        List<Asignacion> asignaciones = asignacionRepository.findByDonacion_IdOrderByCreadaEnDesc(donacionId);

        if (!esAdmin && !esDonanteDueno(donacion, actorId) && !esReferenteInvolucrado(asignaciones, actorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        return asignaciones.stream().map(this::toResponse).toList();
    }

    private boolean esDonanteDueno(Donacion donacion, Long actorId) {
        return donacion.getDonante() != null && donacion.getDonante().getId().equals(actorId);
    }

    private boolean esReferenteInvolucrado(List<Asignacion> asignaciones, Long actorId) {
        return asignaciones.stream().anyMatch(a -> {
            Organizacion org = a.getOrganizacion();
            return org != null && org.getReferente() != null && org.getReferente().getId().equals(actorId);
        });
    }

    private AsignacionResponse toResponse(Asignacion a) {
        Organizacion org = a.getOrganizacion();
        Ronda ronda = a.getRonda();
        return new AsignacionResponse(
                a.getId(),
                ronda != null ? ronda.getId() : null,
                ronda != null && ronda.getEjecutadaEn() != null
                        ? ronda.getEjecutadaEn().atZone(java.time.ZoneOffset.UTC).toLocalDate() : null,
                a.getNecesidad() != null ? a.getNecesidad().getId() : null,
                org != null ? org.getId() : null,
                org != null ? org.getNombre() : null,
                a.getEstado().name(),
                a.getScore(),
                a.getCostoOportunidad(),
                a.getDistanciaKm(),
                a.getTerminoDeficit(),
                a.getTerminoUrgencia(),
                a.getTerminoProximidad(),
                a.getTerminoEspera(),
                a.getTerminoCumplimiento(),
                a.getDeficitFuente(),
                a.getCodigoRadio(),
                a.getCreadaEn(),
                a.getResueltaEn(),
                ronda != null ? ronda.getPesoDeficit() : null,
                ronda != null ? ronda.getPesoUrgencia() : null,
                ronda != null ? ronda.getPesoProximidad() : null,
                ronda != null ? ronda.getPesoEspera() : null,
                ronda != null ? ronda.getPesoCumplimiento() : null
        );
    }
}
