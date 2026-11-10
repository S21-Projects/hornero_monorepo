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
import org.example.user.Usuario;

import java.time.Instant;

/**
 * An immutable row in the append-only accreditation audit trail (AD-1, AD-3). No {@code @Setter}
 * is declared: every field is populated once by the static factory {@link #de} and read-only
 * thereafter. Persistence is limited to insert and finder methods on
 * {@link OrganizacionEventoRepository} — append-only is enforced by the absence of an
 * update/delete operation, not by a runtime check alone.
 *
 * <p>{@code actor} is {@link Usuario}, not the {@code Administrador}-only type in AD-3's literal
 * snippet: Phase 2 adds referente-triggered events ({@code EVIDENCIA_ADJUNTADA},
 * {@code ORGANIZACION_REGISTRADA}) alongside the admin-triggered {@code NIVEL_*} events, so the
 * factory must accept any concrete {@link Usuario} subtype. {@code actorTipo} is derived the same
 * way {@code JwtService.resolveDiscriminatorValue} derives the JWT {@code tipo} claim, so the
 * stored value matches what the JWT would have carried for that actor.
 */
@Entity
@Table(
        name = "organizacion_evento",
        indexes = {
                @Index(name = "idx_evento_org_ocurrido", columnList = "organizacion_id, ocurrido_en"),
                // C4: two events of one organization can never share a predecessor, so the chain
                // cannot fork even if a writer forgot the row lock. NULLs (not yet sealed rows) are
                // distinct in PostgreSQL and H2, so the column can be added to a table with history.
                @Index(name = "ux_evento_org_prev_hash", columnList = "organizacion_id, prev_hash", unique = true)
        })
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

    /** Hash of the previous event of the same organization (64 zeros for the first). Null only before the C4 backfill. */
    @Column(name = "prev_hash", length = 64)
    private String prevHash;

    /** {@code SHA-256(prev_hash || canonical content)}, see {@code org.example.auditoria.CadenaHash}. */
    @Column(name = "hash", length = 64)
    private String hash;

    private OrganizacionEvento(
            Organizacion organizacion,
            TipoEventoOrganizacion tipo,
            Usuario actor,
            String motivo,
            NivelAcreditacion nivelAntes,
            NivelAcreditacion nivelDespues,
            RequisitoAcreditacion requisito,
            Long evidenciaId) {
        this.organizacion = organizacion;
        this.tipo = tipo;
        // Microseconds: the precision PostgreSQL stores, so the hashed value equals the value read back.
        this.ocurridoEn = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        this.actorUsuarioId = actor != null ? actor.getId() : null;
        this.actorTipo = actor != null ? resolveDiscriminatorValue(actor) : "SISTEMA";
        this.nivelAntes = nivelAntes;
        this.nivelDespues = nivelDespues;
        this.requisito = requisito;
        this.evidenciaId = evidenciaId;
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
            Usuario actor,
            String motivo,
            NivelAcreditacion nivelAntes,
            NivelAcreditacion nivelDespues) {
        return new OrganizacionEvento(organizacion, tipo, actor, motivo, nivelAntes, nivelDespues, null, null);
    }

    /**
     * Same as {@link #de} but also stamps the {@code requisito}/{@code evidenciaId} columns, for
     * evidence-lifecycle events ({@code EVIDENCIA_ADJUNTADA}, {@code EVIDENCIA_REEMPLAZADA},
     * {@code REQUISITO_APROBADO}, {@code REQUISITO_OBSERVADO}) where the level does not change.
     */
    public static OrganizacionEvento deEvidencia(
            Organizacion organizacion,
            TipoEventoOrganizacion tipo,
            Usuario actor,
            String motivo,
            RequisitoAcreditacion requisito,
            Long evidenciaId) {
        return new OrganizacionEvento(organizacion, tipo, actor, motivo, null, null, requisito, evidenciaId);
    }

    /**
     * Stamps the chain links, once, by the single chain writer ({@code org.example.auditoria}).
     * Everything else about the row stays read-only.
     */
    public void sellar(String prevHash, String hash) {
        if (this.hash != null) {
            throw new IllegalStateException("event already sealed");
        }
        this.prevHash = prevHash;
        this.hash = hash;
    }

    /** Same reflection pattern as {@code JwtService.resolveDiscriminatorValue}. */
    private static String resolveDiscriminatorValue(Usuario usuario) {
        jakarta.persistence.DiscriminatorValue annotation =
                usuario.getClass().getAnnotation(jakarta.persistence.DiscriminatorValue.class);
        if (annotation != null) {
            return annotation.value();
        }
        return usuario.getClass().getSimpleName().toUpperCase();
    }
}
