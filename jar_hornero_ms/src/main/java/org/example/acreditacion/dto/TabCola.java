package org.example.acreditacion.dto;

/**
 * Which partition of the cross-org audit queue is requested (AD-8,
 * `specs/auditoria-cola-global/spec.md` "Pendientes vs Vencidas Tabs"). {@code VENCIDAS} takes
 * precedence for display — a row that is simultaneously {@code PENDIENTE} and expired appears
 * there, never in {@code PENDIENTES}.
 */
public enum TabCola {
    PENDIENTES,
    VENCIDAS
}
