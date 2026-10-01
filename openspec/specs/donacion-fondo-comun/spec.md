# Donacion Fondo Comun Specification

## Purpose

Define `modalidad` on `donacion` (`DIRECTA` | `FONDO_COMUN`) and the lifecycle of a pool
(`FONDO_COMUN`) donation: created without a target `necesidad`, carrying a donante-marked location
and a required `categoria`, waiting unassigned until a ronda (see `ronda-asignacion`) matches it to
a candidate necesidad, and the accept/reject/return-to-pool cycle that follows an offer.

## Requirements

### Requirement: Modalidad Vocabulary and Immutability

The system MUST represent a donación's channel as `modalidad` with exactly two values, `DIRECTA`
and `FONDO_COMUN`, set at creation time and MUST NOT allow it to change for the lifetime of the
donación, regardless of role (donante, referente, or ADMINISTRADOR override).

#### Scenario: Modalidad is set at creation

- GIVEN a donante creating a new donación
- WHEN they choose `FONDO_COMUN`
- THEN the persisted donación has `modalidad = FONDO_COMUN`

#### Scenario: Modalidad cannot be changed after creation

- GIVEN a donación already persisted with `modalidad = DIRECTA`
- WHEN any request (including an ADMINISTRADOR override) attempts to change its `modalidad`
- THEN the request is rejected — no code path MUST expose a way to mutate this field post-creation

### Requirement: DIRECTA Donations Behave Exactly as Before

The system MUST leave the existing `DIRECTA` creation, acceptance, delivery, and cancellation
behavior entirely unaffected by the introduction of `modalidad` and pool donations — a `DIRECTA`
donación always targets an existing `necesidad` chosen by the donante and is never routed through
the ronda solver.

#### Scenario: Existing direct-donation flow is unchanged

- GIVEN a donante creating a donación targeting a specific `necesidad`, as before this change
- WHEN the donación is created
- THEN it is persisted with `modalidad = DIRECTA`, `necesidad` set, and behaves identically to
  pre-change `DIRECTA` donations in every subsequent state transition

#### Scenario: DIRECTA donations are never candidates for the solver

- GIVEN a ronda is triggered
- WHEN the worker input is assembled
- THEN no `DIRECTA` donación, assigned or not, is included among the pool donations offered to the
  solver

### Requirement: Pool Donation Created Without a Necesidad

The system MUST allow creating a `FONDO_COMUN` donación with `necesidad = null`, and MUST persist
it successfully despite the existing `necesidad_id` foreign key having been relaxed to nullable by
the versioned SQL migration script. Every read path that assumes a non-null `necesidad`
(`toResponse`, `confirmarEntrega`'s referente resolution, repository joins) MUST be null-safe for a
`FONDO_COMUN` donación before assignment.

#### Scenario: Pool donation is created and persisted

- GIVEN a verified donante
- WHEN they submit a `FONDO_COMUN` donación with no `necesidadId`
- THEN the donación is persisted with `necesidad = null` and `modalidad = FONDO_COMUN`

#### Scenario: Reading an unassigned pool donation does not error

- GIVEN a persisted `FONDO_COMUN` donación with `necesidad = null` and no `Asignacion` yet
- WHEN it is read via `findMias`, `findById`, or any list endpoint
- THEN the response is returned successfully with organizacion/necesidad fields represented as
  absent (null or empty), not a server error

### Requirement: Location and Categoria Required for Pool Donations

The system MUST require a donante-marked geographic point (latitude/longitude, per-donation, not
read from the donante's profile) and a `categoria` (`CategoriaAlimento`) on every `FONDO_COMUN`
donación at creation time; both feed the solver's `Donacion.Latitud/Longitud/Categoria`
(`scoring.go:10-17`). A `DIRECTA` donación MUST NOT require either field.

#### Scenario: Pool donation without a location is rejected

- GIVEN a donante submitting a `FONDO_COMUN` donación with no map point marked
- WHEN the request is submitted
- THEN it is rejected with a validation error naming the missing location

#### Scenario: Pool donation without a categoria is rejected

- GIVEN a donante submitting a `FONDO_COMUN` donación with no `categoria` chosen
- WHEN the request is submitted
- THEN it is rejected with a validation error naming the missing categoria

#### Scenario: Direct donation needs neither field

- GIVEN a donante submitting a `DIRECTA` donación targeting a necesidad
- WHEN the request omits location and categoria
- THEN the request succeeds exactly as before this change

### Requirement: Pool Donation Visibility Before Assignment

The system MUST show an unassigned `FONDO_COMUN` donación to its donante as waiting/unassigned
(`sinAsignar`), with no organizacion, ronda date, or score data, until a ronda assigns it.

#### Scenario: Unassigned pool donation in Mis donaciones

- GIVEN a `FONDO_COMUN` donación with no `Asignacion` yet
- WHEN the donante views it in Mis donaciones
- THEN it shows as waiting for assignment, with no organizacion or score breakdown displayed

### Requirement: Assignment Offers the Donation, Does Not Force Acceptance

The system MUST treat a ronda's assignment as an offer: once `ronda-asignacion` persists an
`Asignacion` linking the pool donación to a candidate necesidad/organizacion, the donación's state
MUST become `OFRECIDA` to that organizacion, and the receiving referente MUST accept
(`OFRECIDA → ACEPTADA`) or reject (`OFRECIDA → RECHAZADA`) it exactly as they would a `DIRECTA`
donación aimed at their own necesidad.

#### Scenario: Assignment produces an offer, not an automatic acceptance

- GIVEN a pool donación assigned by a ronda to necesidad N of organizacion X
- WHEN the assignment is persisted
- THEN the donación's `estado` becomes `OFRECIDA` and organizacion X's referente sees it awaiting
  their decision — it is NOT already `ACEPTADA`

#### Scenario: Referente accepts an assigned pool donation

- GIVEN a pool donación `OFRECIDA` to organizacion X after assignment
- WHEN X's referente accepts it
- THEN it transitions to `ACEPTADA` and proceeds through the normal delivery lifecycle
  (`entrega-qr-ttl` applies identically regardless of `modalidad`)

### Requirement: Rejection Returns the Donation to the Pool

The system MUST return a rejected pool donación (`OFRECIDA → RECHAZADA` by the assigned referente)
to the pool of unassigned donations eligible for the next ronda, rather than leaving it terminally
`RECHAZADA` as a `DIRECTA` rejection would. The prior, now-void `Asignacion` record MUST remain in
history (not deleted) but MUST NOT count as the donación's current assignment.

#### Scenario: Rejected pool donation is eligible for the next ronda

- GIVEN a pool donación rejected by organizacion X's referente
- WHEN the next ronda runs
- THEN that donación is included among the pool donations offered to the solver again

#### Scenario: Prior rejected assignment stays in history

- GIVEN a pool donación that was assigned, then rejected, then reassigned in a later ronda
- WHEN its assignment history is inspected
- THEN both the rejected `Asignacion` and the current one are visible

### Requirement: Donante May Cancel an Unassigned Pool Donation

The system MUST allow the donante to cancel a `FONDO_COMUN` donación while it remains unassigned
(`sinAsignar`, no active `Asignacion`), transitioning it to `CANCELADA`, mirroring the existing
`eliminar`/cancel semantics for `OFRECIDA` `DIRECTA` donations.

#### Scenario: Donante cancels while waiting

- GIVEN an unassigned pool donación
- WHEN its donante cancels it
- THEN it transitions to `CANCELADA` and is excluded from all future rondas

#### Scenario: Donante cannot cancel once offered to an organizacion

- GIVEN a pool donación currently `OFRECIDA` to an organizacion after assignment
- WHEN the donante attempts to cancel it directly
- THEN the request follows the same rule as a `DIRECTA` donación in `OFRECIDA` state (existing
  cancel/decline semantics apply identically; no special pool-only bypass is introduced)

### Requirement: Nueva Donación Screen

The system MUST provide a "Nueva donación" screen where the donante chooses `modalidad`
(`DIRECTA` vs `FONDO_COMUN`); choosing `FONDO_COMUN` MUST reveal the required `categoria` selector
and a map control for marking the pickup/delivery location, and MUST show the 4-criteria scoring
side panel (deficit, urgencia, proximidad, espera) explaining how the pool assignment will be
scored, without exposing organizacion-identifying data before assignment.

#### Scenario: Choosing FONDO_COMUN reveals required fields

- GIVEN the Nueva donación screen
- WHEN the donante selects `FONDO_COMUN`
- THEN the categoria selector and location map control become visible and required before submit

#### Scenario: Choosing DIRECTA shows the existing necesidad picker

- GIVEN the Nueva donación screen
- WHEN the donante selects `DIRECTA`
- THEN the existing necesidad-selection UI is shown, unchanged from before this feature

### Requirement: Donación Ofrecida Progress Screen

The system MUST show a pool donación's progress through named steps: Ofrecida (created,
unassigned) → Asignación (a ronda has matched it) → En camino → Entregada, and MUST distinguish an
unassigned pool donación from one currently `OFRECIDA` to an organizacion post-assignment.

#### Scenario: Progress shows unassigned state

- GIVEN a pool donación with no `Asignacion`
- WHEN its progress is viewed
- THEN the screen shows it waiting at the "Ofrecida" step, before any "Asignación" step is reached

#### Scenario: Progress shows post-assignment steps

- GIVEN a pool donación assigned and accepted, now `EN_CAMINO`
- WHEN its progress is viewed
- THEN the "Asignación" step is shown as completed and "En camino" as the current step

### Requirement: Mis Donaciones Detail for Pool Donations

The system MUST show, in the Mis donaciones detail for a `FONDO_COMUN` donación that has been
assigned, a `modalidad` badge, the assigned organizacion, the ronda date, the per-criterion score
breakdown, and the assignment timeline; for one not yet assigned, it MUST show only the
`modalidad` badge and the waiting state, per the visibility requirement above.

#### Scenario: Assigned pool donation detail shows the score breakdown

- GIVEN a pool donación assigned in a ronda dated 2026-10-01 with `deficit=0.8, urgencia=0.6,
  proximidad=0.7, espera=0.3` and a computed total
- WHEN the donante opens its Mis donaciones detail
- THEN the screen shows the assigned organizacion, ronda date `2026-10-01`, each per-criterion
  score, and the total
