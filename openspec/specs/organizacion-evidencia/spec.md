# Organizacion Evidencia Specification

## Purpose

Define `organizacion_evidencia`: one row per requisito submission, its own validity window, admin
audit lifecycle, replacement semantics that never overwrite history, record-and-warn expiry that
never auto-demotes a level, and the access control that keeps evidence files out of the existing
public image route.

## Requirements

### Requirement: One Evidence Row Per Requisito Submission

The system MUST persist each requisito submission as a distinct `OrganizacionEvidencia` row
carrying `organizacion_id`, `requisito` (`RequisitoAcreditacion`), `tipoEvidencia`
(`DECLARACION` | `FOTO` | `DOCUMENTO`), an optional `objectKey` (R2 key), an optional
`declaracion` text, `validoDesde`, a nullable `validoHasta` (null = never expires), `estado`
(`PENDIENTE` | `APROBADA` | `OBSERVADA` | `REEMPLAZADA`), and `cargadoPor`/`cargadoEn`.

#### Scenario: Referente submits a declaration-only requisito

- GIVEN a referente owning an organizacion at N0
- WHEN they submit `NO_DISCRIMINACION` as `DECLARACION` with no photo
- THEN an `OrganizacionEvidencia` row is created with `estado = PENDIENTE`, `tipoEvidencia = DECLARACION`, `objectKey = null`

#### Scenario: Referente submits a photo-backed requisito

- GIVEN a referente owning an organizacion at N1
- WHEN they submit `CONDICIONES_SANITARIAS_ADECUADAS` as `FOTO` with an uploaded object key
- THEN an `OrganizacionEvidencia` row is created with `tipoEvidencia = FOTO` and the stored `objectKey`

### Requirement: Admin Audit States

The system MUST allow an admin, and only an admin, to move a `PENDIENTE` evidence row to
`APROBADA` or `OBSERVADA`, and MUST record the admin actor and timestamp (`revisadoPor`,
`revisadoEn`) on that transition. Neither the referente who submitted it nor the BFF/SPA may set
these audit states directly.

#### Scenario: Admin approves pending evidence

- GIVEN a `PENDIENTE` evidence row for `SIN_KIOSCO_MISMO_DOMICILIO`
- WHEN an admin approves it
- THEN its `estado` becomes `APROBADA`
- AND `revisadoPor`/`revisadoEn` are set to that admin and the current time

#### Scenario: Admin observes (rejects) pending evidence with a reason

- GIVEN a `PENDIENTE` evidence row for `RADIO_50KM_BANCO_ALIMENTOS`
- WHEN an admin marks it `OBSERVADA` with a reason
- THEN its `estado` becomes `OBSERVADA`
- AND the reason is recorded on the accompanying event (see `organizacion-evento-log`)

#### Scenario: Referente cannot self-approve

- GIVEN a `PENDIENTE` evidence row submitted by a referente
- WHEN that referente attempts to set its `estado` to `APROBADA` directly
- THEN the request is rejected

### Requirement: Replacement Never Overwrites History

The system MUST implement evidence replacement as an insert of a new row plus a mark of the
previous row as `REEMPLAZADA`, and MUST NEVER update or delete an existing `OrganizacionEvidencia`
row's `objectKey`, `declaracion`, or prior `estado` value in place.

#### Scenario: Referente replaces expired documentation evidence

- GIVEN an `APROBADA` evidence row for `PERSONERIA_JURIDICA_O_AVAL` whose `validoHasta` has passed
- WHEN the referente submits a renewed document for the same requisito
- THEN a new `PENDIENTE` row is inserted
- AND the previous row's `estado` becomes `REEMPLAZADA`, its original data unchanged

#### Scenario: Replaced evidence remains queryable

- GIVEN an evidence row marked `REEMPLAZADA`
- WHEN the legajo or event log is assembled
- THEN that row's history (who submitted it, when, its prior audit outcome) is still readable

### Requirement: Record-and-Warn Expiry

The system MUST derive an `expirada` flag on read as `validoHasta IS NOT NULL AND validoHasta < today`,
MUST NOT persist this flag anywhere, and MUST NEVER trigger a level change as a side effect of an
evidence row becoming expired.

#### Scenario: Evidence expires without demoting the level

- GIVEN an organizacion at `N3` whose `ACEPTA_AUDITORIAS_SIN_AVISO` evidence has a `validoHasta` that has now passed
- WHEN the organizacion's level is read the day after expiry
- THEN `nivel` is still `N3`
- AND the evidence is flagged `expirada = true` wherever it is displayed (audit queue, legajo)

#### Scenario: No scheduled job recomputes expiry

- GIVEN the system has no cron/scheduled task for accreditation
- WHEN evidence crosses its `validoHasta`
- THEN nothing runs automatically; the flag is computed only when a read occurs

### Requirement: Authenticated Evidence-File Access

The system MUST serve evidence photos/documents through a dedicated, authenticated,
ownership-checked route, and MUST NOT make them reachable through the existing public
`GET /images?key=` route (`ts_hornero_bff/src/images/images.controller.ts:8-23`, currently
`@Public()`). The new route MUST be guarded so that only an `ADMINISTRADOR` or the owning
`REFERENTE` of the organizacion can retrieve a given evidence file, keeping the MS
`SecurityConfig`, BFF `RolesGuard`, and SPA `ProtectedRoute` enforcement layers in sync. The route
MUST additionally verify the requested key corresponds to an existing `OrganizacionEvidencia` row
for that organizacion (matching `objectKey`) before streaming the file — a syntactically valid key
under the org's prefix with no matching evidence row MUST be rejected, not merely ownership-checked
by prefix. The `ts_hornero_admin` SPA MUST render every evidence photo/document exclusively through
this route in every screen that displays one: the cross-org audit queue detail (see
`auditoria-cola-global`), the legajo export view, and the referente's own acreditación/evidence
view.

(Previously: the route existed and was ownership-checked by organization prefix only — any key
under `org-evidencia/{orgId}/` was served to that org's owner or an admin regardless of whether a
persisted `OrganizacionEvidencia` row referenced it, and no SPA code consumed the route; the only
image-serving code in the admin SPA was the unrelated `OrgImagesEditor.tsx` public-image flow, and
`images.controller.ts`/`domain.ts` carried stale "until Slice B ships" comments.)

#### Scenario: Owning referente can view their own evidence photo

- GIVEN a referente owning organizacion X with a `FOTO` evidence row
- WHEN they request that evidence file through the new authenticated route
- THEN the file is returned

#### Scenario: Admin can view any organizacion's evidence photo

- GIVEN an admin
- WHEN they request an evidence file belonging to any organizacion through the new route
- THEN the file is returned

#### Scenario: Non-owning referente is denied

- GIVEN a referente who does not own organizacion X
- WHEN they request an evidence file belonging to organizacion X
- THEN the request is rejected (403 or equivalent)

#### Scenario: Evidence keys are unreachable through the public image route

- GIVEN an evidence file stored under the `org-evidencia/{orgId}/` prefix
- WHEN an unauthenticated request is made to `GET /images?key=org-evidencia/{orgId}/{file}`
- THEN the request is rejected — this route MUST NOT stream evidence keys, whether by prefix
  exclusion or by removing `@Public()` from any path capable of serving them

#### Scenario: Key with no matching evidence row is rejected

- GIVEN a syntactically valid `org-evidencia/{orgId}/{file}` key that does not match any
  `OrganizacionEvidencia.objectKey` row for that organizacion
- WHEN the owning referente or an admin requests it through the authenticated route
- THEN the request is rejected (404 or equivalent) — ownership of the organizacion alone is not
  sufficient

#### Scenario: SPA renders evidence via the authenticated route in the cross-org audit detail

- GIVEN an admin viewing a pending evidence row in the cross-org audit queue detail
- WHEN the evidence is a `FOTO` or `DOCUMENTO`
- THEN the file is fetched and rendered through the authenticated evidence-file route, not the
  public image route

#### Scenario: SPA renders evidence via the authenticated route in the legajo view

- GIVEN an admin exporting/viewing an organizacion's legajo
- WHEN a legajo entry includes an evidence photo or document
- THEN it is rendered through the authenticated evidence-file route

#### Scenario: SPA renders evidence via the authenticated route in the referente's own view

- GIVEN a referente viewing their own organizacion's acreditación/evidence screen
- WHEN a submitted evidence item has an attached photo or document
- THEN it is rendered through the authenticated evidence-file route

#### Scenario: Stale rollout comments are removed

- GIVEN `images.controller.ts` and `ts_hornero_admin/src/types/domain.ts` as implemented after this
  change
- WHEN their evidence-related comments are inspected
- THEN no comment references waiting on "Slice B" or an unimplemented future route — the
  deny-list in `images.controller.ts` is documented instead as defense-in-depth alongside the now
  fully-consuming authenticated route
