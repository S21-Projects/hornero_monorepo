package org.example.user;

import lombok.RequiredArgsConstructor;
import org.example.auth.RefreshTokenService;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final OrganizacionRepository organizacionRepository;
    private final RefreshTokenService refreshTokenService;

    public Page<UsuarioResponse> findAll(Pageable pageable) {
        return usuarioRepository.findAll(pageable)
                .map(this::toResponse);
    }

    @Transactional
    public UsuarioResponse toggleActivo(Long id, boolean activo) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario not found"));
        u.setActivo(activo);
        Usuario saved = usuarioRepository.save(u);

        if (!activo) {
            refreshTokenService.revokeAllFor(u.getId());
        }

        if (!activo && u instanceof Referente referente) {
            List<Organizacion> organizaciones = organizacionRepository.findByReferente_Id(referente.getId());
            organizaciones.forEach(org -> org.setReferente(null));
            organizacionRepository.saveAll(organizaciones);
        }

        return toResponse(saved);
    }

    private UsuarioResponse toResponse(Usuario u) {
        String tipo = u instanceof Donante ? "DONANTE"
                : u instanceof Referente ? "REFERENTE"
                : "ADMINISTRADOR";
        return new UsuarioResponse(u.getId(), u.getNombre(), u.getEmail(), tipo, u.isActivo());
    }
}
