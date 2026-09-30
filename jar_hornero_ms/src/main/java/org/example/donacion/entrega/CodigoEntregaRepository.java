package org.example.donacion.entrega;

import org.example.donacion.ParticipantesDonacion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CodigoEntregaRepository extends JpaRepository<CodigoEntrega, Long> {

    Optional<CodigoEntrega> findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc(
            Long donacionId, ParticipantesDonacion.Parte emisorParte);

    List<CodigoEntrega> findByDonacion_IdAndEmisorIdAndUsadoFalse(Long donacionId, Long emisorId);
}
