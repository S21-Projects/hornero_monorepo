package org.example.actividad;

import org.example.actividad.ActividadService.Registro;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Real H2 + real transaction manager and deliberately NOT {@code @Transactional}: the point is the
 * commit/rollback behaviour, which a test-managed outer transaction would hide (the same blind spot
 * that let the F1 rollback bug through).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@TestPropertySource(properties = "app.actividad.retencion-dias=365")
class ActividadServiceIntegrationTest {

    @Autowired
    private ActividadService service;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @AfterEach
    void limpiar() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    private List<Actividad> buscarPorDetalle(String marca) {
        // The marker is unique per test, so filtering the (small) newest page is enough.
        return service.buscar(new ActividadService.Filtro(null, null, null, "TEST", null, null, null),
                PageRequest.of(0, 100)).getContent().stream()
                .filter(a -> a.getDetalle() != null && a.getDetalle().contains(marca)).toList();
    }

    private static String marca() {
        return "m-" + UUID.randomUUID();
    }

    @Test
    void isolatedWrite_survivesTheRollbackOfTheSurroundingTransaction() {
        String marca = marca();
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            service.registrarAislado(Registro.de(TipoActividad.LOGIN).fallo().entidad("TEST", 1L).detalle(marca));
            status.setRollbackOnly();
        });

        assertThat(buscarPorDetalle(marca)).hasSize(1);
    }

    @Test
    void isolatedWrite_survivesAnExceptionThrownByTheBusinessCode() {
        String marca = marca();
        assertThatCode(() -> new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            service.registrarAislado(Registro.de(TipoActividad.OTP_BLOQUEO).fallo().entidad("TEST", 2L).detalle(marca));
            throw new IllegalStateException("business failure");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(buscarPorDetalle(marca)).hasSize(1);
    }

    @Test
    void sameTransactionWrite_rollsBackWithTheBusinessTransaction() {
        String marca = marca();
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            service.registrar(Registro.de(TipoActividad.USUARIO_DESACTIVADO).entidad("TEST", 3L).detalle(marca));
            status.setRollbackOnly();
        });

        assertThat(buscarPorDetalle(marca)).isEmpty();
    }

    @Test
    void sameTransactionWrite_commitsWithTheBusinessTransaction() {
        String marca = marca();
        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                service.registrar(Registro.de(TipoActividad.USUARIO_DESACTIVADO).entidad("TEST", 4L).detalle(marca)));

        assertThat(buscarPorDetalle(marca)).hasSize(1);
    }

    @Test
    void isolatedWrite_neverThrows_evenWhenTheInsertIsRejected() {
        // A null accion violates NOT NULL: the audit failure must not break the user action.
        assertThatCode(() -> service.registrarAislado(Registro.de(null).entidad("TEST", 5L)))
                .doesNotThrowAnyException();
    }

    @Test
    void sanitizesFreeTextBeforePersisting() {
        String marca = marca();
        service.registrarAislado(Registro.de(TipoActividad.LOGIN).fallo().entidad("TEST", 6L)
                .detalle(marca + "\r\nforged line\u0000")
                .motivo("m\nx")
                .emailIntento("  Victim@Example.COM\r\n"));

        Actividad a = buscarPorDetalle(marca).get(0);
        assertThat(a.getDetalle()).doesNotContain("\r", "\n", "\u0000");
        assertThat(a.getMotivo()).isEqualTo("m x");
        assertThat(a.getEmailIntento()).isEqualTo("victim@example.com");
    }

    @Test
    void actorIsTakenFromTheSecurityContext() {
        String marca = marca();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                42L, null, List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRADOR"))));

        service.registrarAislado(Registro.de(TipoActividad.ARTICULO_CREADO).entidad("TEST", 7L).detalle(marca));

        Actividad a = buscarPorDetalle(marca).get(0);
        assertThat(a.getActorUsuarioId()).isEqualTo(42L);
        assertThat(a.getActorTipo()).isEqualTo(TipoActor.ADMINISTRADOR);
    }

    @Test
    void withoutAuthenticationTheActorIsAnonymous_andSistemaIsExplicit() {
        String marca = marca();
        service.registrarAislado(Registro.de(TipoActividad.LOGIN).fallo().entidad("TEST", 8L).detalle(marca + " a"));
        service.registrarAislado(Registro.de(TipoActividad.NECESIDADES_VENCIDAS).sistema().entidad("TEST", 8L).detalle(marca + " s"));

        assertThat(buscarPorDetalle(marca)).extracting(Actividad::getActorTipo)
                .containsExactlyInAnyOrder(TipoActor.ANONIMO, TipoActor.SISTEMA);
        assertThat(buscarPorDetalle(marca)).allSatisfy(a -> assertThat(a.getActorUsuarioId()).isNull());
    }

    @Test
    void clientIpComesFromTheForwardedHeaderAndIsValidated() {
        String marca = marca();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ActividadService.HEADER_IP, "190.12.3.4");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        service.registrarAislado(Registro.de(TipoActividad.LOGIN).entidad("TEST", 9L).detalle(marca + " ok"));

        MockHttpServletRequest forged = new MockHttpServletRequest();
        forged.addHeader(ActividadService.HEADER_IP, "1.2.3.4\r\nX-Forged: yes");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(forged));
        service.registrarAislado(Registro.de(TipoActividad.LOGIN).entidad("TEST", 9L).detalle(marca + " forged"));

        assertThat(buscarPorDetalle(marca)).extracting(Actividad::getIp).containsExactlyInAnyOrder("190.12.3.4", null);
    }

    @Test
    void query_filtersAndReturnsNewestFirst() {
        String marca = marca();
        Instant antes = Instant.now().minusSeconds(1);
        service.registrarAislado(Registro.de(TipoActividad.LOGIN).fallo().entidad("TEST", 10L).detalle(marca + " 1"));
        service.registrarAislado(Registro.de(TipoActividad.LOGOUT).entidad("TEST", 10L).detalle(marca + " 2"));

        var soloFallos = service.buscar(new ActividadService.Filtro(null, TipoActividad.LOGIN,
                ResultadoActividad.FALLO, "test", 10L, antes, null), PageRequest.of(0, 20));
        assertThat(soloFallos.getContent()).extracting(Actividad::getDetalle).containsExactly(marca + " 1");

        var todas = service.buscar(new ActividadService.Filtro(null, null, null, "TEST", 10L, antes, null),
                PageRequest.of(0, 20));
        assertThat(todas.getContent()).extracting(Actividad::getDetalle).containsExactly(marca + " 2", marca + " 1");
    }
}
