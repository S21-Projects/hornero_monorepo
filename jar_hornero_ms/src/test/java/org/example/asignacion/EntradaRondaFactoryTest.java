package org.example.asignacion;

import org.example.acreditacion.AcreditacionService;
import org.example.asignacion.worker.dto.CumplimientoV1;
import org.example.asignacion.worker.dto.EntradaRondaV1;
import org.example.domain.CategoriaAlimento;
import org.example.domain.Donacion;
import org.example.domain.EstadoNecesidad;
import org.example.domain.Necesidad;
import org.example.domain.NivelAcreditacion;
import org.example.domain.Organizacion;
import org.example.domain.PrioridadNecesidad;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Attaches the compliance-history counts onto each candidate's wire DTO (AD-11, slice 6b.2/6b.6).
 */
@ExtendWith(MockitoExtension.class)
class EntradaRondaFactoryTest {

    @Mock
    private AcreditacionService acreditacionService;

    @Mock
    private CumplimientoCalculator cumplimientoCalculator;

    private EntradaRondaFactory entradaRondaFactory;

    @BeforeEach
    void setUp() {
        entradaRondaFactory = new EntradaRondaFactory(acreditacionService, cumplimientoCalculator);
        when(acreditacionService.categoriasPermitidas(any()))
                .thenReturn(Set.of(CategoriaAlimento.NO_PERECEDERO));
    }

    private Organizacion organizacion(long id) {
        Organizacion org = new Organizacion();
        org.setId(id);
        org.setNivel(NivelAcreditacion.N1);
        org.setLatitud(-31.40);
        org.setLongitud(-64.20);
        return org;
    }

    private Necesidad necesidad(long id, Organizacion org) {
        Necesidad n = new Necesidad();
        n.setId(id);
        n.setOrganizacion(org);
        n.setPrioridad(PrioridadNecesidad.NORMAL);
        n.setEstado(EstadoNecesidad.ABIERTA);
        return n;
    }

    @Test
    void candidateWithHistory_getsCumplimientoCounts() {
        Organizacion org = organizacion(8L);
        Necesidad necesidad = necesidad(40L, org);
        when(cumplimientoCalculator.calcular()).thenReturn(Map.of(8L, new CumplimientoV1(8, 1)));

        EntradaRondaV1 entrada = entradaRondaFactory.crear(
                List.of(), List.of(necesidad), Map.of(), Map.of(), LocalDate.now());

        assertThat(entrada.getCandidatos()).hasSize(1);
        CumplimientoV1 cumplimiento = entrada.getCandidatos().get(0).getCumplimiento();
        assertThat(cumplimiento).isNotNull();
        assertThat(cumplimiento.getEntregadas()).isEqualTo(8);
        assertThat(cumplimiento.getFallidas()).isEqualTo(1);
    }

    @Test
    void candidateWithoutHistory_cumplimientoIsNull() {
        Organizacion org = organizacion(9L);
        Necesidad necesidad = necesidad(41L, org);
        when(cumplimientoCalculator.calcular()).thenReturn(Map.of());

        EntradaRondaV1 entrada = entradaRondaFactory.crear(
                List.of(), List.of(necesidad), Map.of(), Map.of(), LocalDate.now());

        assertThat(entrada.getCandidatos().get(0).getCumplimiento()).isNull();
    }

    @Test
    void calculatorIsCalledOnlyOncePerCrear_notOncePerCandidate() {
        Organizacion org1 = organizacion(1L);
        Organizacion org2 = organizacion(2L);
        Necesidad n1 = necesidad(100L, org1);
        Necesidad n2 = necesidad(101L, org2);
        when(cumplimientoCalculator.calcular()).thenReturn(Map.of());

        entradaRondaFactory.crear(List.of(), List.of(n1, n2), Map.of(), Map.of(), LocalDate.now());

        org.mockito.Mockito.verify(cumplimientoCalculator, org.mockito.Mockito.times(1)).calcular();
    }
}
