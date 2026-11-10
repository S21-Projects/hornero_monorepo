package org.example.acreditacion;

import org.example.acreditacion.dto.EvidenciaEnColaResponse;
import org.example.domain.EstadoEvidencia;
import org.example.domain.EstadoOrganizacion;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.OrganizacionEvidencia;
import org.example.domain.RequisitoAcreditacion;
import org.example.domain.TipoEvidencia;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EvidenciaVigenciaJobTest {

    @Test
    void aFailingRowIsSkippedAndTheRestOfTheRunContinues() {
        VigenciaEvidenciaService servicio = mock(VigenciaEvidenciaService.class);
        when(servicio.idsParaVencer()).thenReturn(List.of(1L, 2L, 3L));
        when(servicio.vencer(1L)).thenReturn(true);
        when(servicio.vencer(2L)).thenThrow(new IllegalStateException("boom"));
        when(servicio.vencer(3L)).thenReturn(false);
        when(servicio.idsParaRecordar()).thenReturn(List.of(9L));
        when(servicio.recordar(9L)).thenReturn(true);

        EvidenciaVigenciaJob.Resumen r = new EvidenciaVigenciaJob(servicio).ejecutar();

        assertThat(r).isEqualTo(new EvidenciaVigenciaJob.Resumen(1, 1, 1));
    }

    @Test
    void aFailingListingNeverEscapes() {
        VigenciaEvidenciaService servicio = mock(VigenciaEvidenciaService.class);
        when(servicio.idsParaVencer()).thenThrow(new IllegalStateException("db down"));

        EvidenciaVigenciaJob.Resumen r = new EvidenciaVigenciaJob(servicio).ejecutar();

        assertThat(r).isEqualTo(new EvidenciaVigenciaJob.Resumen(0, 0, 0));
        verify(servicio, never()).vencer(org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void theQueueRowFlagsGraceOverOnlyAfterItsLastDay() {
        Organizacion org = new Organizacion();
        org.setNombre("Comedor");
        org.setEstado(EstadoOrganizacion.APROBADA);
        org.setNivel(NivelAcreditacion.N1);
        OrganizacionEvidencia dentro = vencida(org, LocalDate.now().minusDays(30));
        OrganizacionEvidencia fuera = vencida(org, LocalDate.now().minusDays(31));

        EvidenciaEnColaResponse a = EvidenciaEnColaResponse.from(dentro, 30);
        EvidenciaEnColaResponse b = EvidenciaEnColaResponse.from(fuera, 30);

        assertThat(a.estado()).isEqualTo(EstadoEvidencia.VENCIDA);
        assertThat(a.graciaHasta()).isEqualTo(LocalDate.now());
        assertThat(a.graciaVencida()).isFalse();
        assertThat(b.graciaVencida()).isTrue();
    }

    private static OrganizacionEvidencia vencida(Organizacion org, LocalDate validoHasta) {
        org.setId(1L);
        OrganizacionEvidencia e = OrganizacionEvidencia.nueva(org, RequisitoAcreditacion.NO_DISCRIMINACION,
                TipoEvidencia.DECLARACION, "d", validoHasta.minusYears(1), validoHasta, 1L);
        e.setEstado(EstadoEvidencia.VENCIDA);
        return e;
    }
}
