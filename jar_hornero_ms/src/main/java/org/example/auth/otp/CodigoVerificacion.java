package org.example.auth.otp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A single OTP issuance for a given email. Only the BCrypt hash of the
 * plaintext code is persisted, never the code itself.
 */
@Entity
@Table(name = "codigos_verificacion")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CodigoVerificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String codigoHash;

    @Column(nullable = false)
    private Instant expiraEn;

    @Column(nullable = false)
    private int intentos = 0;

    @Column(nullable = false)
    private boolean usado = false;

    @Column(nullable = false)
    private Instant creadoEn;
}
