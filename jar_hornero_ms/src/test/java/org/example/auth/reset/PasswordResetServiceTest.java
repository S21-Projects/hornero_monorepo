package org.example.auth.reset;

import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.ResultadoActividad;
import org.example.actividad.TipoActividad;
import org.example.auth.PasswordPolicy;
import org.example.auth.RefreshTokenService;
import org.example.mail.MensajeCorreo;
import org.example.mail.Mailer;
import org.example.user.Donante;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-12T12:00:00Z");
    private static final String PANEL = "https://panel.elhornero.org";
    private static final String PASSWORD_OK = "la cafetera azul canta fuerte";

    @Mock private UsuarioRepository usuarioRepository;
    @Mock private PasswordResetTokenRepository tokenRepository;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private ActividadService actividadService;
    @Mock private Mailer mailer;
    @Mock private PlatformTransactionManager transactionManager;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private PasswordResetService service;
    private Donante ana;

    @BeforeEach
    void setUp() {
        service = new PasswordResetService(usuarioRepository, tokenRepository, encoder, new PasswordPolicy(),
                refreshTokenService, actividadService, mailer, clock, Runnable::run,
                transactionManager, 30, PANEL + "/");
        ana = new Donante(7L, "Ana Pérez", "ana@example.com", encoder.encode("vieja-contraseña-larga-1"), true);
        ana.setEmailVerificado(false);
    }

    private ArgumentCaptor<Registro> registros() {
        ArgumentCaptor<Registro> c = ArgumentCaptor.forClass(Registro.class);
        verify(actividadService, org.mockito.Mockito.atLeastOnce()).registrarAislado(c.capture());
        return c;
    }

    // --- solicitar -------------------------------------------------------------------------

    @Test
    void solicitar_unknownEmail_createsNoTokenSendsNoMailAndRecordsAnonymousFailure() {
        when(usuarioRepository.findByEmail("nadie@example.com")).thenReturn(Optional.empty());

        assertThatCode(() -> service.solicitar("nadie@example.com")).doesNotThrowAnyException();

        verify(tokenRepository, never()).save(any());
        verify(mailer, never()).enviar(any());
        Registro r = registros().getValue();
        assertThat(r.accion()).isEqualTo(TipoActividad.PASSWORD_RESET_SOLICITADO);
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.FALLO);
        assertThat(r.detalle()).isEqualTo("USUARIO_DESCONOCIDO");
        assertThat(r.emailIntento()).isEqualTo("nadie@example.com");
        assertThat(r.actorId()).isNull();
    }

    @Test
    void solicitar_inactiveUser_behavesLikeUnknownToTheCaller() {
        ana.setActivo(false);
        when(usuarioRepository.findByEmail("ana@example.com")).thenReturn(Optional.of(ana));

        assertThatCode(() -> service.solicitar("ana@example.com")).doesNotThrowAnyException();

        verify(tokenRepository, never()).save(any());
        verify(mailer, never()).enviar(any());
        assertThat(registros().getValue().detalle()).isEqualTo("USUARIO_INACTIVO");
    }

    @Test
    void solicitar_activeUser_storesOnlyTheHash_andMailsTheRawToken() {
        when(usuarioRepository.findByEmail("ana@example.com")).thenReturn(Optional.of(ana));

        service.solicitar("ana@example.com");

        ArgumentCaptor<PasswordResetToken> saved = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository).save(saved.capture());
        ArgumentCaptor<MensajeCorreo> mail = ArgumentCaptor.forClass(MensajeCorreo.class);
        verify(mailer).enviar(mail.capture());

        String link = mail.getValue().text();
        String rawToken = link.substring(link.indexOf("token=") + 6).lines().findFirst().orElseThrow().trim();
        assertThat(rawToken).matches("[A-Za-z0-9_-]{43}");                 // 32 random bytes, URL-safe, unpadded
        assertThat(saved.getValue().getTokenHash())
                .isEqualTo(PasswordResetService.hash(rawToken))
                .matches("[0-9a-f]{64}")
                .doesNotContain(rawToken);
        assertThat(saved.getValue().getUsuarioId()).isEqualTo(7L);
        assertThat(saved.getValue().getExpiraEn()).isEqualTo(NOW.plusSeconds(30 * 60));
        assertThat(saved.getValue().getUsadoEn()).isNull();
        assertThat(mail.getValue().to()).isEqualTo("ana@example.com");
        assertThat(link).contains(PANEL + "/restablecer?token=");
        assertThat(link).doesNotContain(PANEL + "//");

        Registro r = registros().getValue();
        assertThat(r.accion()).isEqualTo(TipoActividad.PASSWORD_RESET_SOLICITADO);
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.EXITO);
        assertThat(r.actorId()).isEqualTo(7L);
        assertThat(r.emailIntento()).isNull();
    }

    @Test
    void solicitar_invalidatesEarlierUnusedTokensOfTheUser() {
        when(usuarioRepository.findByEmail("ana@example.com")).thenReturn(Optional.of(ana));

        service.solicitar("ana@example.com");

        verify(tokenRepository).invalidarPendientes(7L, NOW);
    }

    @Test
    void solicitar_twoRequests_produceDifferentTokens() {
        when(usuarioRepository.findByEmail("ana@example.com")).thenReturn(Optional.of(ana));

        service.solicitar("ana@example.com");
        service.solicitar("ana@example.com");

        ArgumentCaptor<PasswordResetToken> saved = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository, org.mockito.Mockito.times(2)).save(saved.capture());
        assertThat(saved.getAllValues().get(0).getTokenHash()).isNotEqualTo(saved.getAllValues().get(1).getTokenHash());
    }

    @Test
    void solicitar_mailFailure_isSwallowed() {
        when(usuarioRepository.findByEmail("ana@example.com")).thenReturn(Optional.of(ana));
        doThrow(new RuntimeException("resend down")).when(mailer).enviar(any());

        assertThatCode(() -> service.solicitar("ana@example.com")).doesNotThrowAnyException();
    }

    // --- restablecer -----------------------------------------------------------------------

    private PasswordResetToken tokenValido(String raw) {
        PasswordResetToken t = new PasswordResetToken();
        t.setId(11L);
        t.setUsuarioId(7L);
        t.setTokenHash(PasswordResetService.hash(raw));
        t.setCreadoEn(NOW.minusSeconds(60));
        t.setExpiraEn(NOW.plusSeconds(600));
        return t;
    }

    private void assertTokenInvalido(String raw, String motivo) {
        assertThatThrownBy(() -> service.restablecer(raw, PASSWORD_OK))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode().value()).isEqualTo(400);
                    assertThat(e.getReason()).isEqualTo("TOKEN_INVALIDO");
                });
        verify(usuarioRepository, never()).save(any());
        verify(refreshTokenService, never()).revokeAllFor(anyLong());
        Registro r = registros().getValue();
        assertThat(r.accion()).isEqualTo(TipoActividad.PASSWORD_RESET_FALLIDO);
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.FALLO);
        assertThat(r.detalle()).isEqualTo(motivo);
        assertThat(r.detalle()).doesNotContain(raw);
    }

    @Test
    void restablecer_unknownToken_is400TokenInvalido() {
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertTokenInvalido("desconocido", "TOKEN_DESCONOCIDO");
    }

    @Test
    void restablecer_usedToken_is400TokenInvalido() {
        PasswordResetToken t = tokenValido("tok");
        t.setUsadoEn(NOW.minusSeconds(5));
        when(tokenRepository.findByTokenHash(t.getTokenHash())).thenReturn(Optional.of(t));

        assertTokenInvalido("tok", "TOKEN_USADO");
    }

    @Test
    void restablecer_expiredToken_is400TokenInvalido() {
        PasswordResetToken t = tokenValido("tok");
        t.setExpiraEn(NOW.minusSeconds(1));
        when(tokenRepository.findByTokenHash(t.getTokenHash())).thenReturn(Optional.of(t));

        assertTokenInvalido("tok", "TOKEN_VENCIDO");
    }

    @Test
    void restablecer_inactiveUser_is400TokenInvalido() {
        PasswordResetToken t = tokenValido("tok");
        ana.setActivo(false);
        when(tokenRepository.findByTokenHash(t.getTokenHash())).thenReturn(Optional.of(t));
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(ana));

        assertTokenInvalido("tok", "USUARIO_INACTIVO");
    }

    @Test
    void restablecer_lostRace_theTokenWasConsumedConcurrently_is400() {
        PasswordResetToken t = tokenValido("tok");
        when(tokenRepository.findByTokenHash(t.getTokenHash())).thenReturn(Optional.of(t));
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(ana));
        when(tokenRepository.marcarUsado(11L, NOW)).thenReturn(0);

        assertTokenInvalido("tok", "TOKEN_USADO");
    }

    @Test
    void restablecer_weakPassword_isRejectedWithThePolicyCode_andTheTokenSurvives() {
        PasswordResetToken t = tokenValido("tok");
        when(tokenRepository.findByTokenHash(t.getTokenHash())).thenReturn(Optional.of(t));
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(ana));

        assertThatThrownBy(() -> service.restablecer("tok", "corta"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getReason()).isEqualTo("PASSWORD_DEMASIADO_CORTA"));

        verify(tokenRepository, never()).marcarUsado(anyLong(), any());
        verify(usuarioRepository, never()).save(any());
        assertThat(registros().getValue().accion()).isEqualTo(TipoActividad.PASSWORD_RESET_FALLIDO);
    }

    @Test
    void restablecer_passwordContainingTheUsersName_isRejected() {
        PasswordResetToken t = tokenValido("tok");
        when(tokenRepository.findByTokenHash(t.getTokenHash())).thenReturn(Optional.of(t));
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(ana));

        assertThatThrownBy(() -> service.restablecer("tok", "xx-ana-perez-yyyy-zzzz-qqqq"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getReason()).isEqualTo("PASSWORD_CONTIENE_DATOS_PERSONALES"));
    }

    @Test
    void restablecer_success_setsHashedPassword_consumesToken_revokesSessions_verifiesEmail_andNotifies() {
        PasswordResetToken t = tokenValido("tok");
        when(tokenRepository.findByTokenHash(t.getTokenHash())).thenReturn(Optional.of(t));
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(ana));
        when(tokenRepository.marcarUsado(11L, NOW)).thenReturn(1);

        service.restablecer("tok", PASSWORD_OK);

        assertThat(encoder.matches(PASSWORD_OK, ana.getPassword())).isTrue();
        assertThat(ana.getPassword()).isNotEqualTo(PASSWORD_OK);
        assertThat(ana.isEmailVerificado()).isTrue();
        verify(usuarioRepository).save(ana);
        verify(tokenRepository).marcarUsado(11L, NOW);
        verify(tokenRepository).invalidarPendientes(7L, NOW);
        verify(refreshTokenService).revokeAllFor(7L);
        ArgumentCaptor<Registro> r = ArgumentCaptor.forClass(Registro.class);
        verify(actividadService).registrar(r.capture());
        assertThat(r.getValue().accion()).isEqualTo(TipoActividad.PASSWORD_RESET_COMPLETADO);
        assertThat(r.getValue().actorId()).isEqualTo(7L);
        ArgumentCaptor<MensajeCorreo> mail = ArgumentCaptor.forClass(MensajeCorreo.class);
        verify(mailer).enviar(mail.capture());
        assertThat(mail.getValue().to()).isEqualTo("ana@example.com");
        assertThat(mail.getValue().text()).doesNotContain(PASSWORD_OK).doesNotContain("tok");
    }

    @Test
    void restablecer_confirmationMailFailure_doesNotFailTheReset() {
        PasswordResetToken t = tokenValido("tok");
        when(tokenRepository.findByTokenHash(t.getTokenHash())).thenReturn(Optional.of(t));
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(ana));
        when(tokenRepository.marcarUsado(eq(11L), any())).thenReturn(1);
        doThrow(new RuntimeException("resend down")).when(mailer).enviar(any());

        assertThatCode(() -> service.restablecer("tok", PASSWORD_OK)).doesNotThrowAnyException();
    }

    // --- housekeeping ----------------------------------------------------------------------

    @Test
    void purgeExpired_deletesTokensExpiredMoreThanADayAgo() {
        when(tokenRepository.deleteExpiredBefore(NOW.minusSeconds(24 * 3600))).thenReturn(3);

        service.purgeExpired();

        verify(tokenRepository).deleteExpiredBefore(NOW.minusSeconds(24 * 3600));
    }
}
