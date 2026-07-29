package org.example.auth;

import lombok.RequiredArgsConstructor;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Gate for content-producing writes (necesidades, donaciones). Always reads
 * the DB, never the JWT claim, since the claim can be stale for up to 15
 * minutes after verification (design decision #5).
 */
@Service
@RequiredArgsConstructor
public class VerificacionService {

    private final UsuarioRepository usuarioRepository;

    public void requireVerified(Long userId) {
        Usuario usuario = usuarioRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario not found"));

        if (!usuario.isEmailVerificado()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "EMAIL_NO_VERIFICADO");
        }
    }
}
