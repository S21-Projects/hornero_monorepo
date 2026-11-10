package org.example.user;

import org.example.auth.RefreshTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Admin listing: pagination, tipo / activo / q filters against a real H2 schema. */
@DataJpaTest
@Import(UsuarioService.class)
@MockBean({org.example.actividad.ActividadService.class, RefreshTokenService.class})
class UsuarioServiceListarTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private UsuarioService usuarioService;

    private void persistir(Usuario u, String nombre, String email, boolean activo) {
        u.setNombre(nombre);
        u.setEmail(email);
        u.setPassword("x");
        u.setActivo(activo);
        entityManager.persist(u);
    }

    @BeforeEach
    void datos() {
        persistir(new Administrador(), "Admin Uno", "admin@test.com", true);
        persistir(new Referente(), "Ana Referente", "ana@test.com", true);
        persistir(new Referente(), "Beto Referente", "beto@test.com", false);
        persistir(new Referente(), "Cora Referente", "cora@sur.org", true);
        persistir(new Donante(), "Dani Donante", "dani@test.com", true);
        persistir(new Donante(), "100% Donante", "pct@test.com", true);
        persistir(new Donante(), "Under_score", "under@test.com", true);
        entityManager.flush();
    }

    private static PageRequest pagina(int page, int size) {
        return PageRequest.of(page, size, Sort.by("id"));
    }

    private List<String> nombres(Page<UsuarioResponse> p) {
        return p.getContent().stream().map(UsuarioResponse::nombre).toList();
    }

    @Test
    void sinFiltros_devuelveTodosPaginados() {
        Page<UsuarioResponse> p = usuarioService.findAll(null, null, null, pagina(0, 3));

        assertThat(p.getTotalElements()).isEqualTo(7);
        assertThat(p.getTotalPages()).isEqualTo(3);
        assertThat(p.getContent()).hasSize(3);
    }

    @Test
    void tipo_filtraPorDiscriminador() {
        assertThat(nombres(usuarioService.findAll(TipoUsuario.REFERENTE, null, null, pagina(0, 20))))
                .containsExactly("Ana Referente", "Beto Referente", "Cora Referente");
        assertThat(usuarioService.findAll(TipoUsuario.ADMINISTRADOR, null, null, pagina(0, 20)).getTotalElements())
                .isEqualTo(1);
        assertThat(usuarioService.findAll(TipoUsuario.DONANTE, null, null, pagina(0, 20)).getTotalElements())
                .isEqualTo(3);
    }

    @Test
    void tipo_cuentaElTotalDelFiltroNoDeLaPagina() {
        Page<UsuarioResponse> p = usuarioService.findAll(TipoUsuario.REFERENTE, null, null, pagina(0, 2));

        assertThat(p.getTotalElements()).isEqualTo(3);
        assertThat(p.getContent()).hasSize(2);
    }

    @Test
    void activo_true_excluyeInactivos() {
        assertThat(nombres(usuarioService.findAll(TipoUsuario.REFERENTE, true, null, pagina(0, 20))))
                .containsExactly("Ana Referente", "Cora Referente");
    }

    @Test
    void activo_false_noFiltra() {
        assertThat(usuarioService.findAll(TipoUsuario.REFERENTE, false, null, pagina(0, 20)).getTotalElements())
                .isEqualTo(3);
    }

    @Test
    void q_buscaEnNombreOEmailSinMayusculas() {
        assertThat(nombres(usuarioService.findAll(null, null, "  ANA ", pagina(0, 20)))).containsExactly("Ana Referente");
        assertThat(nombres(usuarioService.findAll(null, null, "sur.org", pagina(0, 20)))).containsExactly("Cora Referente");
    }

    @Test
    void q_seCombinaConTipo() {
        assertThat(nombres(usuarioService.findAll(TipoUsuario.DONANTE, null, "test.com", pagina(0, 20))))
                .containsExactly("Dani Donante", "100% Donante", "Under_score");
        assertThat(usuarioService.findAll(TipoUsuario.REFERENTE, null, "dani", pagina(0, 20)).getTotalElements())
                .isZero();
    }

    @Test
    void q_escapaComodinesLike() {
        assertThat(nombres(usuarioService.findAll(null, null, "%", pagina(0, 20)))).containsExactly("100% Donante");
        assertThat(nombres(usuarioService.findAll(null, null, "_", pagina(0, 20)))).containsExactly("Under_score");
    }

    @Test
    void q_blancoEquivaleASinFiltro() {
        assertThat(usuarioService.findAll(null, null, "   ", pagina(0, 20)).getTotalElements()).isEqualTo(7);
    }
}
