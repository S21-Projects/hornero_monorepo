package org.example.asignacion;

import lombok.RequiredArgsConstructor;
import org.example.asignacion.dto.AsignacionResponse;
import org.example.asignacion.dto.AsignacionRondaResponse;
import org.example.domain.DonacionLinea;
import org.example.domain.Necesidad;
import org.example.domain.RondaRepository;
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
    private final RondaRepository rondaRepository;

    public List<AsignacionResponse> historial(Long donacionId, Long actorId, boolean esAdmin) {
        Donacion donacion = donacionRepository.findByIdWithRelations(donacionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Donacion not found"));
        List<Asignacion> asignaciones = asignacionRepository.findByDonacion_IdOrderByCreadaEnDesc(donacionId);

        if (!esAdmin && !esDonanteDueno(donacion, actorId) && !esReferenteInvolucrado(asignaciones, actorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        return asignaciones.stream().map(this::toResponse).toList();
    }

    /**
     * {@code GET /api/rondas/{id}/asignaciones}: every assignment of the ronda, best score first
     * (ties by id). 404 when the ronda does not exist; an existing ronda without assignments yields [].
     */
    public List<AsignacionRondaResponse> porRonda(Long rondaId) {
        if (!rondaRepository.existsById(rondaId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ronda not found");
        }
        return asignacionRepository.findByRondaIdConRelaciones(rondaId).stream().map(a -> {
            Donacion d = a.getDonacion();
            Necesidad n = a.getNecesidad();
            return new AsignacionRondaResponse(
                    toResponse(a),
                    d.getId(),
                    describir(d),
                    n != null ? n.getDescripcion() : null);
        }).toList();
    }

    private static String describir(Donacion d) {
        if (d.getLineas() == null || d.getLineas().isEmpty()) {
            return null;
        }
        return d.getLineas().stream()
                .map((DonacionLinea l) -> l.getArticulo().getNombre() + " x"
                        + l.getCantidad().stripTrailingZeros().toPlainString())
                .collect(java.util.stream.Collectors.joining(", "));
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
