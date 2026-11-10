# Referente Onboarding Specification

## Purpose

Define the registration flow for a new `Referente`, ensuring it always ends with the referente owning at least one `Organizacion`, including recovery from partial failure.

## Requirements

### Requirement: Registration Creates an Organizacion

The system MUST require an `Organizacion` creation step (tipo, direccion, descripcion, lat/lng via
map picker) as part of `Referente` registration, after account creation, and MUST follow it with a
3rd registration step, "Acreditación" (Bienvenida), that explains the N0–N3 accreditation ladder
and ends in a CTA "Empezar con N1" routing to the existing `acreditacion.tsx` screen, before the
flow is considered complete.

(Previously: registration ended directly at a working dashboard immediately after organizacion
creation succeeded, with no intermediate onboarding step.)

#### Scenario: Successful registration reaches Bienvenida then acreditación

- GIVEN a visitor submits the referente registration form with valid account and organizacion data
- WHEN the account and the organizacion are both created successfully
- THEN the referente is authenticated and lands on the Bienvenida ("Acreditación") step
- AND is never routed to `/pending-validation` without an owned `Organizacion`

#### Scenario: Bienvenida CTA routes to the acreditación screen

- GIVEN a referente on the Bienvenida step after successful organizacion creation
- WHEN they select "Empezar con N1"
- THEN they are routed to the existing `acreditacion.tsx` screen, which loads data via
  `useAcreditacion`

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
### Requirement: Bienvenida Step Scope and Content

The system MUST show the Bienvenida step only within the referente registration flow, immediately
after the Organización step and before the flow reaches its final destination, and MUST present an
explanation of the N0..N3 ladder (see `organizacion-acreditacion`) purely as UI — it MUST NOT
introduce new backend endpoints, new required fields, or alter the partial-failure retry behavior
already defined for organizacion creation.

#### Scenario: Bienvenida does not appear in donante registration

- GIVEN a visitor completing donante registration
- WHEN the flow proceeds through its steps
- THEN no Bienvenida/Acreditación step appears at any point, consistent with "Donante Registration
  Unchanged"

#### Scenario: Bienvenida introduces no new required registration data

- GIVEN a referente reaching the Bienvenida step
- WHEN the step is displayed
- THEN it requires no form input beyond the CTA click — it does not gate progress on any new field
