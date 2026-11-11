package org.example.asignacion;

import org.example.domain.Asignacion;
import org.example.domain.AsignacionRepository;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoAsignacion;
import org.example.domain.EstadoRonda;
import org.example.domain.EstadoDonacion;
import org.example.domain.ModalidadDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.OrganizacionRepository;
import org.example.domain.OrigenRonda;
import org.example.domain.Ronda;
import org.example.domain.RondaRepository;
import org.example.user.Donante;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** {@code findByRondaIdConRelaciones}: only the ronda's rows, best score first, ties by id. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class AsignacionPorRondaIntegrationTest {

    @Autowired private AsignacionRepository asignacionRepository;
    @Autowired private RondaRepository rondaRepository;
    @Autowired private DonacionRepository donacionRepository;
    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private NecesidadRepository necesidadRepository;
    @Autowired private UsuarioRepository usuarioRepository;

    private Ronda ronda() {
        Ronda r = new Ronda();
        r.setEjecutadaEn(Instant.now());
        r.setOrigen(OrigenRonda.MANUAL);
        r.setEstado(EstadoRonda.COMPLETADA);
        return rondaRepository.save(r);
    }

    private Donante donante;

    private Asignacion asignacion(Ronda ronda, Organizacion org, double score) {
        Asignacion a = new Asignacion();
        a.setRonda(ronda);
        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setModalidad(ModalidadDonacion.FONDO_COMUN);
        a.setDonacion(donacionRepository.save(d));
        a.setOrganizacion(org);
        Necesidad n = new Necesidad();
        n.setOrganizacion(org);
        n.setEstado(EstadoNecesidad.ABIERTA);
        n.setPrioridad(PrioridadNecesidad.MEDIA);
        a.setNecesidad(necesidadRepository.save(n));
        a.setEstado(EstadoAsignacion.PROPUESTA);
        a.setScore(score);
        a.setCreadaEn(Instant.now());
        return asignacionRepository.save(a);
    }

    @Test
    void ordersByScoreDescThenId_andExcludesOtherRondas() {
        String s = UUID.randomUUID().toString().substring(0, 8);
        donante = (Donante) usuarioRepository.save(
                new Donante(null, "Donante ronda " + s, "ronda-" + s + "@test.com", "hash", true));
        Organizacion org = new Organizacion();
        org.setNombre("Comedor ronda " + UUID.randomUUID());
        org = organizacionRepository.save(org);
        Ronda mia = ronda();
        Ronda otra = ronda();
        Asignacion bajo = asignacion(mia, org, 1.0);
        Asignacion altoPrimero = asignacion(mia, org, 5.0);
        Asignacion altoSegundo = asignacion(mia, org, 5.0);
        asignacion(otra, org, 99.0);

        var result = asignacionRepository.findByRondaIdConRelaciones(mia.getId());

        assertThat(result).extracting(Asignacion::getId)
                .containsExactly(altoPrimero.getId(), altoSegundo.getId(), bajo.getId());
    }
}
