package org.example.auth;

import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VerificacionServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @InjectMocks
    private VerificacionService verificacionService;

    @Test
    void requireVerified_unverifiedUser_throws403WithReason() {
        Referente referente = new Referente(1L, "Ref", "ref@test.com", "encoded", true);
        referente.setEmailVerificado(false);
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));

        assertThatThrownBy(() -> verificacionService.requireVerified(1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403")
                .hasMessageContaining("EMAIL_NO_VERIFICADO");
    }

    @Test
    void requireVerified_verifiedUser_doesNotThrow() {
        Referente referente = new Referente(1L, "Ref", "ref@test.com", "encoded", true);
        referente.setEmailVerificado(true);
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(referente));

        assertThatCode(() -> verificacionService.requireVerified(1L)).doesNotThrowAnyException();
    }

    @Test
    void requireVerified_userNotFound_throws404() {
        when(usuarioRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> verificacionService.requireVerified(99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
    }
}
