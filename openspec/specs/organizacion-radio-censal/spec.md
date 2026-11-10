# Organizacion Radio Censal Specification

## Purpose

Define how an organizacion's 2022 census radio (`codigo_radio`) is resolved from its coordinates by
the worker and stored by the MS, so platform-created organizaciones are treated like imported ones.

## Requirements

### Requirement: Worker Resolves a Coordinate to a 2022 Radio

The worker MUST expose an internal `POST /v1/radio` that, given a latitude and longitude, returns the
2022 `codigo_radio` of the radio polygon containing the point (point-in-polygon, 2022 vintage only).
When no polygon contains the point (e.g. outside Argentina) it MUST answer an explicit "not found"
result, not an error. The endpoint MUST stay internal (no host port).

#### Scenario: Point inside Argentina resolves to a radio

- GIVEN a coordinate that lies inside a 2022 radio polygon
- WHEN `POST /v1/radio` is called with it
- THEN the response carries that polygon's `codigo_radio`

#### Scenario: Point outside Argentina is not found

- GIVEN a coordinate outside every 2022 radio polygon
- WHEN `POST /v1/radio` is called with it
- THEN the response states that no radio was found

### Requirement: Best-Effort Radio Resolution on Create and Edit

`OrganizacionService.crear` and `editar` MUST resolve `codigo_radio` through the worker whenever the
organizacion's coordinates are set or changed. Resolution MUST be best-effort: if the worker is
unreachable, errors, or finds no radio, the organizacion MUST still be saved and `codigo_radio` MUST
be null. A coordinate change MUST NOT leave a stale radio from the previous location.

#### Scenario: Create resolves the radio

- GIVEN the worker is up
- WHEN an organizacion is created with coordinates inside a 2022 radio
- THEN it is saved with that `codigo_radio`

#### Scenario: Worker down does not block saving

- GIVEN the worker is unreachable
- WHEN an organizacion is created or its coordinates are edited
- THEN the organizacion is saved successfully with `codigo_radio` null

#### Scenario: Edit to new coordinates refreshes the radio

- GIVEN an organizacion with a stored `codigo_radio`
- WHEN its coordinates are edited to a point in a different radio
- THEN its `codigo_radio` is the new radio (or null if it could not be resolved)

### Requirement: Backfill of Existing Organizaciones

The system MUST provide a re-runnable backfill that resolves `codigo_radio` for existing
organizaciones that have coordinates but no radio. It MUST NOT overwrite an existing radio and MUST
tolerate individual resolution failures, leaving those organizaciones null for a later run.

#### Scenario: Backfill fills only missing radios

- GIVEN platform organizaciones with coordinates and no radio, and imported ones with a radio
- WHEN the backfill runs with the worker up
- THEN the former receive a `codigo_radio` and the latter are unchanged
