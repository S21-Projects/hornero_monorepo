package org.example.necesidad;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Necesidades", description = "Organization needs management")
@RestController
@RequestMapping("/api/necesidades")
@RequiredArgsConstructor
public class NecesidadController {

    private final NecesidadService necesidadService;

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
