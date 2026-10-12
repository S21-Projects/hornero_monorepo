# Notificaciones por email (N13 / D6)

Los servicios de dominio publican un evento (`NotificacionEvento`) **dentro** de su transacción.
`NotificacionListener` lo recibe con `@TransactionalEventListener(AFTER_COMMIT)` y lo entrega al
ejecutor asíncrono `mailExecutor`: un rollback nunca envía correo, y la latencia o caída de Resend
no afecta a la request. Sin reintentos.

| Evento | Quién lo publica | Destinatario | Plantilla |
|--------|------------------|--------------|-----------|
| Oferta DIRECTA nueva | `DonacionService.crear` | referente de la organización | `oferta-recibida` |
| Donación aceptada / rechazada | `DonacionService.decidir` | donante | `donacion-aceptada` / `donacion-rechazada` |
| Oferta sin respuesta cancelada (N12) | `DonacionService.cancelarOfertaSinRespuesta` | donante | `donacion-vencida` |
| Entrega confirmada por ambas partes | `EntregaService.verificar` | donante | `entrega-confirmada` |
| Propuestas de una ronda | `RondaService` | cada referente, **un** resumen por ronda | `propuestas-ronda` |
| Organización aprobada / rechazada | `OrganizacionService.validar/rechazar` | referente | `organizacion-aprobada` / `organizacion-rechazada` |
| Nivel de acreditación cambió (sube o baja) | `AcreditacionService.cambiarNivel` | referente | `nivel-cambiado` |
| Evidencia observada | `AcreditacionService.observarEvidencia` | referente | `evidencia-observada` |
| Resumen diario (08:00 Buenos Aires) | `NotificacionDigestJob` | todo administrador activo | `digest-admin` |

No se notifica: el rechazo de una donación del fondo común (vuelve al fondo; el donante no ve
cambios), la expiración de una propuesta, cancelaciones hechas por el propio donante, ni los
overrides de un administrador. El digest se omite si no hay organizaciones pendientes ni donaciones
estancadas; lista hasta 20 líneas por sección.

## Reglas

- Sólo usuarios **activos con email verificado**: una dirección sin verificar puede estar mal
  escrita o ser de otra persona, y los correos mencionan donaciones y organizaciones.
- Ningún correo lleva tokens ni códigos de entrega; sólo enlaces al panel (`APP_PANEL_URL`).
- Los textos de usuario se escapan en el HTML y se limpian de saltos de línea en el asunto.
- En modo `MAIL_LOG_ONLY=true` sólo se registra el asunto y el destinatario enmascarado.
- Fallos: `NOTIFICACION_FALLIDA` en la actividad (ver `registro-actividades.md`).

## Configuración

| Variable | Default | Efecto |
|----------|---------|--------|
| `NOTIFICACIONES_ENABLED` | `true` | `false` apaga todos los correos de evento y el digest |
| `NOTIFICACIONES_DIGEST_CRON` | `0 0 8 * * *` | cron del digest (zona Buenos Aires) |
