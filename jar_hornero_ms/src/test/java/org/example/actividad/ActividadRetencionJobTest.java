package org.example.actividad;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ActividadRetencionJobTest {

    @Autowired
    private ActividadRepository repository;

    @Autowired
    private ActividadService service;

    @Autowired
    private ActividadRetencionJob job;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void purge_deletesOnlyRowsOlderThanTheRetentionWindow_andRecordsItself() {
        String marca = "ret-" + UUID.randomUUID();
        Clock hace400dias = Clock.fixed(Instant.now().minus(Duration.ofDays(400)), java.time.ZoneOffset.UTC);
        new ActividadService(repository, hace400dias, transactionManager).registrarAislado(
                ActividadService.Registro.de(TipoActividad.LOGIN).entidad("RET", 1L).detalle(marca + " vieja"));
        service.registrarAislado(ActividadService.Registro.de(TipoActividad.LOGIN).entidad("RET", 1L).detalle(marca + " reciente"));

        int borradas = job.purgar();

        assertThat(borradas).isGreaterThanOrEqualTo(1);
        var restantes = service.buscar(new ActividadService.Filtro(null, null, null, "RET", 1L, null, null),
                PageRequest.of(0, 50)).getContent();
        assertThat(restantes).extracting(Actividad::getDetalle).contains(marca + " reciente").doesNotContain(marca + " vieja");
        var purgas = service.buscar(new ActividadService.Filtro(null, TipoActividad.ACTIVIDAD_PURGADA, null, null, null, null, null),
                PageRequest.of(0, 5)).getContent();
        assertThat(purgas).isNotEmpty();
        assertThat(purgas.get(0).getActorTipo()).isEqualTo(TipoActor.SISTEMA);
    }
}
