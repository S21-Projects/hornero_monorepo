package org.example.notificacion;

import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.donacion.DonacionService;
import org.example.mail.Mailer;
import org.example.mail.MensajeCorreo;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/** N13 global kill switch ({@code NOTIFICACIONES_ENABLED=false}) with the whole context wired. */
@SpringBootTest(properties = "app.notificaciones.enabled=false")
@Import(NotificacionKillSwitchIntegrationTest.CapturingMailerConfig.class)
class NotificacionKillSwitchIntegrationTest {

    static final List<MensajeCorreo> ENVIADOS = new CopyOnWriteArrayList<>();

    @TestConfiguration
    static class CapturingMailerConfig {
        @Bean
        @Primary
        Mailer capturingMailer() {
            return ENVIADOS::add;
        }
    }

    @Autowired private DonacionService donacionService;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private NecesidadRepository necesidadRepository;
    @Autowired private DonacionRepository donacionRepository;

    @Test
    void disabled_decisionStillWorksButNoEmailLeaves() {
        String sufijo = UUID.randomUUID().toString().substring(0, 8);
        Referente referente = new Referente(null, "Ref", "ref-" + sufijo + "@test.com", "hash", true);
        referente.setEmailVerificado(true);
        referente = (Referente) usuarioRepository.save(referente);
        Donante donante = new Donante(null, "Don", "don-" + sufijo + "@test.com", "hash", true);
        donante.setEmailVerificado(true);
        donante = (Donante) usuarioRepository.save(donante);
        Organizacion org = new Organizacion();
        org.setNombre("Org kill " + sufijo);
        org.setNivel(NivelAcreditacion.N1);
        org.setReferente(referente);
        org = organizacionRepository.save(org);
        Necesidad necesidad = new Necesidad();
        necesidad.setOrganizacion(org);
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setPrioridad(PrioridadNecesidad.MEDIA);
        necesidad = necesidadRepository.save(necesidad);
        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setNecesidad(necesidad);
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setModalidad(ModalidadDonacion.DIRECTA);
        d.setFechaOferta(LocalDate.now());
        Long id = donacionRepository.save(d).getId();

        donacionService.decidir(id, EstadoDonacion.ACEPTADA, referente.getId());

        assertThat(donacionRepository.findById(id).orElseThrow().getEstado()).isEqualTo(EstadoDonacion.ACEPTADA);
        assertThat(ENVIADOS).isEmpty();
    }
}
