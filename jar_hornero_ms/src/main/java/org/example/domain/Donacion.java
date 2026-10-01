package org.example.domain;

import jakarta.persistence.*;
import lombok.*;
import org.example.user.Donante;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "donaciones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Donacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate fechaOferta;

    private LocalDate fechaEntrega;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoDonacion estado;

    @Column(length = 1000)
    private String observaciones;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "donante_id", nullable = false)
    private Donante donante;

    // Nullable per AD-3/AD-13 (tesis-core-features slice 5b): a FONDO_COMUN donación waits in the
    // pool with no necesidad until a ronda assigns it. The underlying FK relaxation lives in the
    // hand-written `scripts/sql/V001__donaciones_necesidad_id_nullable.sql` — see EsquemaVerificador
    // for the runtime guard that keeps FONDO_COMUN creation safe until that script has run.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "necesidad_id", nullable = true)
    private Necesidad necesidad;

    // Additive/nullable per the D4 convention: null == DIRECTA (every donación created before this
    // change). Immutable after creation (`updatable = false`) — no code path, including the
    // ADMINISTRADOR override, may change a donación's channel post-creation
    // (`specs/donacion-fondo-comun/spec.md` "Modalidad Vocabulary and Immutability").
    @Enumerated(EnumType.STRING)
    @Column(name = "modalidad", nullable = true, updatable = false)
    private ModalidadDonacion modalidad;

    // The following three fields are populated only for FONDO_COMUN donations, at creation time.
    // `latitud`/`longitud` are the donante-marked pickup point fed to the ronda solver
    // (`scoring.go:10-17`) and are write-only: no `DonacionResponse`/`DonacionActivaResponse` ever
    // serializes them (`specs/donacion-fondo-comun/spec.md` "Location and Categoria Required for
    // Pool Donations").
    @Enumerated(EnumType.STRING)
    @Column(name = "categoria", nullable = true)
    private CategoriaAlimento categoria;

    @Column(name = "latitud")
    private Double latitud;

    @Column(name = "longitud")
    private Double longitud;

    @Column(name = "confirmada_donante_en")
    private Instant confirmadaDonanteEn;

    @Column(name = "confirmada_referente_en")
    private Instant confirmadaReferenteEn;

    @Column(name = "override_motivo", length = 500)
    private String overrideMotivo;

    @Column(name = "override_admin_id")
    private Long overrideAdminId;

    @Column(name = "override_en")
    private Instant overrideEn;

    // Feature catalogo-articulos, decision 4: N lines of articulo + cantidad, for both
    // modalidades. Additive table (`donacion_lineas`), nothing existing is dropped or renamed.
    @OneToMany(mappedBy = "donacion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DonacionLinea> lineas = new ArrayList<>();

    /**
     * Coalesced read per the D4 convention: a {@code null} {@link #modalidad} (every donación
     * created before this change) is {@code DIRECTA}. Callers should prefer this over the raw
     * {@link #getModalidad()} getter for any decision that depends on the donación's channel.
     */
    public ModalidadDonacion getModalidadEfectiva() {
        return modalidad != null ? modalidad : ModalidadDonacion.DIRECTA;
    }
}
