package org.example.domain;

/**
 * The taxonomy of immutable facts an {@link OrganizacionEvento} row may record. Names are owned by
 * {@code sdd-spec} (organizacion-evento-log spec, "Event Taxonomy" requirement); it supersedes any
 * conflicting wording in design.md, per the naming-conflict note in tasks.md.
 */
public enum TipoEventoOrganizacion {

    /** Genesis event written once by {@code AcreditacionBackfill} for every pre-existing row. */
    MIGRACION_INICIAL,

    /** Emitted when a new organizacion is self-registered ({@code nivelDespues = N0}). */
    ORGANIZACION_REGISTRADA,

    /** Emitted when a registration is rejected (in addition to the genesis event on backfill). */
    REGISTRO_RECHAZADO,

    /** A referente submitted new evidence for a requisito. */
    EVIDENCIA_ADJUNTADA,

    /** A prior evidencia row was superseded by a newer submission for the same requisito. */
    EVIDENCIA_REEMPLAZADA,

    /** An admin approved a pending evidencia row. */
    REQUISITO_APROBADO,

    /** An admin observed (flagged) a pending evidencia row with a reason. */
    REQUISITO_OBSERVADO,

    /** A level was raised by an admin after requisito coverage was verified. */
    NIVEL_ELEVADO,

    /** A level was lowered by an admin with a mandatory reason. */
    NIVEL_REDUCIDO,

    /** An organizacion's referente was reassigned. Never alters nivel/estado/validada. */
    REFERENTE_REASIGNADO
}
