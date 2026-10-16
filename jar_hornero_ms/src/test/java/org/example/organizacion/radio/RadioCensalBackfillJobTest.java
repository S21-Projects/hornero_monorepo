package org.example.organizacion.radio;

import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.support.TransactionOperations;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Hourly self-healing backfill of {@code codigo_radio} (spec organizacion-radio-censal). */
@ExtendWith(MockitoExtension.class)
class RadioCensalBackfillJobTest {

    @Mock
    private OrganizacionRepository organizacionRepository;

    @Mock
    private RadioCensalClient radioCensalClient;

    private Organizacion organizacion(long id, double lat, double lng) {
        Organizacion o = new Organizacion();
        o.setId(id);
        o.setLatitud(lat);
        o.setLongitud(lng);
        return o;
    }

    private RadioCensalBackfillJob job() {
        return new RadioCensalBackfillJob(organizacionRepository, radioCensalClient,
                TransactionOperations.withoutTransaction(), 500);
    }

    @Test
    void fillsTheResolvedOnesAndLeavesTheUnresolvedForALaterRun() {
        Organizacion resuelta = organizacion(1L, -31.41, -64.18);
        Organizacion sinRadio = organizacion(2L, 0.0, 0.0);
        when(organizacionRepository.findPendientesDeRadio(PageRequest.of(0, 500)))
                .thenReturn(List.of(resuelta, sinRadio));
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(resuelta));
        when(radioCensalClient.resolver(-31.41, -64.18)).thenReturn(Optional.of("140140101"));
        when(radioCensalClient.resolver(0.0, 0.0)).thenReturn(Optional.empty());

        int rellenadas = job().ejecutar();

        assertThat(rellenadas).isEqualTo(1);
        assertThat(resuelta.getCodigoRadio()).isEqualTo("140140101");
        assertThat(sinRadio.getCodigoRadio()).isNull();
        verify(organizacionRepository).save(resuelta);
        verify(organizacionRepository, never()).save(sinRadio);
    }

    @Test
    void aConflictingWriteIsSkippedAndTheRunContinues() {
        Organizacion conflicto = organizacion(1L, -31.41, -64.18);
        Organizacion siguiente = organizacion(2L, -31.42, -64.19);
        when(organizacionRepository.findPendientesDeRadio(any())).thenReturn(List.of(conflicto, siguiente));
        when(organizacionRepository.findById(1L)).thenReturn(Optional.of(conflicto));
        when(organizacionRepository.findById(2L)).thenReturn(Optional.of(siguiente));
        when(radioCensalClient.resolver(-31.41, -64.18)).thenReturn(Optional.of("140140101"));
        when(radioCensalClient.resolver(-31.42, -64.19)).thenReturn(Optional.of("140140102"));
        when(organizacionRepository.save(conflicto)).thenThrow(new OptimisticLockingFailureException("stale"));

        int rellenadas = job().ejecutar();

        assertThat(rellenadas).isEqualTo(1);
        assertThat(siguiente.getCodigoRadio()).isEqualTo("140140102");
    }
}
