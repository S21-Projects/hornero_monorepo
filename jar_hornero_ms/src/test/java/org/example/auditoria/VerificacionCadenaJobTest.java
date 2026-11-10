package org.example.auditoria;

import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class VerificacionCadenaJobTest {

    private final AuditoriaCadenaServicio servicio = mock(AuditoriaCadenaServicio.class);
    private final VerificacionCadenaJob job = new VerificacionCadenaJob(servicio);

    @Test
    void theScheduledRunAndTheStartupRunBothDelegateToTheDailyExecution() {
        job.programado();
        job.alIniciar();

        org.mockito.Mockito.verify(servicio, org.mockito.Mockito.times(2)).ejecutarDiaria();
    }

    @Test
    void aFailureNeverEscapesTheJob() {
        when(servicio.ejecutarDiaria()).thenThrow(new IllegalStateException("db down"));

        job.programado(); // must not throw
        job.alIniciar();

        verify(servicio, org.mockito.Mockito.times(2)).ejecutarDiaria();
    }
}
