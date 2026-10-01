# Exploration: tesis-core-features

Gap between what the thesis promises and what the code implements, plus the new UI mockups
(designed in Claude Design, canvas "Hornero — Nuevas features").

Engram mirror: `sdd/tesis-core-features/explore`.

## Current State

Thesis: "Sistema de acreditación, asignación priorizada y trazabilidad de donaciones de alimentos" — three pillars.

**Pillar 1 — Acreditación: DONE.** `acreditacion-progresiva` shipped and archived
(`openspec/changes/archive/2026-09-21-acreditacion-progresiva/`, 87/87 tasks, MS 249/249, BFF 100/100,
admin 194/194 + build). N0-N3 ladder, append-only `organizacion_evento` log, `organizacion_evidencia`,
legajo export, admin audit workflow, `Necesidad.categoria`. Deliberate deferrals: hash chain over the
event log, cross-org audit queue, server PDF, quantity/volume model, automatic level decay.

**Pillar 2 — Asignación priorizada (fondo común): ALGORITHM ONLY, NOT WIRED.** `go_algorithms_worker`
has a complete, tested Hungarian/Jonker-Volgenant solver (`internal/assign/{hungarian,scoring,ronda}.go`),
score `0.35*deficit + 0.30*urgencia + 0.20*proximidad + 0.15*espera`, hard filters, `costoOportunidad`.
It is CLI-only (`main.go`, JSON via stdin/file, no HTTP server). No `Asignacion`/`Ronda` in
`jar_hornero_ms`, no BFF caller, no MS↔worker transport. `Donacion.necesidad_id` is
`@JoinColumn(nullable = false)` (`Donacion.java:38-39`), so a pool donation cannot be persisted. No
`modalidad` field anywhere (`CrearDonacionDto` has only `necesidadId` + `observaciones`).

**Pillar 3 — Trazabilidad: DUAL CONFIRMATION DONE, QR/OTP MISSING.** All 7 `EstadoDonacion` states exist.
`POST /donaciones/{id}/confirmar-entrega` works end to end (MS → BFF → `useConfirmarEntrega`),
DONANTE/REFERENTE only, idempotent, tracked by `confirmada_donante_en` / `confirmada_referente_en`.
It is a plain authenticated button: no code table, no hash, no TTL, no QR. `TRANSICIONES_PERMITIDAS`
has no entries for PENDIENTE_CONFIRMACION/ENTREGADA (`confirmarEntrega` bypasses it). The reusable
precedent is `OtpService` (BCrypt hash, 15 min TTL, throttling, `429 ESPERA_ANTES_DE_REENVIAR`).

Follow-on changes already named in `odd/tasks/tesis-documento-der.md`, not started:
`entrega-qr-ttl` and `scoring-historial-cumplimiento`.

Also outstanding: BFF public `GET /images?key=` has a deny-list mitigation (`isEvidenciaKey`) that
documents itself as a stopgap until an authenticated, ownership-checked evidence route exists.

## Capability Matrix

| # | Feature / CU | Status | Evidence |
|---|---|---|---|
| CU-01 | Registrar organización | Done | `ts_hornero_admin/src/routes/register.tsx`, MS `OrganizacionService` |
| CU-02 | Validar organización | Done (superseded by ladder) | `AcreditacionService`, `admin.tsx` |
| CU-03 | Publicar necesidad | Done, + categoria gate | `Necesidad.java` `categoria` |
| CU-04 | Consultar necesidades en el mapa | Done | `ts_hornero_astro` `HomeMapExplorer.tsx` |
| CU-05 | Ofrecer donación directa | Done | `CrearDonacionDto`, `useCrearDonacion`, `DonacionController` |
| CU-05 | Ofrecer donación al fondo común | **Missing** | no `modalidad`; `necesidad_id` NOT NULL; no transport |
| CU-06 | Seguimiento de organización | Done | `mis-organizaciones.tsx` |
| CU-07/08/09 | Evidencia / auditoría / elevación | Done | `AcreditacionService`, `EvidenciaForm`, `AuditQueue.tsx` (per-org) |
| CU-10 | Exportar legajo | Done | `legajo.tsx`, `GET /{id}/legajo` |
| CU-11 | Ronda de asignación | **Partial — algorithm only** | `go_algorithms_worker/internal/assign/*` |
| CU-12 | Verificación de email (OTP) | Done | `OtpService`, `verify-email.tsx` |
| CU-13 | Confirmación de entrega QR/OTP | **Partial** | `confirmarEntrega` done; no code, QR or TTL |
| — | Historial de cumplimiento en el score | **Missing** | `scoring-historial-cumplimiento` not started |
| — | Evidence files behind auth | **Missing (mitigated)** | `images.controller.ts` deny-list |

## UI Screen Matrix

| Screen | Status | Backend needed vs. exists |
|---|---|---|
| (a) Nueva donación — modalidad | **Missing** | needs `modalidad` end to end, pool create tolerant of null `necesidad_id`; direct POST + email-verified gate exist |
| (b) Donación ofrecida + progress | **Partial** | state badges exist; no "Asignación" step, no success screen |
| (c) Mis donaciones — assignment detail | **Partial** | `mis-donaciones.tsx` list exists; no modalidad badge, score breakdown, ronda date (no `Asignacion` source) |
| (d) Mobile QR/OTP confirmation | **Missing** | needs code table + endpoints + mobile component |
| (e) Register step 2 Organización | **Done** | `register.tsx` (chips, draggable pin); mockup adds a 3rd "Acreditación" step |
| (f) Bienvenida — N0..N3 ladder | **Missing** | UI only; data via `useAcreditacion` |
| (g) Acreditación — evidence | **Done** | `acreditacion.tsx`, `EvidenciaForm.tsx` |
| (h) Cross-org Cola de auditoría | **Partial** | `AuditQueue.tsx` is per-org; needs cross-org read endpoint + list screen; detail pieces reusable |

## Gap List

**go_algorithms_worker**
- G1: callable interface for `assign`/`Ronda` (HTTP or subprocess contract). Blocks G3, G5.
- G2: compliance-history scoring term, renormalizing weights, neutral prior. Needs an MS compliance signal.

**jar_hornero_ms**
- G3: `Donacion.modalidad` (DIRECTA|POOL), immutable; relax `necesidad_id` NOT NULL via hand-written SQL. Depends on G1 contract.
- G4: `Asignacion` entity (org, ronda date, per-criterion scores, `costoOportunidad`). Depends on G3.
- G5: ronda trigger calling G1 and persisting G4. Depends on G1, G3, G4.
- G6: delivery code table + service (reuse `OtpService` pattern) + transition entries. Independent.
- G7: authenticated, ownership-checked evidence-file route. Independent.

**ts_hornero_bff**
- G8: `modalidad` in `CrearDonacionDto`, pool create without `necesidadId`. Depends on G3.
- G9: assignment read endpoints. Depends on G4.
- G10: QR/OTP delivery endpoints. Depends on G6.
- G11: authenticated evidence route (ADMINISTRADOR + owning REFERENTE). Depends on G7.
- G12: cross-org audit-queue read endpoint with pagination. Independent.

**ts_hornero_admin**
- G13: screen (a). Depends on G8.
- G14: screen (b). Depends on G8, G9.
- G15: screen (c). Depends on G9.
- G16: screen (d). Depends on G10.
- G17: screen (f) Bienvenida. No backend dependency.
- G18: screen (h). Depends on G12.

## Recommended Slicing

1. Bienvenida screen (G17) — pure UI, ship first.
2. Evidence file security (G7 + G11) — independent, closes a flagged gap.
3. `entrega-qr-ttl` (G6 + G10 + G16) — independent, closes CU-13.
4. Cross-org audit queue (G12 + G18) — pagination is the only real decision.
5. Pool assignment (G1, G3, G4, G5, G8, G9, G13, G14, G15), sliced: (a) worker contract,
   (b) MS schema/domain + SQL migration, (c) ronda trigger + persistence, (d) BFF + screens (a)/(b)/(c).
6. `scoring-historial-cumplimiento` (G2) — after 5, or its Go-only formula in parallel.

## Open Product Questions

1. How does a ronda trigger — on demand, scheduled, or manually by an admin?
2. Where does compliance-history data come from for the scoring term?
3. Does the cross-org audit queue need server pagination/filtering now?
4. Is the QR a rendering of the 6-digit OTP or an independent token; does regenerate invalidate the previous code immediately?
5. Manual SQL migration script for `necesidad_id`, or adopt a migration tool now?
6. Does `entrega-qr-ttl` replace the current confirm button, or add a code step before it?

## Risks

- `ddl-auto=update` cannot relax `necesidad_id` NOT NULL: first hand-written migration in the project.
- Evidence-file deny-list is a mitigation, not a fix.
- Pool-assignment scope creep if not sliced.
- `entrega-qr-ttl` and pool assignment both touch `EstadoDonacion` / `TRANSICIONES_PERMITIDAS`: sequence them.
