package org.example.actividad;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * N15/D12 (policy 1.5): the email typed in failed logins is nulled after 90 days; the row itself
 * stays until the 365-day retention. On H2 there is no trigger; the PostgreSQL side is verified
 * with psql (docs/db-changes.md, V006).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class EmailIntentoPurgaJobTest {

    @Autowired
    private ActividadRepository repository;
    @Autowired
    private ActividadService service;
    @Autowired
    private EmailIntentoPurgaJob job;
    @Autowired
    private PlatformTransactionManager transactionManager;

    private void registrarHace(long dias, String marca, String email) {
        Clock reloj = Clock.fixed(Instant.now().minus(Duration.ofDays(dias)), ZoneOffset.UTC);
        new ActividadService(repository, reloj, transactionManager).registrarAislado(
                ActividadService.Registro.de(TipoActividad.LOGIN).fallo().entidad("EMAILPURGA", 1L)
                        .detalle(marca).emailIntento(email));
    }

    private List<Actividad> filas() {
        return service.buscar(new ActividadService.Filtro(null, null, null, "EMAILPURGA", 1L, null, null),
                PageRequest.of(0, 50)).getContent();
    }

    @Test
    void nullsOnlyOldEmails_keepsTheRowAndEverythingElse() {
        String marca = "ep-" + UUID.randomUUID();
        registrarHace(100, marca + " vieja", "viejo@test.com");
        registrarHace(89, marca + " reciente", "reciente@test.com");

        int n = job.ejecutar();

        assertThat(n).isGreaterThanOrEqualTo(1);
        Actividad vieja = filas().stream().filter(a -> (marca + " vieja").equals(a.getDetalle())).findFirst().orElseThrow();
        Actividad reciente = filas().stream().filter(a -> (marca + " reciente").equals(a.getDetalle())).findFirst().orElseThrow();
        assertThat(vieja.getEmailIntento()).isNull();
        assertThat(vieja.getAccion()).isEqualTo(TipoActividad.LOGIN);
        assertThat(vieja.getResultado()).isEqualTo(ResultadoActividad.FALLO);
        assertThat(reciente.getEmailIntento()).isEqualTo("reciente@test.com");
    }

    @Test
    void isIdempotent_andRecordsASystemSummaryOnlyWhenRowsChanged() {
        registrarHace(120, "ep-" + UUID.randomUUID(), "otro@test.com");

        assertThat(job.ejecutar()).isGreaterThanOrEqualTo(1);
        assertThat(job.ejecutar()).isZero();

        var resumenes = service.buscar(new ActividadService.Filtro(null, TipoActividad.EMAIL_INTENTO_PURGADO, null,
                null, null, null, null), PageRequest.of(0, 5)).getContent();
        assertThat(resumenes).isNotEmpty();
        assertThat(resumenes.get(0).getActorTipo()).isEqualTo(TipoActor.SISTEMA);
    }
}
