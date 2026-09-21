package org.example.acreditacion;

import org.example.domain.CategoriaAlimento;
import org.example.domain.NivelAcreditacion;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.OrganizacionEvidenciaRepository;
import org.example.domain.OrganizacionRepository;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * `specs/organizacion-acreditacion/spec.md` "Level-Driven Food Category Caps":
 * {@code categoriasPermitidas(nivel)} returns the category set an organizacion at that level may
 * declare on a {@code necesidad}. N1 permits non-perishable categories only; N2 additionally
 * permits refrigerated and frozen categories; N3 permits all categories; N0 permits none (it
 * cannot publish a {@code necesidad} at all — "Level-Driven Concurrency Caps").
 */
@ExtendWith(MockitoExtension.class)
class AcreditacionServiceCategoriasPermitidasTest {

    @Mock
    private OrganizacionEventoRepository eventoRepository;

    @Mock
    private OrganizacionEvidenciaRepository evidenciaRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private OrganizacionRepository organizacionRepository;

    @InjectMocks
    private AcreditacionService acreditacionService;

    @Test
    void n0PermitsNoCategory() {
        assertThat(acreditacionService.categoriasPermitidas(NivelAcreditacion.N0)).isEmpty();
    }

    @Test
    void n1PermitsOnlyNonPerishable() {
        assertThat(acreditacionService.categoriasPermitidas(NivelAcreditacion.N1))
                .containsExactly(CategoriaAlimento.NO_PERECEDERO);
    }

    @Test
    void n2AdditionallyPermitsRefrigeradoAndCongelado() {
        assertThat(acreditacionService.categoriasPermitidas(NivelAcreditacion.N2))
                .containsExactlyInAnyOrder(
                        CategoriaAlimento.NO_PERECEDERO,
                        CategoriaAlimento.REFRIGERADO,
                        CategoriaAlimento.CONGELADO);
    }

    @Test
    void n3PermitsAllCategories() {
        assertThat(acreditacionService.categoriasPermitidas(NivelAcreditacion.N3))
                .containsExactlyInAnyOrder(CategoriaAlimento.values())
                .isEqualTo(Set.of(CategoriaAlimento.values()));
    }
}
