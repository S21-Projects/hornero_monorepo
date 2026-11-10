# Ronda Vulnerabilidad Viva Specification

## Purpose

Define how the MS computes, at ronda time and from the current database, the `deficit` (vulnerability)
term for each candidate, including the population data it depends on.

## Requirements

### Requirement: Population Data Per Census Radio

The system MUST store the 2022 population per census radio in a `poblacion_radio` table (radio code,
population), created by an additive, idempotent `scripts/sql` migration. The population import MUST be
re-runnable: running it again MUST yield identical table contents with no duplicates. The migration
MUST NOT alter any existing table.

#### Scenario: Re-running the import is idempotent

- GIVEN `poblacion_radio` was already loaded from the population dataset
- WHEN the import is run again with the same dataset
- THEN the table holds the same rows and row count as after the first run

### Requirement: Live Deficit Computed From the Current Database

When a ronda is triggered, the MS MUST compute each candidate's `deficit` from the current database
in a single aggregate query per ronda, never from data baked into the worker image.

- Comedores of a radio = organizaciones with `estado` `APROBADA` or `SIN_RECLAMAR` that have
  coordinates and a `codigo_radio`. `INACTIVA`, `PENDIENTE` and `RECHAZADA` MUST be excluded.
- Open necesidades of a radio = necesidades `ABIERTA` or `EN_PROGRESO`, using the same "uncovered"
  definition as `/organizaciones/mapa`.
- `hpc` = population of the radio / comedores of the radio.
- `median` = `percentile_cont(0.5)` of `hpc` over radios that have at least one comedor.
- `deficit = hpc / median * (1 + necesidadesAbiertas / comedores)`.
- `asistentes_declarados` MUST NOT take part in the formula.

#### Scenario: Deficit follows the formula

- GIVEN radio R has population 3000, 2 comedores and 1 open necesidad, and the median `hpc` over
  radios with comedores is 1000
- WHEN a ronda is triggered
- THEN a candidate of radio R receives `deficit = (3000/2)/1000 * (1 + 1/2) = 2.25`

#### Scenario: Estado and necesidad changes are reflected without a rebuild

- GIVEN a radio with two APROBADA comedores
- WHEN one organizacion becomes INACTIVA, or a necesidad is opened or closed, and a new ronda runs
- THEN that ronda's `deficit` for the radio reflects the new comedor and necesidad counts

#### Scenario: Excluded estados are not comedores

- GIVEN a radio whose only organizaciones are PENDIENTE, RECHAZADA or INACTIVA
- WHEN the aggregate is computed
- THEN the radio has zero comedores and does not take part in the median

### Requirement: Neutral Deficit Without a Resolvable Radio or Population

A candidate whose organizacion has no `codigo_radio`, or whose radio has no population row, MUST
receive a NEUTRAL `deficit` of 1.0, and the reason MUST be recorded in that candidate's
`deficitFuente`. A candidate with a computed value MUST carry `deficitFuente` PROVISTO.

#### Scenario: Organizacion without radio gets NEUTRAL

- GIVEN a candidate whose organizacion has no `codigo_radio`
- WHEN the ronda input is assembled
- THEN its `deficit` is 1.0 and `deficitFuente` records NEUTRAL

#### Scenario: Radio without population gets NEUTRAL

- GIVEN a candidate whose `codigo_radio` has no row in `poblacion_radio`
- WHEN the ronda input is assembled
- THEN its `deficit` is 1.0 and `deficitFuente` records NEUTRAL
