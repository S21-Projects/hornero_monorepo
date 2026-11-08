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
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One immutable-content row per requisito submission (AD-4, `specs/organizacion-evidencia/spec.md`
 * "One Evidence Row Per Requisito Submission"). {@code estado}/{@code revisadoPor}/
 * {@code revisadoEn}/{@code observacion} are the only mutable fields — content
 * ({@code objectKey}, {@code declaracion}, the validity window) is never rewritten in place; a
 * correction is a new row plus marking the previous one {@code REEMPLAZADA}.
 */
@Entity
@Table(
        name = "organizacion_evidencia",
        indexes = @Index(name = "idx_evidencia_org", columnList = "organizacion_id"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrganizacionEvidencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organizacion_id", nullable = false)
    private Organizacion organizacion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RequisitoAcreditacion requisito;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_evidencia", nullable = false)
    private TipoEvidencia tipoEvidencia;

    /** R2 key under {@code org-evidencia/{orgId}/} — Slice B only; Slice A rejects a non-null value. */
    @Column(name = "object_key")
    private String objectKey;

    @Column(length = 2000)
    private String declaracion;

    @Column(name = "valido_desde")
    private LocalDate validoDesde;

    /** {@code null} means never expires. */
    @Column(name = "valido_hasta")
    private LocalDate validoHasta;

    /** The one mutable field: {@code PENDIENTE -> APROBADA|OBSERVADA}, and {@code * -> REEMPLAZADA}. */
    @Setter
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoEvidencia estado;

    @Column(name = "cargado_por", nullable = false)
    private Long cargadoPor;

    @Column(name = "cargado_en", nullable = false)
    private Instant cargadoEn;

    @Setter
    @Column(name = "revisado_por")
    private Long revisadoPor;

    @Setter
    @Column(name = "revisado_en")
    private Instant revisadoEn;

    /** The auditor's note on {@code OBSERVADA}. */
    @Setter
    @Column(length = 1000)
    private String observacion;

    /**
     * Set once by the retention job when the file was deleted from the bucket. The row, its
     * {@code objectKey} and its events stay; downloads of the file answer 410 from then on.
     */
    @Setter
    @Column(name = "archivo_eliminado_at")
    private Instant archivoEliminadoAt;

    private OrganizacionEvidencia(
            Organizacion organizacion,
            RequisitoAcreditacion requisito,
            TipoEvidencia tipoEvidencia,
            String declaracion,
            LocalDate validoDesde,
            LocalDate validoHasta,
            Long cargadoPor,
            String objectKey) {
        this.organizacion = organizacion;
        this.requisito = requisito;
        this.tipoEvidencia = tipoEvidencia;
        this.objectKey = objectKey;
        this.declaracion = declaracion;
        this.validoDesde = validoDesde != null ? validoDesde : LocalDate.now();
        this.validoHasta = validoHasta;
        this.estado = EstadoEvidencia.PENDIENTE;
        this.cargadoPor = cargadoPor;
        this.cargadoEn = Instant.now();
    }

    /**
     * Builds one new {@code PENDIENTE} evidencia row. {@code validoDesde} defaults to today.
     * Delegates to the {@code objectKey}-carrying overload with {@code null} — Slice A callers
     * (and every existing positional call site) keep compiling untouched.
     */
    public static OrganizacionEvidencia nueva(
            Organizacion organizacion,
            RequisitoAcreditacion requisito,
            TipoEvidencia tipoEvidencia,
            String declaracion,
            LocalDate validoDesde,
            LocalDate validoHasta,
            Long cargadoPor) {
        return nueva(organizacion, requisito, tipoEvidencia, declaracion, validoDesde, validoHasta,
                cargadoPor, null);
    }

    /**
     * Slice B overload: carries {@code objectKey} through to the persisted row for FOTO/DOCUMENTO
     * submissions. {@code specs/organizacion-evidencia/spec.md} — content fields are set once at
     * construction and never rewritten in place.
     */
    public static OrganizacionEvidencia nueva(
            Organizacion organizacion,
            RequisitoAcreditacion requisito,
            TipoEvidencia tipoEvidencia,
            String declaracion,
            LocalDate validoDesde,
            LocalDate validoHasta,
            Long cargadoPor,
            String objectKey) {
        return new OrganizacionEvidencia(
                organizacion, requisito, tipoEvidencia, declaracion, validoDesde, validoHasta, cargadoPor,
                objectKey);
    }

    /**
     * Record-and-warn expiry (AD-9, `specs/organizacion-evidencia/spec.md` "Record-and-Warn
     * Expiry"): derived on read, never persisted, never a side-effecting trigger.
     */
    public boolean isExpirada() {
        return validoHasta != null && validoHasta.isBefore(LocalDate.now());
    }
}
