# Auditoria Cola Global Specification

## Purpose

Define a cross-organizacion audit queue: a single read endpoint and admin screen listing evidence
awaiting review across ALL organizaciones, replacing the today per-org-only `AuditQueue.tsx`. It
follows the existing offset-pagination + response-envelope convention
(`docs/pagination-rest-endpoints.md`) and reuses the existing evidence detail actions
(Aprobar/Observar).

## Requirements

### Requirement: Cross-Org Query Scope

The system MUST expose a read endpoint that returns `OrganizacionEvidencia` rows across every
organizacion — not scoped to one organizacion — restricted to rows in `PENDIENTE` state or whose
derived `expirada` flag is true (record-and-warn expiry per `organizacion-evidencia`), and MUST
NOT include `APROBADA`, `OBSERVADA`, or `REEMPLAZADA` rows that are neither pending nor expired.

#### Scenario: Queue spans multiple organizaciones

- GIVEN organizacion A has a `PENDIENTE` evidence row and organizacion B has a separate `PENDIENTE`
  evidence row
- WHEN an ADMINISTRADOR requests the cross-org queue with no filters
- THEN both rows appear in the same result set

#### Scenario: Approved evidence is excluded

- GIVEN an `APROBADA` evidence row that is not expired
- WHEN the queue is queried
- THEN that row does not appear

### Requirement: ADMINISTRADOR-Only Access

The system MUST restrict the cross-org audit queue endpoint and screen to the `ADMINISTRADOR`
role, enforced consistently at MS `SecurityConfig`, BFF `@Roles`, and SPA `ProtectedRoute`.

#### Scenario: Referente is denied

- GIVEN an authenticated REFERENTE
- WHEN they request the cross-org audit queue endpoint
- THEN the request is rejected (403 or equivalent)

#### Scenario: Donante is denied

- GIVEN an authenticated DONANTE
- WHEN they request the cross-org audit queue endpoint
- THEN the request is rejected (403 or equivalent)

#### Scenario: Admin succeeds

- GIVEN an authenticated ADMINISTRADOR
- WHEN they request the cross-org audit queue endpoint
- THEN the request succeeds and returns the queue

### Requirement: Pendientes vs Vencidas Tabs

The system MUST partition the queue into two views selectable by the caller: "Pendientes" (rows in
`PENDIENTE` state, not expired) and "Vencidas" (rows whose derived `expirada` flag is true,
regardless of `estado`, per the existing record-and-warn rule that expiry never changes `estado`).
A row MUST NOT be double-counted as both if it is simultaneously `PENDIENTE` and expired — it MUST
appear in "Vencidas" in that case, since "Vencidas" takes precedence for display purposes.

#### Scenario: Pendientes tab excludes expired rows

- GIVEN a `PENDIENTE` row whose `validoHasta` has passed
- WHEN the "Pendientes" tab is requested
- THEN that row does not appear there
- AND it appears in "Vencidas" instead

#### Scenario: Vencidas tab includes any expired row regardless of estado

- GIVEN an `APROBADA` row whose `validoHasta` has passed
- WHEN the "Vencidas" tab is requested
- THEN that row appears there

### Requirement: Filters by Nivel, Requisito, and Tipo de Evidencia

The system MUST support filtering the queue by `nivel` (the level the requisito is first demanded
at, per `organizacion-acreditacion`'s cumulative mapping), `requisito` (`RequisitoAcreditacion`),
and `tipoEvidencia` (`DECLARACION`|`FOTO`|`DOCUMENTO`), independently and in combination.

#### Scenario: Filter by requisito narrows results

- GIVEN pending rows across several requisitos
- WHEN the queue is filtered to `requisito = RADIO_50KM_BANCO_ALIMENTOS`
- THEN only rows for that requisito are returned

#### Scenario: Combined filters narrow further

- GIVEN pending rows across multiple niveles and tipos
- WHEN the queue is filtered to `nivel = N2` AND `tipoEvidencia = FOTO`
- THEN only rows matching both conditions are returned

#### Scenario: No matching rows returns an empty page, not an error

- GIVEN a filter combination with no matching rows
- WHEN the queue is queried
- THEN the response is a valid empty page (`content: []`, `totalElements: 0`), not an error

### Requirement: Offset Pagination and Response Envelope

The system MUST paginate the queue using the existing offset convention (`page`, `size` default 20
capped at 100, optional `sort`) and MUST wrap the response in the existing global envelope
(`ApiResponse` / `PageData`), consistent with every other list endpoint.

#### Scenario: Default paging applies

- GIVEN 45 pending rows across all organizaciones
- WHEN the queue is requested with no `page`/`size`
- THEN the response returns 20 items with `totalElements = 45`, `totalPages = 3`, `number = 0`

#### Scenario: Page size is capped

- GIVEN a request with `size=500`
- WHEN the queue is queried
- THEN the effective page size is capped at 100

### Requirement: Cross-Org Audit Queue Screen

The system MUST provide an admin screen listing the cross-org queue with the Pendientes/Vencidas
tabs and the nivel/requisito/tipoEvidencia filters, a paged list control, and MUST open the
existing evidence detail view (with its Aprobar/Observar actions) when a row is selected, without
duplicating that detail's implementation.

#### Scenario: Selecting a row opens the existing detail actions

- GIVEN the cross-org queue screen listing a pending row for organizacion Z
- WHEN an admin selects that row
- THEN the existing evidence detail view opens, showing Aprobar/Observar exactly as the per-org
  `AuditQueue.tsx` detail already does

#### Scenario: Approving from the cross-org screen removes the row from Pendientes

- GIVEN a pending row shown in the cross-org queue
- WHEN the admin approves it from the opened detail
- THEN the row no longer appears under "Pendientes" on next queue refresh
- AND the organizacion's own per-org audit queue reflects the same approval
