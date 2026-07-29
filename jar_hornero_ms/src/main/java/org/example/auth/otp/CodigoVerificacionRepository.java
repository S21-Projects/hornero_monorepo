package org.example.auth.otp;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CodigoVerificacionRepository extends JpaRepository<CodigoVerificacion, Long> {

    Optional<CodigoVerificacion> findTopByEmailAndUsadoFalseOrderByCreadoEnDesc(String email);
}
