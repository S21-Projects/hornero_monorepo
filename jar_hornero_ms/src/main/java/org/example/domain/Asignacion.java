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
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * The append-only audit record of a ronda matching a donación to a necesidad (AD-3). A donación's
 * {@code necesidad} field is the single source of truth for "who currently receives it"; this row
 * never overwrites a prior assignment for the same donación in place — reassignment after a
 * devolución inserts a NEW row, the earlier one stays queryable as history.
 */
@Entity
@Table(name = "asignaciones", indexes = {
        @Index(name = "idx_asignaciones_donacion", columnList = "donacion_id"),
        @Index(name = "idx_asignaciones_ronda", columnList = "ronda_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Asignacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ronda_id", nullable = false)
    private Ronda ronda;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "donacion_id", nullable = false)
    private Donacion donacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "necesidad_id", nullable = false)
    private Necesidad necesidad;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organizacion_id", nullable = false)
    private Organizacion organizacion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoAsignacion estado;

    @Column(name = "creada_en", nullable = false)
    private Instant creadaEn;

    // Set when the vigente asignación resolves (accept/devolución/cancel/override, slice 5c-ii).
    @Column(name = "resuelta_en")
    private Instant resueltaEn;

    @Column(nullable = false)
    private double score;

    @Column(name = "costo_oportunidad", nullable = false)
    private double costoOportunidad;

    @Column(name = "distancia_km", nullable = false)
    private double distanciaKm;

    // Normalized [0,1] terms; contribution = term x ronda.peso* (AD-9, worker desglose).
    @Column(name = "termino_deficit", nullable = false)
    private double terminoDeficit;

    @Column(name = "termino_urgencia", nullable = false)
    private double terminoUrgencia;

    @Column(name = "termino_proximidad", nullable = false)
    private double terminoProximidad;

    @Column(name = "termino_espera", nullable = false)
    private double terminoEspera;

    // Null until slice 6b wires the compliance term.
    @Column(name = "termino_cumplimiento")
    private Double terminoCumplimiento;

    // AD-2: which rule resolved this candidate's coverage deficit (PROVISTO|RADIO|CERCANO|NEUTRAL).
    @Column(name = "deficit_fuente")
    private String deficitFuente;

    @Column(name = "codigo_radio")
    private String codigoRadio;
}
