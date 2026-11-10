# Cierre de sesión 2026-11-03 — checklist

Review and close-out list for the work integrated into `develop` on 2026-11-02/03:
pending-validation in-shell, standard PageHeader, accreditation redesign (+ PDF evidence and
admin observación on the legajo), manual-testing scenarios, admin table/drawer branch and
Referentes v2.

## Probar en el navegador (nadie lo vio todavía)
- [ ] Referente con org sin validar: Dashboard y Necesidades muestran header + tarjeta de validación pendiente, sin perder el menú.
- [ ] Header estándar (`PageHeader`) en las 18 pestañas; revisar alineación en Necesidades, Mis organizaciones y Acreditación (antes centradas).
- [ ] Acreditación (referente): escalera N0–N3, próximo nivel con progreso, niveles bloqueados, envío de foto y de PDF, formulario se cierra con confirmación, observada muestra el motivo del admin.
- [ ] Login: logo dentro de la card.
- [ ] Drawers y tablas (rama admin-tabla-drawer): Reclamos, Donaciones, Usuarios con Drawer; estados de carga; Catálogo paginado en el servidor.
- [ ] Referentes v2: bandejas, tabla, asignación en bloque, Drawer con pestañas Asignación / Info pública / Legajo.

## Decisiones pendientes
- [ ] Cola de auditoría: implementar la propuesta con Drawer (tablero 3 del canvas "Rediseño Acreditación"). Hoy muestra el enum crudo del requisito, "DOCUMENTO" para una foto y no muestra la observación.
- [ ] Subida de nivel: automática al completar requisitos o manual por el admin (hoy manual).
- [ ] `/pending-validation`: ya no se llega desde ninguna ruta; ¿borrarla?
- [ ] Preferencias: texto "Próximamente" del panel.
- [ ] Revisar las descripciones de los headers escritas por el agente.
- [ ] Referentes v2 — motivo de rechazo de info pública: `PATCH info-publica/rechazar` no acepta body, la leyenda "se le envía al referente" es falsa hoy. Agregar el motivo en BFF + MS, o quitar la leyenda.
- [ ] Referentes v2 — diferencias con el diseño por falta de API (ver `odd/tasks/admin-referentes-v2.md`): bandeja "Por revisar" solo altas pendientes, sin búsqueda ahí, sin filtro por tipo, búsqueda solo por nombre, sin contador por referente, lista de referentes máx. 100, Legajo sin nivel, confirmación inline en vez de toast, asignación en bloque de a una.

## Pendiente técnico
- [ ] Scripts de escenarios (`make escenario`): crear las necesidades que falten y probar de punta a punta con `make up-local`.
- [ ] Lint del BFF: 16 errores previos en `src/upload` (tests), no introducidos en esta sesión.
- [ ] Verificar en el stack local que el legajo devuelve `cargadoEn` y `observacion` (no requiere `make migrate`).
- [ ] Copia en Engram de `odd/tasks/admin-referentes-v2.md` pendiente (conflicto de sesiones del otro agente).

## Git
- [ ] Commitear Referentes v2 (hoy sin commitear en `develop`).
- [ ] Push de `develop` (9 commits locales + Referentes v2).
- [ ] Borrar worktrees `../hornero_app-mapa` y `../hornero_app-tablas` (limpios y ya integrados) y sus ramas.
- [x] Borradas ramas locales `feat/mapa-nits` (c647418), `backup/mapa-vulnerabilidad-pre-final` (014ff17), `-pre-n19` (2676b29), `-pre-rebase` (9f2884d). `feat/mapa-nits` sigue existiendo en `origin`.
- [ ] `feat/images`: NO es obsoleta del todo. Su commit a34ab3d trae foto de perfil de usuario en el MS (`UpdatePhotoRequest`, endpoint en `UsuarioController`) y `docs/images-upload.md`, que no están en `develop`; el resto toca el front deprecado `ts_hornero_app`. Decidir si se rescata algo antes de borrarla (también existe en `origin`).
