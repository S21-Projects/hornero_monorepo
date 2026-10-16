# Ronda Asignacion Specification

## Purpose

Define the manual assignment round ("ronda") that matches unassigned `FONDO_COMUN` donaciones to
candidate necesidades using the existing `go_algorithms_worker` Hungarian solver: who may trigger
it, the transport-independent input/output contract, what gets persisted as `Asignacion`, and how
unassigned donations and an empty ronda are handled.

## Requirements

### Requirement: Manual ADMINISTRADOR Trigger Only

The system MUST allow a ronda to be triggered only by an explicit ADMINISTRADOR action — there
MUST be no scheduler, cron job, or automatic per-donation trigger. The trigger MUST be enforced at
all three layers: MS `SecurityConfig`, BFF `@Roles`, and SPA `ProtectedRoute`.

#### Scenario: Admin triggers a ronda

- GIVEN an authenticated ADMINISTRADOR and at least one unassigned pool donación
- WHEN they trigger "Ejecutar ronda"
- THEN the ronda runs and assignments are persisted

#### Scenario: Referente cannot trigger a ronda

- GIVEN an authenticated REFERENTE
- WHEN they attempt to call the ronda-trigger endpoint directly
- THEN the request is rejected (403 or equivalent)

#### Scenario: Donante cannot trigger a ronda

- GIVEN an authenticated DONANTE
- WHEN they attempt to call the ronda-trigger endpoint directly
- THEN the request is rejected (403 or equivalent)

#### Scenario: No scheduled process exists

- GIVEN the deployed system
- WHEN its process list and schedulers are inspected
- THEN no cron/scheduled job invokes a ronda automatically

### Requirement: Worker Callable Contract Independent of Transport

The system MUST define a versioned input/output schema for calling the solver
(`go_algorithms_worker/internal/assign`) that is independent of the chosen transport (HTTP,
subprocess, or otherwise — transport is a design decision). The input MUST carry every unassigned
pool donación (`id`, `latitud`, `longitud`, `categoria`) and every open candidate necesidad
(`necesidadId`, `organizacionId`, `latitud`, `longitud`, `codigoRadio`, `deficit`, `urgencia`,
`diasDesdeUltimaDonacion`, `categoriasAceptadas`, `categoriasPermitidas`) plus the weighting and
normalization parameters (`Pesos`, `Parametros`). The output MUST carry, per matched pair, the
donación id, the necesidad id (and its organizacion), the per-criterion scores, the total score,
and `costoOportunidad`; unmatched donations MUST be reported explicitly as unassigned, not silently
omitted.

#### Scenario: Input includes every unassigned pool donation

- GIVEN 3 unassigned `FONDO_COMUN` donaciones and 2 already-assigned ones
- WHEN the ronda input is assembled
- THEN exactly the 3 unassigned donaciones appear in the input, not the 2 already assigned

#### Scenario: Output reports an unmatched donation explicitly

- GIVEN a pool donación whose `categoria` no candidate necesidad accepts
- WHEN the solver runs
- THEN the output explicitly lists that donación as unassigned (`sinAsignar`), rather than omitting
  it from the response

#### Scenario: Schema is versioned

- GIVEN the worker contract as implemented
- WHEN its input/output payloads are inspected
- THEN they carry an explicit schema version field, so a future incompatible change can be
  detected by callers

### Requirement: Asignacion Persistence

The system MUST persist a distinct `Asignacion` row per matched (donación, necesidad) pair,
carrying: the organizacion, the necesidad, the ronda date, each per-criterion score (deficit,
urgencia, proximidad, espera), the total score, and `costoOportunidad`, MUST NOT overwrite a prior
`Asignacion` for the same donación in place (history is append-only — see the rejection/reassignment
requirement in `donacion-fondo-comun`), and MUST link the donación being assigned to exactly one
current `Asignacion` at a time.

#### Scenario: Assignment persists full explainability data

- GIVEN a ronda that matches donación 42 to necesidad 7 of organizacion 3
- WHEN the ronda completes
- THEN an `Asignacion` row is persisted with organizacion 3, necesidad 7, the ronda date, the four
  per-criterion scores, the total, and `costoOportunidad`

#### Scenario: Reassignment does not delete prior history

- GIVEN donación 42 was previously assigned then rejected (per `donacion-fondo-comun`)
- WHEN a later ronda assigns it again to a different necesidad
- THEN a NEW `Asignacion` row is persisted
- AND the earlier, rejected `Asignacion` row remains queryable as history

### Requirement: Unassigned Donations Remain in the Pool

The system MUST leave any donación the solver reports as unmatched (`sinAsignar`) in its
unassigned state — no `Asignacion` is created for it, its `estado` is unchanged, and it MUST be
eligible for inclusion in the next ronda's input (per `donacion-fondo-comun`'s indefinite-wait
rule).

#### Scenario: Unmatched donation stays eligible for the next ronda

- GIVEN donación 55 was reported `sinAsignar` in ronda #4
- WHEN ronda #5 is triggered later
- THEN donación 55 is included again in ronda #5's input, unless cancelled by its donante in the
  meantime

### Requirement: Empty Ronda Handling

The system MUST allow triggering a ronda when there are zero unassigned pool donaciones or zero
eligible candidate necesidades, MUST complete successfully with zero assignments made, and MUST
report this outcome clearly to the triggering ADMINISTRADOR rather than as an error.

#### Scenario: No pool donations to assign

- GIVEN zero unassigned `FONDO_COMUN` donaciones exist
- WHEN an ADMINISTRADOR triggers a ronda
- THEN the ronda completes with zero assignments
- AND the admin sees a message stating no donations were pending assignment, not an error page

#### Scenario: No eligible candidates exist

- GIVEN at least one unassigned pool donación but zero organizaciones with an open, eligible
  necesidad
- WHEN a ronda is triggered
- THEN the ronda completes with that donación reported `sinAsignar`
- AND no error is raised

### Requirement: A Ronda Only Processes Donations Unassigned at Trigger Time

The system MUST scope each ronda's input to exactly the donaciones that are unassigned at the
moment the ronda is triggered — a donación created or cancelled after the input snapshot MUST NOT
retroactively join or leave that ronda's run, and re-triggering a ronda immediately afterward MUST
NOT re-assign a donación the prior run already matched (idempotent with respect to
already-assigned donaciones).

#### Scenario: Already-assigned donation is excluded from a later ronda

- GIVEN donación 10 was assigned in ronda #1 and its referente has not rejected it
- WHEN ronda #2 is triggered
- THEN donación 10 is not included in ronda #2's input — it is not re-evaluated or reassigned

#### Scenario: Re-triggering immediately with no new donations is a no-op

- GIVEN a ronda just completed with all pool donations either assigned or reported `sinAsignar`
  with no eligible candidates
- WHEN an ADMINISTRADOR triggers another ronda immediately, with no new donations or necesidades
  created in between
- THEN the new ronda completes with the same `sinAsignar` set and no new `Asignacion` rows

### Requirement: Ronda Consumes the Compliance Signal

The system MUST feed each candidate necesidad's organizacion compliance-history term (see
`asignacion-historial-cumplimiento`) into the ronda input alongside the existing four criteria, so
the persisted score breakdown reflects the organizacion's delivery reliability.

#### Scenario: Compliance signal is present in the ronda input

- GIVEN organizacion X has a computed compliance rate of 0.9
- WHEN a ronda's input is assembled for a necesidad of organizacion X
- THEN that candidate's input payload carries the 0.9 compliance signal
### Requirement: Factory Supplies Radio and Live Deficit

For every candidate, the MS ronda input factory MUST fill `codigoRadio` (the organizacion's stored
radio, or absent) and `deficit` with its `deficitFuente`, as defined in `ronda-vulnerabilidad-viva`.
The worker MUST honor the supplied value (PROVISTO or NEUTRAL) over any CSV-based resolution. No
schema version bump is required.

#### Scenario: Candidate carries codigoRadio and deficit

- GIVEN a candidate necesidad of an organizacion with a radio and population
- WHEN the ronda input is assembled
- THEN the candidate carries that `codigoRadio`, a computed `deficit`, and `deficitFuente` PROVISTO

### Requirement: Worker Serve Mode Requires No CSV Data

The worker `serve` mode MUST start and solve rondas without any CSV data file present, and the
worker Docker image MUST NOT ship the vulnerability or ReNaCoM CSVs. The `metrics` and `assign` CLI
subcommands MUST keep supporting CSV data for offline batch runs.

#### Scenario: Serve starts and assigns without CSVs

- GIVEN a worker started in `serve` mode with no CSV files available
- WHEN it receives a ronda input whose candidates carry `deficit`
- THEN it starts and returns the assignment result without error

#### Scenario: CLI subcommands still read CSVs

- GIVEN the CSV data files
- WHEN `metrics` or `assign` is run with `--data`
- THEN they work as before
