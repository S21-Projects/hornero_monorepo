package org.example.donacion.entrega;

import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.Necesidad;
import org.example.domain.NecesidadRepository;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.example.domain.PrioridadNecesidad;
import org.example.donacion.ParticipantesDonacion;
import org.example.user.Donante;
import org.example.user.Referente;
import org.example.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Attempt/expiry bookkeeping must survive the {@link ResponseStatusException} that verificar
 * throws afterwards. Deliberately NOT {@code @Transactional}: a test-managed transaction would mask
 * a rollback of the service's own transaction, so the service is called through the Spring proxy
 * and state is re-read from the repository.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class EntregaServiceLockoutIntegrationTest {

    @Autowired private EntregaService entregaService;
    @Autowired private DonacionRepository donacionRepository;
    @Autowired private NecesidadRepository necesidadRepository;
    @Autowired private OrganizacionRepository organizacionRepository;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private CodigoEntregaRepository codigoEntregaRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private record Fixture(Long donacionId, Long donanteId, Long codigoReferenteId) {}

    /** The referente's code is the one the donante verifies. */
    private Fixture fixture(Instant expiraEn) {
        long n = System.nanoTime();
        Donante donante = usuarioRepository.save(new Donante(null, "Donante Lockout", "donante-lock-" + n + "@test.com", "x", true));
        Referente referente = usuarioRepository.save(new Referente(null, "Referente Lockout", "ref-lock-" + n + "@test.com", "x", true));

        Organizacion org = new Organizacion();
        org.setNombre("Comedor Lockout");
        org.setSlug("comedor-lockout-" + n);
        org.setEstado(EstadoOrganizacion.APROBADA);
        org.setReferente(referente);
        org = organizacionRepository.save(org);

        Necesidad necesidad = new Necesidad();
        necesidad.setDescripcion("Arroz");
        necesidad.setPrioridad(PrioridadNecesidad.NORMAL);
        necesidad.setEstado(EstadoNecesidad.ABIERTA);
        necesidad.setOrganizacion(org);
        necesidad = necesidadRepository.save(necesidad);

        Donacion donacion = new Donacion();
        donacion.setDonante(donante);
        donacion.setNecesidad(necesidad);
        donacion.setEstado(EstadoDonacion.EN_CAMINO);
        donacion = donacionRepository.save(donacion);

        CodigoEntrega codigo = new CodigoEntrega();
        codigo.setDonacion(donacion);
        codigo.setEmisorId(referente.getId());
        codigo.setEmisorParte(ParticipantesDonacion.Parte.REFERENTE);
        codigo.setCodigoHash(passwordEncoder.encode("111111"));
        codigo.setExpiraEn(expiraEn);
        codigo.setIntentos(0);
        codigo.setUsado(false);
        codigo.setCreadoEn(Instant.now());
        codigo = codigoEntregaRepository.save(codigo);

        return new Fixture(donacion.getId(), donante.getId(), codigo.getId());
    }

    private HttpStatus verificarFallando(Fixture f, String codigo) {
        try {
            entregaService.verificar(f.donacionId(), f.donanteId(), codigo);
        } catch (ResponseStatusException e) {
            return HttpStatus.valueOf(e.getStatusCode().value());
        }
        throw new AssertionError("expected verificar to throw");
    }

    @Test
    void wrongCode_persistsTheAttemptCounter() {
        Fixture f = fixture(Instant.now().plus(10, ChronoUnit.MINUTES));

        assertThat(verificarFallando(f, "000000")).isEqualTo(HttpStatus.BAD_REQUEST);

        CodigoEntrega persisted = codigoEntregaRepository.findById(f.codigoReferenteId()).orElseThrow();
        assertThat(persisted.getIntentos()).isEqualTo(1);
        assertThat(persisted.isUsado()).isFalse();
    }

    @Test
    void fifthWrongCode_locksTheCode_andTheCorrectCodeIsRefusedAfterwards() {
        Fixture f = fixture(Instant.now().plus(10, ChronoUnit.MINUTES));

        for (int i = 0; i < 4; i++) {
            assertThat(verificarFallando(f, "000000")).isEqualTo(HttpStatus.BAD_REQUEST);
        }
        assertThat(verificarFallando(f, "000000")).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);

        CodigoEntrega persisted = codigoEntregaRepository.findById(f.codigoReferenteId()).orElseThrow();
        assertThat(persisted.isUsado()).isTrue();
        assertThat(persisted.getIntentos()).isEqualTo(5);

        assertThat(verificarFallando(f, "111111")).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(donacionRepository.findById(f.donacionId()).orElseThrow().getConfirmadaDonanteEn()).isNull();
    }

    @Test
    void expiredCode_isMarkedUsed() {
        Fixture f = fixture(Instant.now().minus(1, ChronoUnit.MINUTES));

        assertThat(verificarFallando(f, "111111")).isEqualTo(HttpStatus.GONE);

        assertThat(codigoEntregaRepository.findById(f.codigoReferenteId()).orElseThrow().isUsado()).isTrue();
    }

    @Test
    void correctCode_stillConfirmsTheDonante() {
        Fixture f = fixture(Instant.now().plus(10, ChronoUnit.MINUTES));

        assertThatThrownBy(() -> { throw new ResponseStatusException(HttpStatus.OK); }).isInstanceOf(ResponseStatusException.class);
        entregaService.verificar(f.donacionId(), f.donanteId(), "111111");

        assertThat(codigoEntregaRepository.findById(f.codigoReferenteId()).orElseThrow().isUsado()).isTrue();
        assertThat(donacionRepository.findById(f.donacionId()).orElseThrow().getConfirmadaDonanteEn()).isNotNull();
    }
}
