package org.example.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.example.user.Administrador;

import java.time.Instant;

/**
 * An immutable row in the append-only accreditation audit trail (AD-1, AD-3). No {@code @Setter}
 * is declared: every field is populated once by the static factory {@link #de} and read-only
 * thereafter. Persistence is limited to insert and finder methods on
 * {@link OrganizacionEventoRepository} — append-only is enforced by the absence of an
 * update/delete operation, not by a runtime check alone.
 */
@Entity
@Table(
        name = "organizacion_evento",
        indexes = @Index(name = "idx_evento_org_ocurrido", columnList = "organizacion_id, ocurrido_en"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrganizacionEvento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organizacion_id", nullable = false)
    private Organizacion organizacion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoEventoOrganizacion tipo;

    @Column(name = "ocurrido_en", nullable = false)
    private Instant ocurridoEn;

    @Column(name = "actor_usuario_id")
    private Long actorUsuarioId;

    /** JWT {@code tipo} discriminator of the actor, or {@code SISTEMA} for the backfill (AD-7). */
    @Column(name = "actor_tipo")
    private String actorTipo;

    @Enumerated(EnumType.STRING)
    @Column(name = "nivel_antes")
    private NivelAcreditacion nivelAntes;

    /** Non-null only on level-changing events; other event types leave this null. */
    @Enumerated(EnumType.STRING)
    @Column(name = "nivel_despues")
    private NivelAcreditacion nivelDespues;

    @Enumerated(EnumType.STRING)
    @Column
    private RequisitoAcreditacion requisito;

    @Column(name = "evidencia_id")
    private Long evidenciaId;

    @Column(length = 1000)
    private String motivo;

    /** Canonical JSON (AD-5) stored as text — never {@code jsonb}, which PostgreSQL normalizes. */
    @Column(columnDefinition = "text")
    private String payload;

    private OrganizacionEvento(
            Organizacion organizacion,
            TipoEventoOrganizacion tipo,
            Administrador actor,
            String motivo,
            NivelAcreditacion nivelAntes,
            NivelAcreditacion nivelDespues) {
        this.organizacion = organizacion;
        this.tipo = tipo;
        this.ocurridoEn = Instant.now();
        this.actorUsuarioId = actor != null ? actor.getId() : null;
        this.actorTipo = actor != null ? "ADMINISTRADOR" : "SISTEMA";
        this.nivelAntes = nivelAntes;
        this.nivelDespues = nivelDespues;
        this.motivo = motivo;
    }

    /**
     * Builds one immutable event row. {@code actor} may be {@code null} to record a
     * system-originated fact (e.g. the startup backfill, AD-7), which stores
     * {@code actorTipo = "SISTEMA"} and a {@code null actorUsuarioId}.
     */
    public static OrganizacionEvento de(
            Organizacion organizacion,
            TipoEventoOrganizacion tipo,
            Administrador actor,
            String motivo,
            NivelAcreditacion nivelAntes,
            NivelAcreditacion nivelDespues) {
        return new OrganizacionEvento(organizacion, tipo, actor, motivo, nivelAntes, nivelDespues);
    }
}
