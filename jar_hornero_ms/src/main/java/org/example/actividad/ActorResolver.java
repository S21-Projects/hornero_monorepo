package org.example.actividad;

import lombok.RequiredArgsConstructor;
import org.example.user.UsuarioRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

/**
 * Resolves the display data (name, email) of the actors of one activity page with a single
 * batched query, so the admin screen never needs an N+1 or extra client calls (M1). Actors that no
 * longer exist are simply absent from the result.
 */
@Component
@RequiredArgsConstructor
public class ActorResolver {

    private final UsuarioRepository usuarios;

    public record Actor(String nombre, String email) {
    }

    @Transactional(readOnly = true)
    public Map<Long, Actor> resolver(Collection<Long> ids) {
        Map<Long, Actor> resultado = new HashMap<>();
        if (ids == null || ids.isEmpty()) {
            return resultado;
        }
        usuarios.findResumenByIdIn(ids)
                .forEach(u -> resultado.put(u.getId(), new Actor(u.getNombre(), u.getEmail())));
        return resultado;
    }
}
