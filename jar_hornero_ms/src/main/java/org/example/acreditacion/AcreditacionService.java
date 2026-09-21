package org.example.acreditacion;

import lombok.RequiredArgsConstructor;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.example.user.Administrador;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Owns the accreditation ladder's transition table (AD-2), the replay-preserving write path
 * (AD-3) and, from Phase 2 onward, evidence submission/audit and legajo assembly. Phase 1 (this
 * commit) covers only the transition table and its guard — evidence methods land in Phase 2.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AcreditacionService {

    private static final Map<NivelAcreditacion, Set<NivelAcreditacion>> TRANSICIONES_PERMITIDAS =
            new EnumMap<>(NivelAcreditacion.class);

    static {
        TRANSICIONES_PERMITIDAS.put(NivelAcreditacion.N0, EnumSet.of(NivelAcreditacion.N1));
        TRANSICIONES_PERMITIDAS.put(NivelAcreditacion.N1,
                EnumSet.of(NivelAcreditacion.N0, NivelAcreditacion.N2));
        TRANSICIONES_PERMITIDAS.put(NivelAcreditacion.N2,
                EnumSet.of(NivelAcreditacion.N1, NivelAcreditacion.N3));
        TRANSICIONES_PERMITIDAS.put(NivelAcreditacion.N3, EnumSet.of(NivelAcreditacion.N2));
    }

    private final OrganizacionEventoRepository eventoRepository;

    private void validateTransition(NivelAcreditacion actual, NivelAcreditacion siguiente) {
        boolean valid = TRANSICIONES_PERMITIDAS.getOrDefault(actual, Set.of()).contains(siguiente);
        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid state transition: " + actual + " -> " + siguiente);
        }
    }

    /** Null-coalescing read: a row not yet touched by {@code AcreditacionBackfill} reads N0. */
    NivelAcreditacion nivelActual(Organizacion org) {
        return org.getNivel() == null ? NivelAcreditacion.N0 : org.getNivel();
    }

    /**
     * AD-6: keeps {@code estado}/{@code validada} as a one-function projection of {@code nivel}
     * so the public contract ({@code findBySlugPublic}, the BFF, Astro) cannot drift as a side
     * effect of a level change. {@code RECHAZADA} is preserved rather than collapsed to
     * {@code PENDIENTE}, because {@code OrganizacionService.crear} counts it to enforce the
     * 3-organizacion cap — collapsing it would silently re-open that cap for rejected orgs.
     */
    void proyectarEstadoLegacy(Organizacion org) {
        boolean acreditada = nivelActual(org).compareTo(NivelAcreditacion.N1) >= 0;
        if (acreditada) {
            org.setEstado(EstadoOrganizacion.APROBADA);
            org.setValidada(true);
        } else if (org.getEstado() != EstadoOrganizacion.RECHAZADA) {
            org.setEstado(EstadoOrganizacion.PENDIENTE);
            org.setValidada(false);
        }
    }

    /**
     * AD-3: the single writer of {@code nivel}. Validates the transition, mutates the entity,
     * re-runs the legacy projection (AD-6) and appends the corresponding event — all inside one
     * {@code @Transactional} unit, so the two cannot diverge. Package-private (not the design
     * snippet's {@code private}) so it is directly testable without reflection; still only
     * reachable from within this package.
     *
     * @param actor {@code null} records a system-originated fact (e.g. the startup backfill,
     *              AD-7), stored as {@code actorTipo = "SISTEMA"}.
     */
    @Transactional
    void aplicarTransicion(Organizacion org, NivelAcreditacion destino, Administrador actor,
                            String motivo, TipoEventoOrganizacion tipo) {
        NivelAcreditacion antes = nivelActual(org);
        validateTransition(antes, destino);
        org.setNivel(destino);
        proyectarEstadoLegacy(org);
        eventoRepository.save(OrganizacionEvento.de(org, tipo, actor, motivo, antes, destino));
    }
}
