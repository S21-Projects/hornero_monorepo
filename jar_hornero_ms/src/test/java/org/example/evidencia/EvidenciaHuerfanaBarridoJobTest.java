package org.example.evidencia;

import org.example.actividad.ActividadService;
import org.example.actividad.ActividadService.Registro;
import org.example.actividad.TipoActividad;
import org.example.domain.ReclamoOrganizacionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EvidenciaHuerfanaBarridoJobTest {

    private static final Instant AHORA = Instant.parse("2026-06-15T12:00:00Z");
    private static final Instant VIEJO = AHORA.minus(Duration.ofDays(30));
    private static final Instant RECIENTE = AHORA.minus(Duration.ofDays(1));

    @Mock
    private ReclamoOrganizacionRepository reclamoRepository;
    @Mock
    private ActividadService actividadService;

    private final EvidenciaAlmacenEnMemoria almacen = new EvidenciaAlmacenEnMemoria();
    private final Clock clock = Clock.fixed(AHORA, ZoneOffset.UTC);

    private EvidenciaHuerfanaBarridoJob job(boolean habilitado, int max) {
        return new EvidenciaHuerfanaBarridoJob(almacen, reclamoRepository, actividadService, clock, habilitado, 7, max);
    }

    @Test
    void deletesOnlyOldUnreferencedClaimKeys_andRecordsACountOnlySummary() {
        almacen.con("reclamo-evidencia/1/7/huerfana-vieja.jpg", VIEJO)
                .con("reclamo-evidencia/1/7/referenciada-vieja.jpg", VIEJO)
                .con("reclamo-evidencia/1/7/huerfana-reciente.jpg", RECIENTE)
                .con("reclamo-evidencia/sin-patron.jpg", VIEJO)
                .con("org-evidencia/1/vieja.pdf", VIEJO)
                .con("org-banner/1/vieja.png", VIEJO);
        when(reclamoRepository.findAllEvidenciaKeys()).thenReturn(List.of("reclamo-evidencia/1/7/referenciada-vieja.jpg"));

        int borrados = job(true, 500).ejecutar();

        assertThat(borrados).isEqualTo(1);
        assertThat(almacen.claves()).containsExactlyInAnyOrder(
                "reclamo-evidencia/1/7/referenciada-vieja.jpg", "reclamo-evidencia/1/7/huerfana-reciente.jpg",
                "reclamo-evidencia/sin-patron.jpg", "org-evidencia/1/vieja.pdf", "org-banner/1/vieja.png");
        ArgumentCaptor<Registro> captor = ArgumentCaptor.forClass(Registro.class);
        verify(actividadService).registrarAislado(captor.capture());
        Registro r = captor.getValue();
        assertThat(r.accion()).isEqualTo(TipoActividad.EVIDENCIA_HUERFANA_BORRADA);
        assertThat(r.esSistema()).isTrue();
        assertThat(r.detalle()).isEqualTo("1 archivos de evidencia huérfanos borrados");
    }

    @Test
    void deletesAtMostTheCapPerRun_oldestFirst() {
        for (int i = 0; i < 600; i++) {
            almacen.con("reclamo-evidencia/1/7/f" + i + ".jpg", VIEJO.plusSeconds(i));
        }
        when(reclamoRepository.findAllEvidenciaKeys()).thenReturn(List.of());

        int borrados = job(true, 500).ejecutar();

        assertThat(borrados).isEqualTo(500);
        assertThat(almacen.claves()).hasSize(100)
                .contains("reclamo-evidencia/1/7/f599.jpg").doesNotContain("reclamo-evidencia/1/7/f0.jpg");
    }

    @Test
    void nothingEligible_recordsNothing() {
        almacen.con("reclamo-evidencia/1/7/reciente.jpg", RECIENTE);
        when(reclamoRepository.findAllEvidenciaKeys()).thenReturn(List.of());

        assertThat(job(true, 500).ejecutar()).isZero();

        assertThat(almacen.claves()).containsExactly("reclamo-evidencia/1/7/reciente.jpg");
        verify(actividadService, never()).registrarAislado(any());
    }

    @Test
    void killSwitchOff_listsAndDeletesNothing() {
        almacen.con("reclamo-evidencia/1/7/huerfana-vieja.jpg", VIEJO);

        assertThat(job(false, 500).ejecutar()).isZero();

        assertThat(almacen.listados).isZero();
        assertThat(almacen.claves()).containsExactly("reclamo-evidencia/1/7/huerfana-vieja.jpg");
        verifyNoInteractions(reclamoRepository, actividadService);
    }
}
