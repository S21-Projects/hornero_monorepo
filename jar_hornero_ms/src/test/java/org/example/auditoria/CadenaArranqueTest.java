package org.example.auditoria;

import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CadenaArranqueTest {

    @Test
    void sealsLegacyEventsOnceTheApplicationIsReady() {
        CadenaEventos cadena = mock(CadenaEventos.class);

        new CadenaArranque(cadena).alIniciar();

        verify(cadena).completarPendientes();
    }

    @Test
    void aFailingBackfillNeverStopsTheApplication() {
        CadenaEventos cadena = mock(CadenaEventos.class);
        when(cadena.completarPendientes()).thenThrow(new IllegalStateException("db down"));

        new CadenaArranque(cadena).alIniciar(); // must not throw
    }
}
