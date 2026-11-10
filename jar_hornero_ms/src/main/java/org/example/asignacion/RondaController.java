package org.example.asignacion;

import org.example.idempotencia.Idempotente;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.example.asignacion.dto.RondaFondoResponse;
import org.example.asignacion.dto.RondaResponse;
import org.example.common.PageData;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Manual ronda trigger and history (AD-9, spec `ronda-asignacion`): ADMINISTRADOR-only at every
 * endpoint — the optional scheduled ronda (N7) runs in-process and is not exposed here.
 */
@Tag(name = "Rondas", description = "Manual ronda trigger and history (ADMINISTRADOR only)")
@RestController
@RequestMapping("/api/rondas")
@RequiredArgsConstructor
public class RondaController {

    private final RondaService rondaService;

    @Operation(summary = "Trigger a ronda (admin only — AD-9)")
    @PostMapping
    @Idempotente
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RondaResponse ejecutar() {
        return rondaService.toResponse(rondaService.ejecutar(actorId()));
    }

    @Operation(summary = "List prior rondas, most recent first")
    @GetMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PageData<RondaResponse> listar(
            @PageableDefault(size = 20, sort = "ejecutadaEn", direction = Sort.Direction.DESC) Pageable pageable) {
        return PageData.from(rondaService.listar(pageable));
    }

    @Operation(summary = "Get a ronda's full detail")
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RondaResponse detalle(@PathVariable Long id) {
        return rondaService.detalle(id);
    }

    @Operation(summary = "Pool size and the oldest waiting donación, before triggering a ronda")
    @GetMapping("/fondo")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public RondaFondoResponse fondo() {
        return rondaService.fondoEstado();
    }

    private Long actorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }
}
