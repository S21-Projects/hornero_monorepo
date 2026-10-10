package org.example.organizacion;

import org.example.acreditacion.AcreditacionService;
import org.example.domain.NivelAcreditacion;
import org.example.domain.OrganizacionEvento;
import org.example.domain.OrganizacionEventoRepository;
import org.example.domain.TipoEventoOrganizacion;
import org.example.domain.TipoOrganizacion;
import org.example.organizacion.dto.CrearOrganizacionRequest;
import org.example.organizacion.dto.OrganizacionResponse;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * `specs/organizacion-evento-log/spec.md` "Registration emits its event": `crear()` appends
 * `ORGANIZACION_REGISTRADA` with `nivelAntes = null, nivelDespues = N0`.
 */
@DataJpaTest
@Import({OrganizacionService.class, AcreditacionService.class})
@org.springframework.boot.test.mock.mockito.MockBean(org.example.actividad.ActividadService.class)
class OrganizacionServiceCrearEventoTest {

    @Autowired
    private OrganizacionService organizacionService;

    @Autowired
    private OrganizacionEventoRepository eventoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Test
    void crearAppendsOrganizacionRegistradaWithNullAntesAndN0Despues() {
        Referente referente = usuarioRepository.save(new Referente(null, "Ref", "ref@test.com", "x", true));

        CrearOrganizacionRequest request = new CrearOrganizacionRequest(
                "Comedor Nuevo", TipoOrganizacion.COMEDOR, "desc", "Calle 1", -31.4, -64.2,
                null, null, null);

        OrganizacionResponse response = organizacionService.crear(request, referente.getId());

        List<OrganizacionEvento> eventos =
                eventoRepository.findByOrganizacion_IdOrderByOcurridoEnAscIdAsc(response.getId());
        assertThat(eventos).hasSize(1);
        assertThat(eventos.get(0).getTipo()).isEqualTo(TipoEventoOrganizacion.ORGANIZACION_REGISTRADA);
        assertThat(eventos.get(0).getNivelAntes()).isNull();
        assertThat(eventos.get(0).getNivelDespues()).isEqualTo(NivelAcreditacion.N0);
    }
}
