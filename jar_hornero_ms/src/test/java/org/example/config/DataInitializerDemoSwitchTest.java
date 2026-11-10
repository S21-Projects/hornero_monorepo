package org.example.config;

import org.example.auth.PasswordPolicy;
import org.example.domain.ArticuloRepository;
import org.example.domain.DonacionRepository;
import org.example.domain.NecesidadRepository;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionRepository;
import org.example.user.Administrador;
import org.example.user.Usuario;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Production must not create demo data: {@code app.seed.demo=false} (the default) seeds only the
 * super admin (explicitly configured, policy-checked) and reference data. Demo accounts, orgs,
 * necesidades and donaciones exist only with {@code app.seed.demo=true}.
 */
class DataInitializerDemoSwitchTest {

    private static final String STRONG_PASSWORD = "correct-battery-staple-9";

    private UsuarioRepository usuarioRepository;
    private OrganizacionRepository organizacionRepository;
    private NecesidadRepository necesidadRepository;
    private DonacionRepository donacionRepository;
    private ArticuloRepository articuloRepository;
    private DataInitializer initializer;

    @BeforeEach
    void setUp() {
        usuarioRepository = mock(UsuarioRepository.class);
        organizacionRepository = mock(OrganizacionRepository.class);
        necesidadRepository = mock(NecesidadRepository.class);
        donacionRepository = mock(DonacionRepository.class);
        articuloRepository = mock(ArticuloRepository.class);
        initializer = new DataInitializer(
                usuarioRepository, organizacionRepository, new BCryptPasswordEncoder(4),
                necesidadRepository, donacionRepository, articuloRepository,
                mock(OrganizacionEventoRepository.class), new PasswordPolicy());
        when(usuarioRepository.findByEmail(any())).thenReturn(Optional.empty());
        when(articuloRepository.findByNombreIgnoreCase(any())).thenReturn(Optional.empty());
    }

    private void configure(boolean demo, String email, String password) {
        ReflectionTestUtils.setField(initializer, "seedDemo", demo);
        ReflectionTestUtils.setField(initializer, "superAdminEmail", email);
        ReflectionTestUtils.setField(initializer, "superAdminPassword", password);
    }

    @Test
    void demoOff_seedsOnlyConfiguredAdminAndCatalog() {
        configure(false, "ana.ong@gmail.com", STRONG_PASSWORD);

        initializer.init();

        ArgumentCaptor<Usuario> saved = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository).save(saved.capture());
        assertThat(saved.getValue()).isInstanceOf(Administrador.class);
        assertThat(saved.getValue().getEmail()).isEqualTo("ana.ong@gmail.com");
        assertThat(saved.getValue().getPassword()).isNotEqualTo(STRONG_PASSWORD);
        verify(articuloRepository, org.mockito.Mockito.atLeastOnce()).save(any());
        verify(organizacionRepository, never()).saveAll(any());
        verify(necesidadRepository, never()).saveAll(any());
        verify(donacionRepository, never()).saveAll(any());
    }

    @Test
    void demoOff_missingEmailAndPassword_failsNamingBoth() {
        configure(false, "", "");

        assertThatThrownBy(initializer::init)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SUPER_ADMIN_EMAIL")
                .hasMessageContaining("SUPER_ADMIN_PASSWORD");
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void demoOff_blankPassword_failsNamingBoth() {
        configure(false, "ana.ong@gmail.com", "   ");

        assertThatThrownBy(initializer::init)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SUPER_ADMIN_EMAIL")
                .hasMessageContaining("SUPER_ADMIN_PASSWORD");
    }

    @Test
    void demoOff_weakPassword_failsWithPolicyCode() {
        configure(false, "ana.ong@gmail.com", "Admin123!");

        assertThatThrownBy(initializer::init)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("PASSWORD_DEMASIADO_CORTA");
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    void demoOff_passwordContainingEmailLocalPart_failsWithPolicyCode() {
        configure(false, "ana.ong@gmail.com", "xx-ana.ong-xxxxxxxxx-9");

        assertThatThrownBy(initializer::init)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("PASSWORD_CONTIENE_DATOS_PERSONALES");
    }

    @Test
    void demoOff_existingAdmin_isLeftUntouched() {
        Administrador existing = new Administrador();
        existing.setEmail("ana.ong@gmail.com");
        existing.setPassword("original-hash");
        when(usuarioRepository.findByEmail("ana.ong@gmail.com")).thenReturn(Optional.of(existing));
        configure(false, "ana.ong@gmail.com", STRONG_PASSWORD);

        initializer.init();

        verify(usuarioRepository, never()).save(any());
        assertThat(existing.getPassword()).isEqualTo("original-hash");
    }

    @Test
    void demoOn_blankConfig_usesLegacyDefaultsAndSeedsDemoUsers() {
        configure(true, "", "");

        initializer.init();

        ArgumentCaptor<Usuario> saved = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository, org.mockito.Mockito.times(6)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(Usuario::getEmail).containsExactlyInAnyOrder(
                "admin@hornero.ar", "referente@hornero.ar", "referente2@hornero.ar",
                "referente3@hornero.ar", "donante@hornero.ar", "donante2@hornero.ar");
    }

    @Test
    void demoOn_explicitAdminConfig_isHonoured() {
        configure(true, "custom@hornero.ar", "Whatever1!");

        initializer.init();

        ArgumentCaptor<Usuario> saved = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository, org.mockito.Mockito.times(6)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(Usuario::getEmail).contains("custom@hornero.ar");
    }
}
