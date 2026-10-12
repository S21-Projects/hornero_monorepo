package org.example.domain;

import jakarta.persistence.*;
import lombok.*;
import org.example.user.Administrador;
import org.example.user.Referente;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "organizaciones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Organizacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Optimistic lock (N11). Two concurrent operations on the same row: the first commit wins, the
     * other fails with CONFLICTO_CONCURRENTE (409). Existing rows are initialised to 0 by
     * scripts/sql/V003__optimistic_version_columns.sql.
     */
    @Version
    private Long version;

    @Column(nullable = false)
    private String nombre;

    @Column(unique = true)
    private String slug;

    @Column(length = 1000)
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = true)
    private TipoOrganizacion tipo;

    private String direccion;

    private Double latitud;

    private Double longitud;

    @Column(nullable = false)
    private Boolean validada = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = true)
    private EstadoOrganizacion estado = EstadoOrganizacion.PENDIENTE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "administrador_id")
    private Administrador validadoPor;

    // D8: additive/nullable per D4. nivelActual() coalesces null -> N0; the
    // AcreditacionBackfill runner fills it once at boot (AD-7).
    @Enumerated(EnumType.STRING)
    @Column(name = "nivel", nullable = true)
    private NivelAcreditacion nivel = NivelAcreditacion.N0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "referente_id", nullable = true)
    private Referente referente;

    // --- External-registry provenance (V007). Nullable columns: ddl-auto=update cannot add NOT NULL
    // to a populated table; a null origen is read as PLATAFORMA (see origenEfectivo()). ---
    @Enumerated(EnumType.STRING)
    @Column(name = "origen", nullable = true)
    private OrigenOrganizacion origen = OrigenOrganizacion.PLATAFORMA;

    /** Identifier in the source registry (ReNaCoM "Identificador"); unique when present. */
    @Column(name = "origen_id", unique = true)
    private String origenId;

    @Column(name = "asistentes_declarados")
    private Integer asistentesDeclarados;

    /** Censo 2022 radio (9 chars) containing the point, derived by point-in-polygon. */
    @Column(name = "codigo_radio", length = 9)
    private String codigoRadio;

    public OrigenOrganizacion origenEfectivo() {
        return origen == null ? OrigenOrganizacion.PLATAFORMA : origen;
    }

    @Column(name = "profile_image_key")
    private String profileImageKey;

    @Column(name = "banner_key")
    private String bannerKey;

    @OneToMany(mappedBy = "organizacion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Necesidad> necesidades = new ArrayList<>();

    // --- Info pública (aceptaDonaciones, sitioWebUrl, donacionDirectaUrl) ---
    // Nullable at the DB level (D4): ddl-auto=update cannot add a NOT NULL
    // column with no DEFAULT to a non-empty table. Java-side default + the
    // toResponse() coalescing give the same effective semantics.
    @Column(name = "acepta_donaciones")
    private Boolean aceptaDonaciones = false;

    @Column(name = "sitio_web_url", length = 500)
    private String sitioWebUrl;

    @Column(name = "donacion_directa_url", length = 500)
    private String donacionDirectaUrl;

    // Pending snapshot (D1/D2): populated only while a referente-submitted
    // change awaits admin approval. infoPublicaPendienteEn non-null == pending.
    @Column(name = "acepta_donaciones_pendiente")
    private Boolean aceptaDonacionesPendiente;

    @Column(name = "sitio_web_url_pendiente", length = 500)
    private String sitioWebUrlPendiente;

    @Column(name = "donacion_directa_url_pendiente", length = 500)
    private String donacionDirectaUrlPendiente;

    @Column(name = "info_publica_pendiente_en")
    private LocalDateTime infoPublicaPendienteEn;
}
