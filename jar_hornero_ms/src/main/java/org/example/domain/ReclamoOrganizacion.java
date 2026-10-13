package org.example.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
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
import org.example.user.Referente;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A referente's request to take over an unclaimed (ReNaCoM-imported) organizacion. Only an
 * administrador resolves it. The table is created by {@code ddl-auto=update} (new table, no
 * script needed); {@code @Version} makes two concurrent resolutions of the same claim safe.
 */
@Entity
@Table(
        name = "reclamos_organizacion",
        indexes = {
                @Index(name = "idx_reclamo_org_estado", columnList = "organizacion_id, estado"),
                @Index(name = "idx_reclamo_referente", columnList = "referente_id")
        })
@Getter
@Setter
@NoArgsConstructor
public class ReclamoOrganizacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organizacion_id", nullable = false)
    private Organizacion organizacion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "referente_id", nullable = false)
    private Referente referente;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RolReclamo rol;

    @Column(nullable = false, length = 40)
    private String telefono;

    @Column(length = 1000)
    private String mensaje;

    /** R2 keys under {@code reclamo-evidencia/{orgId}/{referenteId}/}; read only through the authorized route. */
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "reclamo_organizacion_evidencias", joinColumns = @JoinColumn(name = "reclamo_id"))
    @Column(name = "object_key", nullable = false)
    private List<String> evidenciaKeys = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoReclamo estado = EstadoReclamo.PENDIENTE;

    @Column(name = "motivo_rechazo", length = 1000)
    private String motivoRechazo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resuelto_por_id")
    private Administrador resueltoPor;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn = Instant.now();

    @Column(name = "resuelto_en")
    private Instant resueltoEn;
}
