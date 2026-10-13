package org.example.donacion;

import lombok.RequiredArgsConstructor;
import org.example.domain.Donacion;
import org.example.domain.DonacionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * N15/D12 (policy 1.4): rounds the coordinates of a batch of donations to two decimals (~1 km).
 * One call is one transaction; {@link CoordenadasMinimizacionJob} chooses the batches. The job
 * calls this bean (not itself), so the proxy applies the transaction.
 */
@Service
@RequiredArgsConstructor
public class CoordenadasMinimizacionService {

    static final int DECIMALES = 2;

    private final DonacionRepository donacionRepository;

    /** Returns how many donations actually changed. */
    @Transactional
    public int minimizar(List<Long> ids) {
        int cambiadas = 0;
        for (Donacion d : donacionRepository.findAllById(ids)) {
            Double lat = redondear(d.getLatitud());
            Double lon = redondear(d.getLongitud());
            if (!java.util.Objects.equals(lat, d.getLatitud()) || !java.util.Objects.equals(lon, d.getLongitud())) {
                d.setLatitud(lat);
                d.setLongitud(lon);
                cambiadas++;
            }
        }
        return cambiadas;
    }

    /**
     * HALF_UP on the decimal representation of the double ({@code BigDecimal.valueOf} uses
     * {@code Double.toString}), so 10.125 becomes 10.13 as a person would read it, and negative
     * values round symmetrically. Idempotent: an already rounded value maps to itself.
     */
    static Double redondear(Double valor) {
        if (valor == null) {
            return null;
        }
        return BigDecimal.valueOf(valor).setScale(DECIMALES, RoundingMode.HALF_UP).doubleValue();
    }
}
