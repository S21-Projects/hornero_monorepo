package org.example.domain;

import jakarta.persistence.*;
import lombok.*;
import org.example.user.Donante;

import java.time.Instant;
import java.time.LocalDate;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "necesidad_id", nullable = false)
    private Necesidad necesidad;

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
}
