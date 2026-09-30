package org.example.donacion.entrega;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.domain.Donacion;
import org.example.donacion.ParticipantesDonacion;

import java.time.Instant;

/**
 * A single delivery-code issuance for one donación and one party (AD-6). Only the BCrypt hash of
 * the plaintext 6-digit code is persisted, mirroring {@code CodigoVerificacion} (email OTP).
 */
@Entity
@Table(name = "codigos_entrega")
@Getter
@Setter
@NoArgsConstructor
public class CodigoEntrega {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "donacion_id", nullable = false)
    private Donacion donacion;

    @Column(name = "emisor_id", nullable = false)
    private Long emisorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "emisor_parte", nullable = false)
    private ParticipantesDonacion.Parte emisorParte;

    @Column(name = "codigo_hash", nullable = false)
    private String codigoHash;

    @Column(name = "expira_en", nullable = false)
    private Instant expiraEn;

    @Column(nullable = false)
    private int intentos = 0;

    @Column(nullable = false)
    private boolean usado = false;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;
}
