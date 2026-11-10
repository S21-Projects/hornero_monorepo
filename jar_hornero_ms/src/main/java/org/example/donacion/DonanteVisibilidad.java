package org.example.donacion;

import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;

/**
 * Policy for the donor identity ({@code donanteName}/{@code donanteId}) on the publicly readable
 * donation endpoints (decision D5). The identity is visible only to admins, the donor of that
 * donation and the referente of the receiving organization, unless
 * {@code app.donaciones.donante-publico} is on. The organization is the one {@code toResponse}
 * resolves (via the necesidad), so an unassigned pool donation is visible to its donor and
 * admins only.
 */
@Component
public class DonanteVisibilidad {

    private final OrganizacionRepository organizacionRepository;
    private final boolean donantePublico;

    public DonanteVisibilidad(OrganizacionRepository organizacionRepository,
                              @Value("${app.donaciones.donante-publico:false}") boolean donantePublico) {
        this.organizacionRepository = organizacionRepository;
        this.donantePublico = donantePublico;
    }

    /**
     * Masker bound to the current caller. Cheap to create; the caller's organizations are
     * resolved lazily and at most once, so applying it to a whole page costs one query.
     */
    public UnaryOperator<DonacionResponse> paraLlamadaActual() {
        if (donantePublico) {
            return r -> r;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof Long id ? id : null;
        if (userId == null) {
            return DonanteVisibilidad::enmascarar;
        }
        if (tieneRol(auth, "ROLE_ADMINISTRADOR")) {
            return r -> r;
        }
        boolean referente = tieneRol(auth, "ROLE_REFERENTE");
        AtomicReference<Set<Long>> orgIds = new AtomicReference<>();
        return r -> {
            if (userId.equals(r.donanteId())) {
                return r;
            }
            if (referente && r.organizacionId() != null) {
                if (orgIds.get() == null) {
                    orgIds.set(organizacionRepository.findByReferente_Id(userId).stream()
                            .map(Organizacion::getId)
                            .collect(Collectors.toSet()));
                }
                if (orgIds.get().contains(r.organizacionId())) {
                    return r;
                }
            }
            return enmascarar(r);
        };
    }

    private static boolean tieneRol(Authentication auth, String rol) {
        for (GrantedAuthority a : auth.getAuthorities()) {
            if (rol.equals(a.getAuthority())) {
                return true;
            }
        }
        return false;
    }

    private static DonacionResponse enmascarar(DonacionResponse r) {
        return new DonacionResponse(r.id(), r.fechaOferta(), r.fechaEntrega(), r.estado(),
                r.observaciones(), null, r.necesidadId(), r.organizacionId(),
                r.necesidadDescripcion(), r.organizacionNombre(), null, r.confirmadaDonanteEn(),
                r.confirmadaReferenteEn(), r.modalidad(), r.categoria(), r.fase(), r.lineas());
    }
}
