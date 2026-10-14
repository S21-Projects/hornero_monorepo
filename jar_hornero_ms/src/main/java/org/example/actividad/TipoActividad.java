package org.example.actividad;

/**
 * Explicit, closed list of recorded activity kinds (N10/D10). Adding a value is a deliberate code
 * change; nothing outside this list can be written to the activity log. Persisted by name
 * ({@code EnumType.STRING}), so values must never be renamed once released.
 *
 * <p>Auth events carry their outcome in {@link ResultadoActividad} (e.g. {@code LOGIN} +
 * {@code FALLO}); the ones that only ever represent a refusal have no separate success twin.
 * Reads, 403 and 429 responses are intentionally NOT recorded (technical log only).
 */
public enum TipoActividad {
    // Authentication (ASVS 16.3.1) and control-bypass attempts (16.3.3)
    LOGIN,
    LOGOUT,
    REGISTRO,
    REFRESH_TOKEN,
    REFRESH_TOKEN_REUTILIZADO,
    OTP_VERIFICACION,
    OTP_BLOQUEO,
    // N14: password reset (OWASP Forgot Password Cheat Sheet)
    PASSWORD_RESET_SOLICITADO,
    PASSWORD_RESET_COMPLETADO,
    PASSWORD_RESET_FALLIDO,
    ENTREGA_CODIGO_GENERADO,
    ENTREGA_CODIGO_VERIFICACION,
    ENTREGA_CODIGO_BLOQUEO,

    // Users
    USUARIO_ACTIVADO,
    USUARIO_DESACTIVADO,
    // N15/D12: right to erasure (admin-run); the entry never holds the data subject's data
    USUARIO_ANONIMIZADO,

    // Organizaciones (accreditation level/evidence stay in OrganizacionEvento, not duplicated)
    ORGANIZACION_CREADA,
    ORGANIZACION_VALIDADA,
    ORGANIZACION_RECHAZADA,
    ORGANIZACION_ACTUALIZADA,
    ORGANIZACION_REFERENTE_REASIGNADO,
    ORGANIZACION_INFO_PUBLICA_EDITADA,
    ORGANIZACION_INFO_PUBLICA_APROBADA,
    ORGANIZACION_INFO_PUBLICA_RECHAZADA,

    // Reclamos de organizaciones importadas (the org-side facts also land in OrganizacionEvento)
    RECLAMO_CREADO,
    RECLAMO_APROBADO,
    RECLAMO_RECHAZADO,

    // Reportes sobre organizaciones importadas
    REPORTE_CREADO,
    REPORTE_CONFIRMADO,
    REPORTE_DESCARTADO,

    // Necesidades
    NECESIDAD_CREADA,
    NECESIDAD_ACTUALIZADA,
    NECESIDAD_ELIMINADA,
    NECESIDAD_RELANZADA,
    NECESIDADES_VENCIDAS,

    // Donaciones
    DONACION_CREADA,
    DONACION_DECISION,
    DONACION_ESTADO_ACTUALIZADO,
    DONACION_CANCELADA,
    DONACION_ELIMINADA,
    DONACION_OVERRIDE,
    // N12/D4: automatic, system-actor transitions of the stale-donations job
    DONACION_VENCIDA,
    DONACION_PROPUESTA_VENCIDA,
    DONACIONES_ESTANCADAS_PROCESADAS,

    // Rondas and catalog
    RONDA_EJECUTADA,
    ARTICULO_CREADO,
    ARTICULO_ACTUALIZADO,
    ARTICULO_DESACTIVADO,
    ARTICULO_REACTIVADO,

    // N13: a notification email that could not be sent (successful sends are not recorded)
    NOTIFICACION_FALLIDA,

    // System housekeeping that deletes or minimizes data (N15/D12)
    TOKENS_PURGADOS,
    ACTIVIDAD_PURGADA,
    EMAIL_INTENTO_PURGADO,
    COORDENADAS_MINIMIZADAS,
    // Claim evidence objects deleted from the bucket: counts only, never keys or paths
    EVIDENCIA_RECLAMO_BORRADA,
    EVIDENCIA_HUERFANA_BORRADA
}
