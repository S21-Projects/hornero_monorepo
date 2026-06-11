package org.example.necesidad;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.necesidad.dto.CrearNecesidadRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Necesidades", description = "Organization needs management")
@RestController
@RequestMapping("/api/necesidades")
@RequiredArgsConstructor
public class NecesidadController {

    private final NecesidadService necesidadService;

    @Operation(summary = "Create a need for the authenticated referente's organization")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('REFERENTE')")
    public NecesidadResponse crear(@Valid @RequestBody CrearNecesidadRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long referenteId = (Long) auth.getPrincipal();
        return necesidadService.crear(request, referenteId);
    }

    @Operation(summary = "List needs, optionally filtered by organization")
    @GetMapping
    public ResponseEntity<List<NecesidadResponse>> listar(
            @RequestParam(required = false) Long organizacionId) {
        List<NecesidadResponse> result = organizacionId == null
                ? necesidadService.findAll()
                : necesidadService.findByOrganizacion(organizacionId);
        return ResponseEntity.ok(result);
    }
}
