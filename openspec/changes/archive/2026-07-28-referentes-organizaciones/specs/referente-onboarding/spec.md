# Referente Onboarding Specification

## Purpose

Define the registration flow for a new `Referente`, ensuring it always ends with the referente owning at least one `Organizacion`, including recovery from partial failure.

## Requirements

### Requirement: Registration Creates an Organizacion
The system MUST require an `Organizacion` creation step (tipo, direccion, descripcion, lat/lng via map picker) as part of `Referente` registration, after account creation and before the flow is considered complete.

#### Scenario: Successful registration
- GIVEN a visitor submits the referente registration form with valid account and organizacion data
- WHEN the account and the organizacion are both created successfully
- THEN the referente is authenticated and lands on a working dashboard
- AND is never routed to `/pending-validation` without an owned `Organizacion`

### Requirement: Partial-Failure Retry
The system MUST allow a referente whose account was created but whose organizacion creation failed to retry organizacion creation without re-registering the account.

#### Scenario: Organizacion creation fails after account creation
- GIVEN a referente account was created successfully
- WHEN the subsequent `POST /api/organizaciones` call fails (network/server error)
- THEN the referente is NOT required to re-submit account credentials
- AND a resumable "create your organizacion" entry point is available from `/pending-validation`

#### Scenario: Retry succeeds
- GIVEN a referente is on the resumable organizacion-creation entry point after a prior failure
- WHEN they resubmit organizacion data and it succeeds
- THEN the referente owns exactly one `Organizacion` and proceeds to the dashboard

### Requirement: New Organizacion Enters Existing Approval Flow
The system MUST route every organizacion created at registration through the existing `validada`/`estado` approval flow. No new approval mechanism SHALL be introduced.

#### Scenario: Newly registered organizacion is pending
- GIVEN a referente completes registration and their organizacion is created
- WHEN the organizacion record is persisted
- THEN it has `validada = false` / a pending `estado`, matching the existing `/panel` validate/reject flow
- AND it is not publicly visible on Astro until validated

### Requirement: Donante Registration Unchanged
The system MUST NOT alter `Donante` registration behavior as part of this change.

#### Scenario: Donante registers
- GIVEN a visitor submits the donante registration form with valid data
- WHEN the account is created
- THEN the donante account is created exactly as before this change, with no organizacion-creation step and no new required fields
