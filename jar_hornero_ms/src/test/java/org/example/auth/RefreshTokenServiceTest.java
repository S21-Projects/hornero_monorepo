package org.example.auth;

import org.example.user.Donante;
import org.example.user.Usuario;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-10T12:00:00Z");
    private static final long REFRESH_TTL_MS = 604_800_000L;

    @Mock
    private RefreshTokenRepository repository;

    @Mock
    private JwtService jwtService;

    private RefreshTokenService service;
    private Usuario usuario;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new RefreshTokenService(repository, jwtService, clock, REFRESH_TTL_MS, 30L);
        usuario = new Donante(1L, "Don", "don@test.com", "pw", true);
    }

    private RefreshToken stored(String jti, Instant rotatedAt, Instant revokedAt) {
        RefreshToken t = new RefreshToken();
        t.setJti(jti);
        t.setUsuarioId(1L);
        t.setFamilyId("family-1");
        t.setIssuedAt(NOW.minusSeconds(3600));
        t.setExpiresAt(NOW.plusSeconds(3600));
        t.setRotatedAt(rotatedAt);
        t.setRevokedAt(revokedAt);
        return t;
    }

    @Test
    void issue_startsNewFamilyAndStoresOnlyTheJti() {
        when(jwtService.generateRefreshToken(eq(1L), anyString())).thenReturn("jwt");
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);

        String token = service.issue(usuario);

        assertThat(token).isEqualTo("jwt");
        verify(repository).save(saved.capture());
        RefreshToken row = saved.getValue();
        assertThat(row.getJti()).isNotBlank();
        assertThat(row.getFamilyId()).isNotBlank().isNotEqualTo(row.getJti());
        assertThat(row.getUsuarioId()).isEqualTo(1L);
        assertThat(row.getIssuedAt()).isEqualTo(NOW);
        assertThat(row.getExpiresAt()).isEqualTo(NOW.plusMillis(REFRESH_TTL_MS));
        verify(jwtService).generateRefreshToken(1L, row.getJti());
    }

    @Test
    void rotate_validToken_marksRotatedAndIssuesInSameFamily() {
        RefreshToken old = stored("old", null, null);
        when(repository.findByJti("old")).thenReturn(Optional.of(old));
        when(jwtService.generateRefreshToken(eq(1L), anyString())).thenReturn("new-jwt");
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);

        String token = service.rotate("old", usuario);

        assertThat(token).isEqualTo("new-jwt");
        assertThat(old.getRotatedAt()).isEqualTo(NOW);
        verify(repository, org.mockito.Mockito.atLeastOnce()).save(saved.capture());
        RefreshToken fresh = saved.getAllValues().stream()
                .filter(t -> !"old".equals(t.getJti())).findFirst().orElseThrow();
        assertThat(fresh.getFamilyId()).isEqualTo("family-1");
    }

    @Test
    void rotate_unknownJti_throws401() {
        when(repository.findByJti("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rotate("nope", usuario))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void rotate_revokedToken_throws401() {
        when(repository.findByJti("rev")).thenReturn(Optional.of(stored("rev", null, NOW.minusSeconds(5))));

        assertThatThrownBy(() -> service.rotate("rev", usuario))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
        verify(jwtService, never()).generateRefreshToken(any(), anyString());
    }

    @Test
    void rotate_tokenOfAnotherUser_throws401() {
        RefreshToken other = stored("x", null, null);
        other.setUsuarioId(99L);
        when(repository.findByJti("x")).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.rotate("x", usuario))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void rotate_reuseWithinGrace_issuesNewTokenWithoutRevoking() {
        RefreshToken old = stored("old", NOW.minusSeconds(10), null);
        when(repository.findByJti("old")).thenReturn(Optional.of(old));
        when(jwtService.generateRefreshToken(eq(1L), anyString())).thenReturn("new-jwt");

        String token = service.rotate("old", usuario);

        assertThat(token).isEqualTo("new-jwt");
        assertThat(old.getRotatedAt()).isEqualTo(NOW.minusSeconds(10));
        verify(repository, never()).revokeFamily(anyString(), any());
    }

    @Test
    void rotate_reuseAfterGrace_revokesFamilyAndThrows401() {
        RefreshToken old = stored("old", NOW.minusSeconds(31), null);
        when(repository.findByJti("old")).thenReturn(Optional.of(old));

        assertThatThrownBy(() -> service.rotate("old", usuario))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
        verify(repository).revokeFamily("family-1", NOW);
        verify(jwtService, never()).generateRefreshToken(any(), anyString());
    }

    @Test
    void revokeFamilyOf_knownJti_revokesItsFamily() {
        when(repository.findByJti("old")).thenReturn(Optional.of(stored("old", null, null)));

        service.revokeFamilyOf("old");

        verify(repository).revokeFamily("family-1", NOW);
    }

    @Test
    void revokeFamilyOf_unknownJti_isANoOp() {
        when(repository.findByJti("nope")).thenReturn(Optional.empty());

        assertThatCode(() -> service.revokeFamilyOf("nope")).doesNotThrowAnyException();
        verify(repository, never()).revokeFamily(anyString(), any());
    }

    @Test
    void revokeAllFor_revokesEveryFamilyOfTheUser() {
        service.revokeAllFor(1L);

        verify(repository).revokeAllByUsuarioId(1L, NOW);
    }

    @Test
    void purgeExpired_deletesRowsExpiredMoreThanOneDayAgo() {
        service.purgeExpired();

        verify(repository).deleteExpiredBefore(NOW.minus(Duration.ofDays(1)));
    }
}
