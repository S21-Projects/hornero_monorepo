package org.example.notificacion;

import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.ResultadoActividad;
import org.example.actividad.TipoActividad;
import org.example.domain.Articulo;
import org.example.domain.Donacion;
import org.example.domain.DonacionLinea;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.ModalidadDonacion;
import org.example.domain.Necesidad;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.UnidadArticulo;
import org.example.donacion.VentanasDonacion;
import org.example.mail.Mailer;
import org.example.mail.MensajeCorreo;
import org.example.notificacion.NotificacionEvento.*;
import org.example.user.Administrador;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * N13: which MensajeCorreo goes to whom for each event, with a capturing {@link Mailer} and mocked
 * repositories (the AFTER_COMMIT semantics live in {@code NotificacionAfterCommitIntegrationTest}).
 */
@ExtendWith(MockitoExtension.class)
class NotificacionServiceTest {

    private static final String PANEL = "https://panel.elhornero.org";
    private static final Instant AHORA = Instant.parse("2026-10-12T12:00:00Z");

    @Mock private DonacionRepository donacionRepository;
    @Mock private OrganizacionRepository organizacionRepository;
    @Mock private UsuarioRepository usuarioRepository;
    @Mock private ActividadService actividadService;
    @Mock private PlatformTransactionManager transactionManager;

    private final List<MensajeCorreo> enviados = new ArrayList<>();
    private Mailer mailer = enviados::add;

    private Donante donante;
    private Referente referente;
    private Organizacion org;
    private Donacion donacion;

    @BeforeEach
    void setUp() {
        donante = new Donante(2L, "Ana Donante", "ana@x.org", "x", true);
        donante.setEmailVerificado(true);
        referente = new Referente(1L, "Rosa Referente", "rosa@x.org", "x", true);
        referente.setEmailVerificado(true);
        org = organizacion(10L, "Comedor Sol", referente);
        donacion = donacion(5L, org);
        lenient().when(donacionRepository.findByIdWithRelations(5L)).thenReturn(Optional.of(donacion));
        lenient().when(organizacionRepository.findById(10L)).thenReturn(Optional.of(org));
    }

    private NotificacionService servicio(boolean habilitado) {
        return new NotificacionService(donacionRepository, organizacionRepository, usuarioRepository,
                mailer, actividadService, transactionManager, Clock.fixed(AHORA, ZoneOffset.UTC),
                VentanasDonacion.POR_DEFECTO, habilitado, PANEL + "/");
    }

    private static Organizacion organizacion(Long id, String nombre, Referente ref) {
        Organizacion o = new Organizacion();
        o.setId(id);
        o.setNombre(nombre);
        o.setReferente(ref);
        o.setNivel(NivelAcreditacion.N1);
        o.setEstado(EstadoOrganizacion.APROBADA);
        return o;
    }

    private Donacion donacion(Long id, Organizacion organizacion) {
        Necesidad n = new Necesidad();
        n.setId(100L + id);
        n.setOrganizacion(organizacion);
        Donacion d = new Donacion();
        d.setId(id);
        d.setDonante(donante);
        d.setNecesidad(n);
        d.setEstado(EstadoDonacion.OFRECIDA);
        d.setModalidad(ModalidadDonacion.DIRECTA);
        Articulo arroz = new Articulo();
        arroz.setId(1L);
        arroz.setNombre("Arroz");
        arroz.setUnidad(UnidadArticulo.KG);
        DonacionLinea linea = new DonacionLinea();
        linea.setArticulo(arroz);
        linea.setCantidad(new BigDecimal("5"));
        d.setLineas(List.of(linea));
        return d;
    }

    // --- DIRECTA offered -> referente ------------------------------------------------------------

    @Test
    void donacionOfrecida_tellsOnlyTheReferenteOfTheReceivingOrganization() {
        servicio(true).procesar(new DonacionOfrecida(5L));

        assertThat(enviados).hasSize(1);
        MensajeCorreo m = enviados.get(0);
        assertThat(m.to()).isEqualTo("rosa@x.org");
        assertThat(m.subject()).contains("Comedor Sol");
        assertThat(m.text()).contains("Ana Donante").contains("Arroz (5 KG)").contains(PANEL + "/dashboard");
    }

    @Test
    void donacionOfrecida_sendsNothingWhenTheReferenteIsInactiveUnverifiedOrMissing() {
        referente.setActivo(false);
        servicio(true).procesar(new DonacionOfrecida(5L));
        referente.setActivo(true);
        referente.setEmailVerificado(false);
        servicio(true).procesar(new DonacionOfrecida(5L));
        org.setReferente(null);
        servicio(true).procesar(new DonacionOfrecida(5L));

        assertThat(enviados).isEmpty();
    }

    // --- decision / expiry / delivery -> donante -------------------------------------------------

    @Test
    void donacionDecidida_aceptada_tellsTheDonante() {
        servicio(true).procesar(new DonacionDecidida(5L, true));

        assertThat(enviados).hasSize(1);
        assertThat(enviados.get(0).to()).isEqualTo("ana@x.org");
        assertThat(enviados.get(0).subject()).contains("aceptó").contains("Comedor Sol");
        assertThat(enviados.get(0).text()).contains(PANEL + "/mis-donaciones/5").contains("Arroz (5 KG)");
    }

    @Test
    void donacionDecidida_rechazada_tellsTheDonante() {
        servicio(true).procesar(new DonacionDecidida(5L, false));

        assertThat(enviados).hasSize(1);
        assertThat(enviados.get(0).to()).isEqualTo("ana@x.org");
        assertThat(enviados.get(0).subject()).contains("no fue aceptada");
    }

    @Test
    void donacionVencida_tellsTheDonanteWithTheConfiguredWindow() {
        servicio(true).procesar(new DonacionVencida(5L));

        assertThat(enviados).hasSize(1);
        assertThat(enviados.get(0).to()).isEqualTo("ana@x.org");
        assertThat(enviados.get(0).text()).contains("7 días").contains("Comedor Sol");
    }

    @Test
    void entregaConfirmada_tellsTheDonante() {
        servicio(true).procesar(new EntregaConfirmada(5L));

        assertThat(enviados).hasSize(1);
        assertThat(enviados.get(0).to()).isEqualTo("ana@x.org");
        assertThat(enviados.get(0).subject()).containsIgnoringCase("entrega");
    }

    @Test
    void donanteInactiveOrUnverified_isNeverNotified() {
        donante.setActivo(false);
        servicio(true).procesar(new DonacionDecidida(5L, true));
        donante.setActivo(true);
        donante.setEmailVerificado(false);
        servicio(true).procesar(new EntregaConfirmada(5L));

        assertThat(enviados).isEmpty();
    }

    // --- ronda: one email per referente ----------------------------------------------------------

    @Test
    void propuestasAsignadas_sendsOneSummaryPerReferenteGroupingTheirOrganizations() {
        Organizacion luna = organizacion(11L, "Comedor Luna", referente);
        Referente otro = new Referente(3L, "Otro Ref", "otro@x.org", "x", true);
        otro.setEmailVerificado(true);
        Organizacion estrella = organizacion(12L, "Merendero Estrella", otro);
        when(donacionRepository.findByIdWithRelations(6L)).thenReturn(Optional.of(donacion(6L, luna)));
        when(donacionRepository.findByIdWithRelations(7L)).thenReturn(Optional.of(donacion(7L, estrella)));
        when(donacionRepository.findByIdWithRelations(8L)).thenReturn(Optional.of(donacion(8L, luna)));

        servicio(true).procesar(new PropuestasAsignadas(List.of(5L, 6L, 7L, 8L)));

        assertThat(enviados).hasSize(2);
        MensajeCorreo deRosa = enviados.stream().filter(m -> m.to().equals("rosa@x.org")).findFirst().orElseThrow();
        assertThat(deRosa.subject()).contains("3 donaciones");
        assertThat(deRosa.text()).contains("Comedor Sol: 1 donación").contains("Comedor Luna: 2 donaciones");
        MensajeCorreo deOtro = enviados.stream().filter(m -> m.to().equals("otro@x.org")).findFirst().orElseThrow();
        assertThat(deOtro.subject()).contains("1 donación").doesNotContain("donaciones");
        assertThat(deOtro.text()).contains("Merendero Estrella: 1 donación");
    }

    @Test
    void propuestasAsignadas_skipsReferentesWhoCannotBeNotifiedWithoutFailingTheRest() {
        Referente inactivo = new Referente(3L, "Inactivo", "inactivo@x.org", "x", false);
        inactivo.setEmailVerificado(true);
        when(donacionRepository.findByIdWithRelations(6L))
                .thenReturn(Optional.of(donacion(6L, organizacion(11L, "Sin avisos", inactivo))));

        servicio(true).procesar(new PropuestasAsignadas(List.of(5L, 6L)));

        assertThat(enviados).extracting(MensajeCorreo::to).containsExactly("rosa@x.org");
    }

    // --- organization / accreditation -> referente ------------------------------------------------

    @Test
    void organizacionResuelta_aprobadaYRechazada_tellTheReferente() {
        servicio(true).procesar(new OrganizacionResuelta(10L, true));
        servicio(true).procesar(new OrganizacionResuelta(10L, false));

        assertThat(enviados).extracting(MensajeCorreo::to).containsOnly("rosa@x.org");
        assertThat(enviados.get(0).subject()).containsIgnoringCase("aprobada");
        assertThat(enviados.get(1).subject()).containsIgnoringCase("rechazada");
    }

    @Test
    void nivelAcreditacionCambiado_includesBothLevelsAndTheMotivo() {
        servicio(true).procesar(new NivelAcreditacionCambiado(10L, NivelAcreditacion.N2, NivelAcreditacion.N1,
                "Documentación vencida"));

        assertThat(enviados).hasSize(1);
        assertThat(enviados.get(0).to()).isEqualTo("rosa@x.org");
        assertThat(enviados.get(0).text()).contains("OPERATIVA").contains("IDENTIFICADA")
                .contains("Documentación vencida").contains(PANEL + "/acreditacion");
    }

    @Test
    void evidenciaObservada_includesTheObservation() {
        servicio(true).procesar(new EvidenciaObservada(10L, RequisitoAcreditacion.NO_DISCRIMINACION, "La foto no se ve"));

        assertThat(enviados).hasSize(1);
        assertThat(enviados.get(0).to()).isEqualTo("rosa@x.org");
        assertThat(enviados.get(0).text()).contains("La foto no se ve").contains("Comedor Sol");
    }

    // --- failures ----------------------------------------------------------------------------------

    @Test
    void mailerFailure_isRecordedInActividadMaskedAndNeverPropagates() {
        mailer = m -> { throw new IllegalStateException("provider down, key re_secret"); };

        assertThatCode(() -> servicio(true).procesar(new DonacionDecidida(5L, true))).doesNotThrowAnyException();

        ArgumentCaptor<Registro> captor = ArgumentCaptor.forClass(Registro.class);
        verify(actividadService).registrarAislado(captor.capture());
        Registro r = captor.getValue();
        assertThat(r.accion()).isEqualTo(TipoActividad.NOTIFICACION_FALLIDA);
        assertThat(r.resultado()).isEqualTo(ResultadoActividad.FALLO);
        assertThat(r.esSistema()).isTrue();
        assertThat(r.entidadTipo()).isEqualTo("DONACION");
        assertThat(r.entidadId()).isEqualTo(5L);
        assertThat(r.detalle()).contains("donacion-aceptada").contains("a***@x.org")
                .doesNotContain("ana@x.org").doesNotContain("re_secret");
    }

    @Test
    void oneFailedRecipient_doesNotStopTheOthers() {
        Referente otro = new Referente(3L, "Otro Ref", "otro@x.org", "x", true);
        otro.setEmailVerificado(true);
        when(donacionRepository.findByIdWithRelations(7L))
                .thenReturn(Optional.of(donacion(7L, organizacion(12L, "Merendero Estrella", otro))));
        mailer = m -> {
            if (m.to().equals("rosa@x.org")) {
                throw new IllegalStateException("boom");
            }
            enviados.add(m);
        };

        servicio(true).procesar(new PropuestasAsignadas(List.of(5L, 7L)));

        assertThat(enviados).extracting(MensajeCorreo::to).containsExactly("otro@x.org");
        verify(actividadService).registrarAislado(any(Registro.class));
    }

    @Test
    void buildFailure_isRecordedAndNeverPropagates() {
        when(donacionRepository.findByIdWithRelations(5L)).thenThrow(new IllegalStateException("db down"));

        assertThatCode(() -> servicio(true).procesar(new DonacionDecidida(5L, true))).doesNotThrowAnyException();

        ArgumentCaptor<Registro> captor = ArgumentCaptor.forClass(Registro.class);
        verify(actividadService).registrarAislado(captor.capture());
        assertThat(captor.getValue().accion()).isEqualTo(TipoActividad.NOTIFICACION_FALLIDA);
        assertThat(enviados).isEmpty();
    }

    // --- kill switch -------------------------------------------------------------------------------

    @Test
    void killSwitch_disablesEventsAndDigest() {
        NotificacionService apagado = servicio(false);

        assertThat(apagado.habilitado()).isFalse();
        apagado.procesar(new DonacionDecidida(5L, true));
        apagado.enviarDigest();

        assertThat(enviados).isEmpty();
        verifyNoInteractions(donacionRepository, organizacionRepository, usuarioRepository, actividadService);
    }

    // --- admin digest ------------------------------------------------------------------------------

    private Administrador admin(Long id, String email, boolean activo, boolean verificado) {
        Administrador a = new Administrador(id, "Admin " + id, email, "x", activo);
        a.setEmailVerificado(verificado);
        return a;
    }

    private void digestData(List<Organizacion> pendientes, long totalPend, List<Donacion> estancadas, long totalEst) {
        lenient().when(organizacionRepository.findByEstado(eq(EstadoOrganizacion.PENDIENTE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(pendientes, PageRequest.of(0, 20), totalPend));
        Page<Donacion> paginaEstancadas =
                new PageImpl<>(estancadas, PageRequest.of(0, 20), totalEst);
        lenient().when(donacionRepository.findActivas(any(), any(), eq(true), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(paginaEstancadas);
    }

    @Test
    void digest_goesToEveryActiveVerifiedAdminWithBothSections() {
        Donacion vieja = donacion(5L, org);
        vieja.setEstado(EstadoDonacion.ACEPTADA);
        vieja.setEstadoDesde(AHORA.minusSeconds(16L * 86400));
        digestData(List.of(organizacion(20L, "Pendiente Uno", null)), 1, List.of(vieja), 1);
        when(usuarioRepository.findAdministradoresActivos()).thenReturn(List.of(
                admin(30L, "a1@x.org", true, true), admin(31L, "a2@x.org", true, true),
                admin(32L, "noverif@x.org", true, false)));

        servicio(true).enviarDigest();

        assertThat(enviados).extracting(MensajeCorreo::to).containsExactlyInAnyOrder("a1@x.org", "a2@x.org");
        MensajeCorreo m = enviados.get(0);
        assertThat(m.subject()).containsIgnoringCase("resumen").contains("2 pendientes");
        assertThat(m.text()).contains("Pendiente Uno").contains("Donación #5").contains("Comedor Sol")
                .contains("16 días").contains(PANEL + "/control-donaciones");
    }

    @Test
    void digest_isSkippedWhenNothingIsPending() {
        digestData(List.of(), 0, List.of(), 0);

        servicio(true).enviarDigest();

        assertThat(enviados).isEmpty();
        verify(usuarioRepository, never()).findAdministradoresActivos();
    }

    @Test
    void digest_omitsAnEmptySectionAndCapsLongOnes() {
        List<Organizacion> veinte = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            veinte.add(organizacion(100L + i, "Pendiente " + i, null));
        }
        digestData(veinte, 27, List.of(), 0);
        when(usuarioRepository.findAdministradoresActivos()).thenReturn(List.of(admin(30L, "a1@x.org", true, true)));

        servicio(true).enviarDigest();

        assertThat(enviados).hasSize(1);
        assertThat(enviados.get(0).text()).contains("(27)").contains("Pendiente 20").contains("y 7 más")
                .doesNotContain("estancadas");
    }
}
