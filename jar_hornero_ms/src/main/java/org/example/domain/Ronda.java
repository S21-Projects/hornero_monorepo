package org.example.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One triggered assignment round (AD-9). Persisted whether it succeeds, fails, or matches nothing,
 * so the thesis can show a complete audit trail — see {@code RondaService.ejecutar}.
 */
@Entity
@Table(name = "rondas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Ronda {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ejecutada_en", nullable = false)
    private Instant ejecutadaEn;

    @Column(name = "finalizada_en")
    private Instant finalizadaEn;

    @Column(name = "ejecutada_por", nullable = false)
    private Long ejecutadaPor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoRonda estado;

    // Populated only when estado == FALLIDA (worker timeout/error/invalid response, AD-9 step 5).
    @Column(length = 1000)
    private String error;

    @Column(name = "version_contrato", nullable = false)
    private int versionContrato;

    @Column(name = "donaciones_consideradas", nullable = false)
    private int donacionesConsideradas;

    @Column(name = "candidatos_considerados", nullable = false)
    private int candidatosConsiderados;

    @Column(nullable = false)
    private int asignadas;

    @Column(name = "sin_asignar", nullable = false)
    private int sinAsignar;

    // Stale-at-write-time donations (donante cancelled mid-call, AD-9 step 4).
    @Column(nullable = false)
    private int descartadas;

    @Column(name = "score_total")
    private Double scoreTotal;

    // Weights actually applied (normalized), snapshotted for explainability (AD-9, worker response).
    @Column(name = "peso_deficit")
    private Double pesoDeficit;

    @Column(name = "peso_urgencia")
    private Double pesoUrgencia;

    @Column(name = "peso_proximidad")
    private Double pesoProximidad;

    @Column(name = "peso_espera")
    private Double pesoEspera;

    // Null until slice 6b wires the compliance term into the worker request/response.
    @Column(name = "peso_cumplimiento")
    private Double pesoCumplimiento;
}
