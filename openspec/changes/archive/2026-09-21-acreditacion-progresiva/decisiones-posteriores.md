# Post-spec decisions — acreditacion-progresiva

Decisions taken by the user after `sdd-spec` and `sdd-design` were written. They amend
those artifacts; `sdd-apply` MUST honour what is recorded here over the earlier wording.

## D-01 — The referente exports their own organizacion's information (2026-09-20)

`design.md` restricts `GET /{id}/legajo` to `ADMINISTRADOR`. That is amended: the legajo
endpoint MUST also be reachable by the **owning `REFERENTE`**, with the same
ownership check already used for evidence submission (`org.referente.id == principal`).

Rationale: the legajo exists so the organizacion can present its own evidence to a third
party such as Banco de Alimentos. Restricting it to administrators means the organizacion
depends on a Hornero administrator to obtain a record of what it itself submitted.

**What the referente's export contains**: its organizacion's identity, current level and
since-date, the state of each of the 8 requisitos, the evidence it submitted with each
item's validity window and `VIGENTE`/`VENCIDA` flag, the full chronological event log for
that organizacion, and the observations it received from auditors.

**Open sub-decision for implementation** — auditor identity. The event log stores
`actorUsuarioId` and `actorTipo`. Exposing the auditing administrator's *identity* to the
referente is a separate question from exposing the *action*. Default taken unless the user
says otherwise: show the action, its timestamp, the actor's **role**, and any observación
(which is feedback addressed to the organizacion anyway), but not the administrator's
personal identity. Record the choice in the spec when implementation resumes.

**What it never contains**: any data belonging to another organizacion.

## D-02 — The audit queue gets its own endpoint (2026-09-21)

Slice A shipped `PATCH /{id}/acreditacion/evidencias/{evId}/aprobar` and `.../observar`, but no read
path in the MS or the BFF ever returns an evidence identifier. `AcreditacionResponse` carries only
`organizacionId`, `nivel` and `nivelDesde`; `LegajoResponse.RequisitoEnLegajo` carries a requisito's
state but no `evidenciaId`. `EvidenciaResponse` does carry `id`, but it is only ever returned from the
submit and audit mutations, where the caller already knows the id.

The consequence, found by the Phase 4 contract validation: an administrator cannot approve or observe
evidence from the interface at all. A referente submits, and nobody can act on it except through a
direct API call with an id read out of the database. The submit half of the change's central use case
works; the validate half is unreachable.

**Decision (user, 2026-09-21)**: add a dedicated audit endpoint rather than widening the legajo.

`GET /api/organizaciones/{id}/acreditacion/evidencias` — `ADMINISTRADOR` only — returns that
organizacion's evidence as `EvidenciaResponse` records, each with its `id` and `estado`. It accepts an
optional `estado` filter so the queue can show only `PENDIENTE` rows.

Rationale: the legajo is a document. It is assembled server-side, proxied unmodified, printed, and
handed to a third party such as Banco de Alimentos — and under D-01 the owning referente reads it too.
Threading internal row identifiers through it to power an admin control surface conflates a record with
a work queue, and ties the queue to one organizacion's page forever. The design's own wireframe
(`docs/tesis/diagramas/ui-cola-auditoria.puml`) shows the audit queue as its own surface. A separate
feed keeps the document clean and leaves room for that surface to become cross-organizacion later.

**Deliberately left open**: this endpoint is per-organizacion. A cross-organizacion queue — "every
`PENDIENTE` evidence across every organizacion, oldest first" — is the natural next step and matches the
wireframe, but it needs its own pagination and ordering decisions. Not in this change.

**Authorization**: `ADMINISTRADOR` only, deliberately narrower than D-01's legajo rule. The owning
referente already sees the state of its own evidence through the legajo; it has no approve or observe
action, so it needs no row identifiers.
