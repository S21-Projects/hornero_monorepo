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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organizacion_id", nullable = false)
    private Organizacion organizacion;

    @OneToMany(mappedBy = "necesidad", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Donacion> donaciones = new ArrayList<>();
}
