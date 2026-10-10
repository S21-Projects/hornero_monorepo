package org.example.asignacion;

import org.example.domain.Ronda;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** N7/D7: the scheduled ronda is opt-in and never throws out of the scheduler thread. */
class RondaAutomaticaJobTest {

    private final RondaService rondaService = mock(RondaService.class);
    private final RondaAutomaticaJob job = new RondaAutomaticaJob(rondaService);

    @Test
    void run_triggersTheAutomaticRonda() {
        when(rondaService.ejecutarAutomatica()).thenReturn(new Ronda());

        job.ejecutar();

        verify(rondaService).ejecutarAutomatica();
    }

    @Test
    void run_workerDown_isSkippedWithoutThrowing() {
        when(rondaService.ejecutarAutomatica())
                .thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "WORKER_NO_DISPONIBLE"));

        assertThatCode(job::ejecutar).doesNotThrowAnyException();
    }

    @Test
    void run_rondaAlreadyRunning_isSkippedWithoutThrowing() {
        when(rondaService.ejecutarAutomatica())
                .thenThrow(new ResponseStatusException(HttpStatus.CONFLICT, "RONDA_EN_CURSO"));

        assertThatCode(job::ejecutar).doesNotThrowAnyException();
    }

    @Test
    void run_unexpectedFailure_isSkippedWithoutThrowing() {
        when(rondaService.ejecutarAutomatica()).thenThrow(new IllegalStateException("boom"));

        assertThatCode(job::ejecutar).doesNotThrowAnyException();
    }

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(RondaAutomaticaJob.class)
            .withBean(RondaService.class, () -> rondaService);

    @Test
    void bean_absentByDefault() {
        runner.run(ctx -> assertThat(ctx).doesNotHaveBean(RondaAutomaticaJob.class));
    }

    @Test
    void bean_absentWhenExplicitlyDisabled() {
        runner.withPropertyValues("app.rondas.auto.enabled=false")
                .run(ctx -> assertThat(ctx).doesNotHaveBean(RondaAutomaticaJob.class));
    }

    @Test
    void bean_presentWhenEnabled() {
        runner.withPropertyValues("app.rondas.auto.enabled=true")
                .run(ctx -> assertThat(ctx).hasSingleBean(RondaAutomaticaJob.class));
    }
}
