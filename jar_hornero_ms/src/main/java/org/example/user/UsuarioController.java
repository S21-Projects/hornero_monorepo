package org.example.user;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.common.PageData;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Usuarios", description = "User management")
@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;

    @GetMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public PageData<UsuarioResponse> getAll(
            @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        return PageData.from(usuarioService.findAll(pageable));
    }

    @PatchMapping("/{id}/activo")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    public UsuarioResponse toggleActivo(@PathVariable Long id,
                                        @Valid @RequestBody UpdateActivoRequest request) {
        return usuarioService.toggleActivo(id, request.getActivo());
    }
}
