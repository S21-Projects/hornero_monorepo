# Delta for Referente Onboarding

## MODIFIED Requirements

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

## ADDED Requirements

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
