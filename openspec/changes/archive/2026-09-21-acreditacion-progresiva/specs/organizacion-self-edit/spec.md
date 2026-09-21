# Delta for Organizacion Self-Edit

## ADDED Requirements

### Requirement: Evidence Submission Is Independent From the Self-Edit Pending Snapshot

The referente-facing accreditation evidence submission flow (`organizacion-evidencia`) MUST be a
second, structurally independent referente→admin approval flow from the existing self-edit pending
snapshot (`aceptaDonaciones`, `sitioWebUrl`, `donacionDirectaUrl` — `Organizacion.java:80-92`). The
system MUST NOT reuse the self-edit pending-snapshot fields or its single-pending-submission
replacement semantics to hold evidence submissions, and an `infoPublicaPendiente` submission MUST
NOT be treated as, or emit, an accreditation event.

#### Scenario: Submitting evidence does not touch the self-edit pending snapshot

- GIVEN a referente with an existing pending self-edit submission for `sitioWebUrl`
- WHEN they separately submit evidence for `CONDICIONES_SANITARIAS_ADECUADAS`
- THEN the self-edit pending submission is unchanged
- AND no `organizacion_evento` row is created by the self-edit flow

#### Scenario: Approving a self-edit submission is not an accreditation event

- GIVEN a referente's pending `donacionDirectaUrl` submission
- WHEN an admin approves it
- THEN the value goes live per the existing self-edit behavior
- AND no `organizacion_evento` row is appended as a result of that approval

#### Scenario: The two flows are visually and structurally separate in ts_hornero_admin

- GIVEN both a pending self-edit submission and a pending evidence submission exist for the same organizacion
- WHEN an admin or the owning referente views the organizacion
- THEN the self-edit pending state and the accreditation evidence queue are presented as distinct sections, not merged into one pending list
