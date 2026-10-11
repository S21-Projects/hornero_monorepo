package org.example.auth;

import org.example.actividad.Actividad;
import org.example.actividad.ActividadService;
import org.example.actividad.ResultadoActividad;
import org.example.actividad.TipoActividad;
import org.example.auth.dto.LoginRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The failed-login row must exist even though the login call ends in an exception (ASVS 16.3.1). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class AuthLoginActividadIntegrationTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private ActividadService actividadService;

    @Test
    void failedLogin_persistsDespiteTheException_andNeverStoresThePassword() {
        String email = "nadie-" + UUID.randomUUID() + "@example.com";
        String password = "super-secret-password-123";

        assertThatThrownBy(() -> authService.login(new LoginRequest(email, password)))
                .isInstanceOf(ResponseStatusException.class);

        var filas = actividadService.buscar(new ActividadService.Filtro(null, TipoActividad.LOGIN,
                ResultadoActividad.FALLO, null, null, null, null), PageRequest.of(0, 100)).getContent();
        Actividad fila = filas.stream().filter(a -> email.equals(a.getEmailIntento())).findFirst().orElseThrow();
        assertThat(fila.toString()).doesNotContain(password);
        assertThat(fila.getDetalle()).doesNotContain(password);
        assertThat(fila.getMotivo()).isNull();
    }
}
