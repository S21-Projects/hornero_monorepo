# Delta for Organizacion Evidencia

## MODIFIED Requirements

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
