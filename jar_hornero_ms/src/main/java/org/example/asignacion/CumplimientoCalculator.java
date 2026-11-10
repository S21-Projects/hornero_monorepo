package org.example.asignacion;

import lombok.RequiredArgsConstructor;
import org.example.asignacion.worker.dto.CumplimientoV1;
import org.example.domain.DonacionRepository;
import org.example.domain.EstadoDonacion;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Per-organización compliance-history counts (AD-11, slice 6b): one grouped query over
 * {@code donacion} rows, classifying {@code ENTREGADA} as entregada and {@code RECHAZADA} as
 * fallida. Every {@code CANCELADA} and non-terminal donación is excluded from both numerator and
 * denominator (`specs/asignacion-historial-cumplimiento/spec.md`). An organización absent from the
 * returned map has no resolved history — {@code EntradaRondaFactory} leaves its candidate's
 * {@code cumplimiento} field unset, and the worker resolves that to the ronda's neutral prior.
 */
@Component
@RequiredArgsConstructor
public class CumplimientoCalculator {

    private static final Set<EstadoDonacion> ESTADOS_RESUELTOS = Set.of(EstadoDonacion.ENTREGADA, EstadoDonacion.RECHAZADA);

    private final DonacionRepository donacionRepository;

    public Map<Long, CumplimientoV1> calcular() {
        Map<Long, CumplimientoV1> resultado = new HashMap<>();
        for (Object[] fila : donacionRepository.contarPorOrganizacionYEstado(ESTADOS_RESUELTOS)) {
            Long organizacionId = (Long) fila[0];
            EstadoDonacion estado = (EstadoDonacion) fila[1];
            int cantidad = ((Long) fila[2]).intValue();

            CumplimientoV1 cumplimiento = resultado.computeIfAbsent(organizacionId, id -> new CumplimientoV1(0, 0));
            if (estado == EstadoDonacion.ENTREGADA) {
                cumplimiento.setEntregadas(cantidad);
            } else if (estado == EstadoDonacion.RECHAZADA) {
                cumplimiento.setFallidas(cantidad);
            }
        }
        return resultado;
    }
}
