package org.example.asignacion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.example.asignacion.dto.AsignacionResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Assignment history for a single donación (AD-9, spec `ronda-asignacion`): owner donante, any
 * referente involved in the donación's assignment history, and admin — never an unrelated actor.
 */
@Tag(name = "Asignaciones", description = "Assignment history for one donación")
@RestController
@RequestMapping("/api/donaciones/{id}/asignaciones")
@RequiredArgsConstructor
public class AsignacionController {

    private final AsignacionService asignacionService;

    @Operation(summary = "Assignment history for a donación (owner donante, involved referente, admin)")
    @GetMapping
    @PreAuthorize("hasAnyRole('DONANTE', 'REFERENTE', 'ADMINISTRADOR')")
    public List<AsignacionResponse> historial(@PathVariable Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long actorId = (Long) auth.getPrincipal();
        boolean esAdmin = auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMINISTRADOR"));
        return asignacionService.historial(id, actorId, esAdmin);
    }
}
