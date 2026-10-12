package org.example.domain;

import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** M3: the public listing query hides expired necesidades and those of N0 (or null-level) organizations. */
@DataJpaTest
class NecesidadRepositoryVisibilidadTest {

    @Autowired private NecesidadRepository necesidades;
    @Autowired private OrganizacionRepository organizaciones;
    @Autowired private UsuarioRepository usuarios;

    private Organizacion org(String nombre, NivelAcreditacion nivel, Referente referente) {
        Organizacion o = new Organizacion();
        o.setNombre(nombre);
        o.setNivel(nivel);
        o.setReferente(referente);
        return organizaciones.save(o);
    }

    private Necesidad necesidad(Organizacion o, String desc, EstadoNecesidad estado) {
        Necesidad n = new Necesidad();
        n.setDescripcion(desc);
        n.setPrioridad(PrioridadNecesidad.NORMAL);
        n.setEstado(estado);
        n.setFechaPublicacion(LocalDate.now());
        n.setOrganizacion(o);
        return necesidades.save(n);
    }

    private Referente referente(String email) {
        Referente r = new Referente();
        r.setNombre("Ref");
        r.setEmail(email);
        r.setPassword("x");
        r.setActivo(true);
        return (Referente) usuarios.save(r);
    }

    @Test
    void findPublicas_hidesN0AndNullLevelAndExpired_butKeepsOwnN0() {
        Referente dueno = referente("dueno@test.com");
        Referente otro = referente("otro@test.com");
        Organizacion n1 = org("Aprobada", NivelAcreditacion.N1, otro);
        Organizacion n0 = org("Retirada", NivelAcreditacion.N0, dueno);
        Organizacion sinNivel = org("SinNivel", null, null);
        necesidad(n1, "visible", EstadoNecesidad.ABIERTA);
        necesidad(n1, "vencida", EstadoNecesidad.VENCIDA);
        necesidad(n0, "de-n0", EstadoNecesidad.ABIERTA);
        necesidad(sinNivel, "sin-nivel", EstadoNecesidad.ABIERTA);

        var anonimo = necesidades.findPublicas(null, PageRequest.of(0, 20));
        var delOtro = necesidades.findPublicas(otro.getId(), PageRequest.of(0, 20));
        var delDueno = necesidades.findPublicas(dueno.getId(), PageRequest.of(0, 20));

        assertThat(anonimo.getContent()).extracting(Necesidad::getDescripcion).containsExactly("visible");
        assertThat(anonimo.getTotalElements()).isEqualTo(1);
        assertThat(delOtro.getContent()).extracting(Necesidad::getDescripcion).containsExactly("visible");
        assertThat(delDueno.getContent()).extracting(Necesidad::getDescripcion)
                .containsExactlyInAnyOrder("visible", "de-n0");
    }
}
