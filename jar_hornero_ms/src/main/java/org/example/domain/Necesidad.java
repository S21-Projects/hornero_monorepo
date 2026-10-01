package org.example.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "necesidades")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Necesidad {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 1000)
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrioridadNecesidad prioridad;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoNecesidad estado;

    private LocalDate fechaPublicacion;

    private LocalDate fechaVencimiento;

    // Additive/nullable per the D4 convention: null == unclassified == today's behaviour
    // (`specs/organizacion-acreditacion/spec.md` "Level-Driven Food Category Caps").
    @Enumerated(EnumType.STRING)
    @Column(name = "categoria", nullable = true)
    private CategoriaAlimento categoria;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organizacion_id", nullable = false)
    private Organizacion organizacion;

    @OneToMany(mappedBy = "necesidad", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Donacion> donaciones = new ArrayList<>();

    // Feature catalogo-articulos, decision 6: the org selects requested articulos (no quantities,
    // unlike Donacion.lineas); categoria is derived from them. Additive table
    // (`necesidad_articulos`), nothing existing is dropped or renamed.
    @OneToMany(mappedBy = "necesidad", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<NecesidadArticulo> articulos = new ArrayList<>();
}
