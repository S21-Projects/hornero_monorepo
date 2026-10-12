package org.example.notificacion;

import org.example.actividad.ActividadService;
import org.example.actividad.ResultadoActividad;
import org.example.actividad.TipoActividad;
import org.example.domain.Articulo;
import org.example.domain.ArticuloRepository;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.DonacionLinea;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.domain.UnidadArticulo;
import org.example.donacion.DonacionService;
import org.example.mail.Mailer;
import org.example.mail.MensajeCorreo;
import org.example.organizacion.OrganizacionService;
import org.example.user.Administrador;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * N13 AFTER_COMMIT semantics with real transactions: deliberately NOT {@code @Transactional}, because
 * a test-managed transaction never commits and would hide exactly what is being proven. The mailer
 * is a capturing one, and {@code app.mail.async=false} (test profile) runs the handler inline, so
 * every assertion is deterministic.
 */
@SpringBootTest
@Import(NotificacionAfterCommitIntegrationTest.CapturingMailerConfig.class)
class NotificacionAfterCommitIntegrationTest {

    static final List<MensajeCorreo> ENVIADOS = new CopyOnWriteArrayList<>();
    static final AtomicBoolean FALLAR = new AtomicBoolean(false);

    @TestConfiguration
    static class CapturingMailerConfig {
        @Bean
        @Primary
        Mailer capturingMailer() {
            return mensaje -> {
                if (FALLAR.get()) {
                    throw new IllegalStateException("provider down for " + mensaje.to());
                }
                ENVIADOS.add(mensaje);
            };
        }
    }

    @Autowired private DonacionService donacionService;
    @Autowired private OrganizacionService organizacionService;
    @Autowired private ApplicationEventPublisher publisher;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private ActividadService actividadService;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private NecesidadRepository necesidadRepository;
    @Autowired private ArticuloRepository articuloRepository;
    @Autowired private DonacionRepository donacionRepository;

    private TransactionTemplate tx;
    private Long donacionId;
    private Long referenteId;
    private String emailDonante;

    @BeforeEach
    void setUp() {
        ENVIADOS.clear();
        FALLAR.set(false);
        tx = new TransactionTemplate(transactionManager);
        String sufijo = UUID.randomUUID().toString().substring(0, 8);
        emailDonante = "don-" + sufijo + "@test.com";
        Referente referente = new Referente(null, "Ref " + sufijo, "ref-" + sufijo + "@test.com", "hash", true);
        referente.setEmailVerificado(true);
        referente = (Referente) usuarioRepository.save(referente);
        referenteId = referente.getId();
        Donante donante = new Donante(null, "Don " + sufijo, emailDonante, "hash", true);
        donante.setEmailVerificado(true);
        donante = (Donante) usuarioRepository.save(donante);

        Organizacion org = new Organizacion();
        org.setNombre("Org notif " + sufijo);
        org.setValidada(true);
        org.setNivel(NivelAcreditacion.N1);
        org.setEstado(EstadoOrganizacion.APROBADA);
        org.setReferente(referente);
        org = organizacionRepository.save(org);

        Articulo arroz = new Articulo();
        arroz.setNombre("Arroz notif " + sufijo);
        arroz.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        arroz.setUnidad(UnidadArticulo.KG);
        arroz.setActivo(true);
        articuloRepository.save(arroz);

        Necesidad necesidad = new Necesidad();
        necesidad.setOrganizacion(org);
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setPrioridad(PrioridadNecesidad.MEDIA);
        necesidad.setFechaVencimiento(LocalDate.now().plusDays(30));
        necesidad = necesidadRepository.save(necesidad);

        Donacion d = new Donacion();
        d.setDonante(donante);
        d.setNecesidad(necesidad);
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setModalidad(ModalidadDonacion.DIRECTA);
        d.setCategoria(CategoriaAlimento.NO_PERECEDERO);
        d.setFechaOferta(LocalDate.now());
        DonacionLinea linea = new DonacionLinea();
        linea.setArticulo(arroz);
        linea.setCantidad(new BigDecimal("5"));
        linea.setDonacion(d);
        d.getLineas().add(linea);
        donacionId = donacionRepository.save(d).getId();
    }

    @Test
    void rolledBackTransaction_sendsNothing() {
        tx.executeWithoutResult(status -> {
            publisher.publishEvent(new NotificacionEvento.DonacionDecidida(donacionId, true));
            status.setRollbackOnly();
        });

        assertThat(ENVIADOS).isEmpty();
    }

    @Test
    void transactionThatThrows_sendsNothing() {
        try {
            tx.executeWithoutResult(status -> {
                publisher.publishEvent(new NotificacionEvento.DonacionDecidida(donacionId, true));
                throw new IllegalStateException("business failure after publishing");
            });
        } catch (IllegalStateException esperado) {
            // expected
        }

        assertThat(ENVIADOS).isEmpty();
    }

    @Test
    void committedTransaction_sendsExactlyOnce() {
        tx.executeWithoutResult(status ->
                publisher.publishEvent(new NotificacionEvento.DonacionDecidida(donacionId, true)));

        assertThat(ENVIADOS).hasSize(1);
        assertThat(ENVIADOS.get(0).to()).isEqualTo(emailDonante);
    }

    @Test
    void eventPublishedOutsideAnyTransaction_isNotSent() {
        publisher.publishEvent(new NotificacionEvento.DonacionDecidida(donacionId, true));

        assertThat(ENVIADOS).isEmpty();
    }

    @Test
    void realService_decidir_tellsTheDonanteOnceAfterCommit() {
        donacionService.decidir(donacionId, EstadoDonacion.ACEPTADA, referenteId);

        assertThat(ENVIADOS).hasSize(1);
        MensajeCorreo m = ENVIADOS.get(0);
        assertThat(m.to()).isEqualTo(emailDonante);
        assertThat(m.subject()).contains("aceptó");
        assertThat(m.text()).contains("Arroz notif").contains("/mis-donaciones/" + donacionId);
    }

    @Test
    void realService_rolledBackByTheOuterTransaction_sendsNothingAndKeepsTheState() {
        Organizacion pendiente = new Organizacion();
        pendiente.setNombre("Pendiente notif " + UUID.randomUUID());
        pendiente.setEstado(EstadoOrganizacion.PENDIENTE);
        pendiente.setNivel(NivelAcreditacion.N0);
        pendiente.setReferente((Referente) usuarioRepository.findById(referenteId).orElseThrow());
        Long pendienteId = organizacionRepository.save(pendiente).getId();
        Administrador admin = usuarioRepository.save(new Administrador(null, "Admin " + UUID.randomUUID(),
                "adm-" + UUID.randomUUID() + "@test.com", "hash", true));

        tx.executeWithoutResult(status -> {
            organizacionService.validar(pendienteId, admin.getId());
            status.setRollbackOnly();
        });

        assertThat(ENVIADOS).isEmpty();
        assertThat(organizacionRepository.findById(pendienteId).orElseThrow().getEstado())
                .isEqualTo(EstadoOrganizacion.PENDIENTE);
    }

    @Test
    void realService_committedValidation_tellsTheReferenteOnce() {
        Organizacion pendiente = new Organizacion();
        pendiente.setNombre("Pendiente ok " + UUID.randomUUID());
        pendiente.setEstado(EstadoOrganizacion.PENDIENTE);
        pendiente.setNivel(NivelAcreditacion.N0);
        pendiente.setReferente((Referente) usuarioRepository.findById(referenteId).orElseThrow());
        Long pendienteId = organizacionRepository.save(pendiente).getId();
        Administrador admin = usuarioRepository.save(new Administrador(null, "Admin " + UUID.randomUUID(),
                "adm-" + UUID.randomUUID() + "@test.com", "hash", true));

        organizacionService.validar(pendienteId, admin.getId());

        assertThat(ENVIADOS).hasSize(1);
        assertThat(ENVIADOS.get(0).subject()).containsIgnoringCase("aprobada");
    }

    @Test
    void providerFailure_neverBreaksTheRequest_andIsRecordedInActividadMasked() {
        FALLAR.set(true);

        donacionService.decidir(donacionId, EstadoDonacion.ACEPTADA, referenteId);

        assertThat(donacionRepository.findById(donacionId).orElseThrow().getEstado()).isEqualTo(EstadoDonacion.ACEPTADA);
        var registros = actividadService.buscar(new ActividadService.Filtro(null, TipoActividad.NOTIFICACION_FALLIDA,
                ResultadoActividad.FALLO, "DONACION", donacionId, null, null), PageRequest.of(0, 10));
        assertThat(registros.getContent()).hasSize(1);
        String detalle = registros.getContent().get(0).getDetalle();
        assertThat(detalle).contains("donacion-aceptada").contains("***@test.com").doesNotContain(emailDonante);
    }
}
