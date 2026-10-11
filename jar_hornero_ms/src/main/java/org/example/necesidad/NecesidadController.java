package org.example.necesidad;

import org.example.idempotencia.Idempotente;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.common.PageData;
import org.example.necesidad.dto.ActualizarNecesidadRequest;
import org.example.necesidad.dto.CrearNecesidadRequest;
import org.example.necesidad.dto.RelanzarNecesidadRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Necesidades", description = "Organization needs management")
@RestController
@RequestMapping("/api/necesidades")
@RequiredArgsConstructor
public class NecesidadController {

    private final NecesidadService necesidadService;

    @Operation(summary = "Create a need for the authenticated referente's organization")
    @PostMapping
    @Idempotente
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('REFERENTE')")
    public NecesidadResponse crear(@Valid @RequestBody CrearNecesidadRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long referenteId = (Long) auth.getPrincipal();
        return necesidadService.crear(request, referenteId);
    }

    @Operation(summary = "List needs, optionally filtered by organization")
    @GetMapping
    public PageData<NecesidadResponse> listar(
            @RequestParam(required = false) Long organizacionId,
            @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        Page<NecesidadResponse> page = organizacionId == null
                ? necesidadService.findAll(pageable)
                : necesidadService.findByOrganizacion(organizacionId, pageable);
        return PageData.from(page);
    }

    @Operation(summary = "Get a need by ID")
    @GetMapping("/{id}")
    public NecesidadResponse findById(@PathVariable Long id) {
        return necesidadService.findById(id);
    }

    @Operation(summary = "Update a need (partial update)")
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('REFERENTE')")
    public NecesidadResponse actualizar(@PathVariable Long id,
                                        @Valid @RequestBody ActualizarNecesidadRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long referenteId = (Long) auth.getPrincipal();
        return necesidadService.actualizar(id, request, referenteId);
    }

    @Operation(summary = "Relaunch an expired need with a new expiry date")
    @PostMapping("/{id}/relanzar")
    @Idempotente
    @PreAuthorize("hasRole('REFERENTE')")
    public NecesidadResponse relanzar(@PathVariable Long id,
                                      @Valid @RequestBody RelanzarNecesidadRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long referenteId = (Long) auth.getPrincipal();
        return necesidadService.relanzar(id, request, referenteId);
    }

    @Operation(summary = "Delete a need")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('REFERENTE')")
    public void eliminar(@PathVariable Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long referenteId = (Long) auth.getPrincipal();
        necesidadService.eliminar(id, referenteId);
    }
}
