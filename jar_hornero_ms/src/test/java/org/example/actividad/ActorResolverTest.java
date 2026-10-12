package org.example.actividad;

import org.example.user.Donante;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** M1: actors of an activity page are resolved with one batched query. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class ActorResolverTest {

    @Autowired
    private ActorResolver resolver;

    @Autowired
    private UsuarioRepository usuarios;

    @Test
    void resolvesNameAndEmailForExistingUsers_andOmitsUnknownIds() {
        Donante d = usuarios.save(new Donante(null, "Ana Actor", "ana-" + UUID.randomUUID() + "@test.com", "x", true));

        var mapa = resolver.resolver(Set.of(d.getId(), 987654321L));

        assertThat(mapa).containsOnlyKeys(d.getId());
        assertThat(mapa.get(d.getId()).nombre()).isEqualTo("Ana Actor");
        assertThat(mapa.get(d.getId()).email()).isEqualTo(d.getEmail());
    }

    @Test
    void emptyOrNullIds_doNotHitTheRepository() {
        assertThat(resolver.resolver(Set.of())).isEmpty();
        assertThat(resolver.resolver(null)).isEmpty();
    }
}
