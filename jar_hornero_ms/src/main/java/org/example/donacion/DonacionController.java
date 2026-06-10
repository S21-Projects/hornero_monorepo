package org.example.donacion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Donaciones", description = "Donation management")
@RestController
@RequestMapping("/api/donaciones")
@RequiredArgsConstructor
public class DonacionController {

    private final DonacionService donacionService;

    @Operation(summary = "List donations, optionally filtered by organization")
    @GetMapping
    public List<DonacionResponse> getByOrganizacion(
            @RequestParam(required = false) Long organizacionId) {
        if (organizacionId != null) {
            return donacionService.findByOrganizacion(organizacionId);
        }
        return donacionService.findAll();
    }
}
