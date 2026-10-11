package org.example.idempotencia;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * One {@code Idempotency-Key} seen by the MS (N11). Keys are scoped per authenticated user and
 * per operation ({@code POST /api/donaciones}, ...), so the same UUID used by two users, or on two
 * endpoints, never collides. The unique constraint is what makes "first writer wins" atomic.
 *
 * <p>{@code huella} is the SHA-256 of the request (path, query and canonicalized JSON body); it
 * detects a key reused with a different payload. The stored response is the full enveloped body so
 * a replay is byte-for-byte what the client would have received.
 */
@Entity
@Table(
        name = "idempotency_keys",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_idempotency_usuario_clave_operacion",
                columnNames = {"usuario_id", "clave", "operacion"}),
        indexes = @Index(name = "idx_idempotency_expira", columnList = "expira_en"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ClaveIdempotencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private Long usuarioId;

    /** Normalized (lower-case) UUID. */
    @Column(nullable = false, updatable = false, length = 36)
    private String clave;

    /** HTTP method plus route pattern, e.g. {@code POST /api/necesidades/{id}/relanzar}. */
    @Column(nullable = false, updatable = false, length = 200)
    private String operacion;

    @Column(nullable = false, length = 64)
    private String huella;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoIdempotencia estado;

    @Column(name = "respuesta_status")
    private Integer respuestaStatus;

    @Column(name = "respuesta_body", columnDefinition = "text")
    private String respuestaBody;

    @Column(name = "creada_en", nullable = false)
    private Instant creadaEn;

    @Column(name = "expira_en", nullable = false)
    private Instant expiraEn;

    public static ClaveIdempotencia enProceso(Long usuarioId, String clave, String operacion, String huella,
                                              Instant ahora, Instant expiraEn) {
        ClaveIdempotencia c = new ClaveIdempotencia();
        c.usuarioId = usuarioId;
        c.clave = clave;
        c.operacion = operacion;
        c.huella = huella;
        c.estado = EstadoIdempotencia.EN_PROCESO;
        c.creadaEn = ahora;
        c.expiraEn = expiraEn;
        return c;
    }
}
