package org.example.reclamo;

import org.example.acreditacion.AcreditacionService;
import org.example.actividad.ActividadService;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.ReclamoOrganizacion;
import org.example.domain.ReclamoOrganizacionRepository;
import org.example.domain.RolReclamo;
import org.example.organizacion.OrganizacionService;
import org.example.reclamo.dto.CrearReclamoRequest;
import org.example.user.Administrador;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Mock-level guards: DB-only races (unique index, row lock) that H2 slices cannot reproduce. */
class ReclamoServiceGuardsTest {

    private final ReclamoOrganizacionRepository reclamoRepository = mock(ReclamoOrganizacionRepository.class);
    private final OrganizacionRepository organizacionRepository = mock(OrganizacionRepository.class);
    private final UsuarioRepository usuarioRepository = mock(UsuarioRepository.class);
    private final OrganizacionService organizacionService = mock(OrganizacionService.class);
    private final ReclamoService service = new ReclamoService(reclamoRepository, organizacionRepository,
            usuarioRepository, organizacionService, mock(AcreditacionService.class), mock(ActividadService.class));

    private Referente referente() {
        return new Referente(7L, "Ana", "ana@test.com", "x", true);
    }

    private Organizacion org(EstadoOrganizacion estado) {
        Organizacion o = new Organizacion();
        o.setId(4L);
        o.setNombre("Comedor");
        o.setEstado(estado);
        return o;
    }

    private static void assertStatus(Runnable r, HttpStatus status) {
        assertThatThrownBy(r::run).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(status));
    }

    @Test
    void crear_mapsTheUniqueIndexViolationToTheSame409AsTheExistsCheck() {
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(referente()));
        when(organizacionRepository.findById(4L)).thenReturn(Optional.of(org(EstadoOrganizacion.SIN_RECLAMAR)));
        when(reclamoRepository.saveAndFlush(any(ReclamoOrganizacion.class)))
                .thenThrow(new DataIntegrityViolationException("ux_reclamo_pendiente"));

        assertThatThrownBy(() -> service.crear(new CrearReclamoRequest(4L, RolReclamo.RESPONSABLE, "351 555 1234",
                null, List.of("reclamo-evidencia/4/7/1.jpg")), 7L))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).isEqualTo(ReclamoService.MSG_RECLAMO_PENDIENTE);
                });
    }

    @Test
    void verificarReclamable_appliesTheSameRulesAsCrear() {
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(referente()));
        when(usuarioRepository.findById(8L)).thenReturn(Optional.of(new Donante(8L, "D", "d@test.com", "x", true)));
        when(organizacionRepository.findById(4L)).thenReturn(Optional.of(org(EstadoOrganizacion.SIN_RECLAMAR)));
        when(organizacionRepository.findById(5L)).thenReturn(Optional.of(org(EstadoOrganizacion.APROBADA)));

        service.verificarReclamable(4L, 7L); // claimable: no exception

        assertStatus(() -> service.verificarReclamable(999L, 7L), HttpStatus.NOT_FOUND);
        assertStatus(() -> service.verificarReclamable(5L, 7L), HttpStatus.CONFLICT);
        assertStatus(() -> service.verificarReclamable(4L, 8L), HttpStatus.FORBIDDEN);

        when(reclamoRepository.existsByOrganizacion_IdAndReferente_IdAndEstado(anyLong(), anyLong(), any()))
                .thenReturn(true);
        assertStatus(() -> service.verificarReclamable(4L, 7L), HttpStatus.CONFLICT);

        when(reclamoRepository.existsByOrganizacion_IdAndReferente_IdAndEstado(anyLong(), anyLong(), any()))
                .thenReturn(false);
        when(organizacionService.contarACargo(7L)).thenReturn(3L);
        assertStatus(() -> service.verificarReclamable(4L, 7L), HttpStatus.CONFLICT);
    }

    @Test
    void asignarPorReclamo_locksTheReferenteRowBeforeCountingTheCap() {
        OrganizacionRepository orgRepo = mock(OrganizacionRepository.class);
        UsuarioRepository userRepo = mock(UsuarioRepository.class);
        OrganizacionService orgService = new OrganizacionService(orgRepo, userRepo,
                mock(AcreditacionService.class), mock(ActividadService.class),
                mock(org.springframework.context.ApplicationEventPublisher.class));
        Referente ana = referente();
        when(userRepo.findByIdForUpdate(7L)).thenReturn(Optional.of(ana));
        when(orgRepo.countByReferente_IdAndEstadoNot(anyLong(), any())).thenReturn(0L);
        when(orgRepo.saveAndFlush(any(Organizacion.class))).thenAnswer(i -> i.getArgument(0));

        orgService.asignarPorReclamo(org(EstadoOrganizacion.SIN_RECLAMAR), ana,
                new Administrador(1L, "Admin", "a@test.com", "x", true));

        InOrder order = inOrder(userRepo, orgRepo);
        order.verify(userRepo).findByIdForUpdate(7L);
        order.verify(orgRepo).countByReferente_IdAndEstadoNot(anyLong(), any());
    }

    @Test
    void asignarPorReclamo_whenCapReached_is409_andNothingIsSaved() {
        OrganizacionRepository orgRepo = mock(OrganizacionRepository.class);
        UsuarioRepository userRepo = mock(UsuarioRepository.class);
        OrganizacionService orgService = new OrganizacionService(orgRepo, userRepo,
                mock(AcreditacionService.class), mock(ActividadService.class),
                mock(org.springframework.context.ApplicationEventPublisher.class));
        Referente ana = referente();
        when(userRepo.findByIdForUpdate(7L)).thenReturn(Optional.of(ana));
        when(orgRepo.countByReferente_IdAndEstadoNot(anyLong(), any())).thenReturn(3L);

        assertStatus(() -> orgService.asignarPorReclamo(org(EstadoOrganizacion.SIN_RECLAMAR), ana,
                new Administrador(1L, "Admin", "a@test.com", "x", true)), HttpStatus.CONFLICT);
        verify(orgRepo, never()).saveAndFlush(any());
    }
}
