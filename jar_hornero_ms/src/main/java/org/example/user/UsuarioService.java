package org.example.user;

import lombok.RequiredArgsConstructor;
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

    public Page<UsuarioResponse> findAll(Pageable pageable) {
        return usuarioRepository.findAll(pageable)
                .map(this::toResponse);
    }

    @Transactional
    public UsuarioResponse toggleActivo(Long id, boolean activo) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario not found"));
        u.setActivo(activo);
        return toResponse(usuarioRepository.save(u));
    }

    private UsuarioResponse toResponse(Usuario u) {
        String tipo = u instanceof Donante ? "DONANTE"
                : u instanceof Referente ? "REFERENTE"
                : "ADMINISTRADOR";
        return new UsuarioResponse(u.getId(), u.getNombre(), u.getEmail(), tipo, u.isActivo());
    }
}
