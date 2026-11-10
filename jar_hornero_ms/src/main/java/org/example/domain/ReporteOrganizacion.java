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
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.example.user.Administrador;
import org.example.user.Usuario;

import java.time.Instant;

/**
 * A user's report that an unclaimed (ReNaCoM-imported) organizacion is closed, wrong or duplicated.
 * Only an administrador resolves it; the organizacion does not change until then. The table is
 * created by {@code ddl-auto=update}; {@code ux_reporte_pendiente} (V009) backs the one-pending-
 * report-per-user-per-organizacion rule under races.
 */
@Entity
@Table(
        name = "reportes_organizacion",
        indexes = {
                @Index(name = "idx_reporte_org_estado", columnList = "organizacion_id, estado"),
                @Index(name = "idx_reporte_reportante", columnList = "reportante_id")
        })
@Getter
@Setter
@NoArgsConstructor
public class ReporteOrganizacion {

    public static final int MAX_DETALLE = 1000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organizacion_id", nullable = false)
    private Organizacion organizacion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reportante_id", nullable = false)
    private Usuario reportante;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MotivoReporte motivo;

    /** Set iff {@link #motivo} is DUPLICADO: a PLATAFORMA organizacion other than the reported one. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organizacion_duplicada_id")
    private Organizacion organizacionDuplicada;

    @Column(length = MAX_DETALLE)
    private String detalle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoReporte estado = EstadoReporte.PENDIENTE;

    @Column(name = "nota_resolucion", length = MAX_DETALLE)
    private String notaResolucion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resuelto_por_id")
    private Administrador resueltoPor;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn = Instant.now();

    @Column(name = "resuelto_en")
    private Instant resueltoEn;

    /** N15/D12: erasure of the reporter's free text; the row, its FKs and state stay (audit trail). */
    public void anonimizar() {
        this.detalle = null;
    }
}
