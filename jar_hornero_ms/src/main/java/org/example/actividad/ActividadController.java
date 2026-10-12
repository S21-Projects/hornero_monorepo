package org.example.actividad;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.example.actividad.dto.ActividadResponse;
import org.example.common.PageData;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Read-only access to the activity log (ASVS 16.4.2): ADMINISTRADOR only, both at the
 * {@code SecurityConfig} matcher and here. There is deliberately no POST/PUT/PATCH/DELETE.
 */
@Tag(name = "Actividad", description = "Append-only activity log (admin only)")
@RestController
@RequestMapping("/api/actividad")
@RequiredArgsConstructor
public class ActividadController {

    private final ActividadService actividadService;
    private final ActorResolver actorResolver;

    @Operation(summary = "Query the activity log, newest first (admin only)")
    @GetMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PageData<ActividadResponse> listar(
            @RequestParam(required = false) Long actorUsuarioId,
            @RequestParam(required = false) TipoActividad accion,
            @RequestParam(required = false) ResultadoActividad resultado,
            @RequestParam(required = false) String entidadTipo,
            @RequestParam(required = false) Long entidadId,
            @RequestParam(required = false) Instant desde,
            @RequestParam(required = false) Instant hasta,
            @PageableDefault(size = 20) Pageable pageable) {
        ActividadService.Filtro filtro = new ActividadService.Filtro(
                actorUsuarioId, accion, resultado, entidadTipo, entidadId, desde, hasta);
        Page<Actividad> pagina = actividadService.buscar(filtro, pageable);
        Map<Long, ActorResolver.Actor> actores = actorResolver.resolver(pagina.getContent().stream()
                .map(Actividad::getActorUsuarioId).filter(Objects::nonNull).collect(Collectors.toSet()));
        return PageData.from(pagina.map(a -> ActividadResponse.de(a,
                a.getActorUsuarioId() == null ? null : actores.get(a.getActorUsuarioId()))));
    }
}
