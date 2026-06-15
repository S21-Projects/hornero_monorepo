package org.example.user;

import lombok.RequiredArgsConstructor;
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

    public List<UsuarioResponse> findAll() {
        return usuarioRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public UsuarioResponse toggleActivo(Long id, boolean activo) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario not found"));
        u.setActivo(activo);
        return toResponse(usuarioRepository.save(u));
    }

    @Transactional
    public UsuarioResponse updatePhoto(Long userId, String photoUrl) {
        Usuario u = usuarioRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario not found"));
        u.setPhotoUrl(photoUrl);
        return toResponse(usuarioRepository.save(u));
    }

    private UsuarioResponse toResponse(Usuario u) {
        String tipo = u instanceof Donante ? "DONANTE"
                : u instanceof Referente ? "REFERENTE"
                : "ADMINISTRADOR";
        return new UsuarioResponse(u.getId(), u.getNombre(), u.getEmail(), tipo, u.isActivo(), u.getPhotoUrl());
    }
}
