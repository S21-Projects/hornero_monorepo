# Organizacion Self-Edit Specification

## Purpose

Define who can edit `aceptaDonaciones`, `sitioWebUrl`, and `donacionDirectaUrl`, and the approval gate that applies to referente-submitted edits versus admin edits. Field validation and public rendering rules live in `organizacion-info-publica`.

## Requirements

### Requirement: Referente Self-Edit Access
The system MUST allow the referente owning an organizacion to submit changes to `aceptaDonaciones`, `sitioWebUrl`, and `donacionDirectaUrl` from `ts_hornero_admin`, and MUST NOT allow that form to edit any other organizacion field (nombre, tipo, direccion, images).

#### Scenario: Owning referente opens the edit form
- GIVEN a referente owns a validated organizacion
- WHEN they open "Mi organización" in `ts_hornero_admin`
- THEN they can submit new values for the three fields only

#### Scenario: Non-owning referente cannot edit
- GIVEN a referente does not own a given organizacion
- WHEN they attempt to submit an edit for that organizacion's three fields
- THEN the request is rejected

### Requirement: Referente Edits Require Admin Approval
A referente-submitted change to any of the three fields MUST NOT be reflected on the public site (`ts_hornero_astro`) until an admin approves it. The organizacion's public-facing values MUST continue rendering the last-approved values while a submission is pending. The referente MUST be able to see their own pending submission, distinguished from the currently-live approved values, when viewing "Mi organización" in `ts_hornero_admin` (DECISION: pending edits are surfaced to the submitting referente as a visibly separate "pending approval" state, not silently held).

#### Scenario: Referente submits a change, public site unaffected until approval
- GIVEN a validated organizacion with `sitioWebUrl = "https://old.org"`
- WHEN the owning referente submits `sitioWebUrl = "https://new.org"`
- THEN `/org/{slug}` continues to render `https://old.org` until an admin approves the change

#### Scenario: Referente sees their own pending submission
- GIVEN a referente has submitted a change to `donacionDirectaUrl` that is awaiting admin approval
- WHEN they reopen "Mi organización"
- THEN they see the pending value clearly marked as pending, separate from the last-approved live value

#### Scenario: Admin approves a referente submission
- GIVEN a referente has a pending submission for the three fields
- WHEN an admin approves it
- THEN the submitted values become the live, publicly-rendered values
- AND the pending state is cleared

#### Scenario: Admin rejects a referente submission
- GIVEN a referente has a pending submission for the three fields
- WHEN an admin rejects it
- THEN the live public values are unchanged
- AND the referente's pending state is cleared or marked rejected so they know to resubmit

#### Scenario: New pending submission replaces an older pending submission
- GIVEN a referente already has a pending submission awaiting approval
- WHEN the same referente submits another change before it is reviewed
- THEN the newer submission replaces the older pending one
- AND only one pending submission per organizacion exists at a time

### Requirement: Admin Direct Edit Goes Live Immediately
When an admin edits the three fields for any organizacion (owned by a referente or unassigned), the change MUST take effect immediately on the public site with no approval step, and MUST NOT create a pending submission.

#### Scenario: Admin edits a field directly
- GIVEN any organizacion, with or without a pending referente submission
- WHEN an admin sets a new value for one of the three fields from the admin panel
- THEN `/org/{slug}` reflects the new value immediately
- AND no approval step is required

#### Scenario: Admin edit while a referente submission is pending
- GIVEN a referente has a pending submission for `sitioWebUrl`
- WHEN an admin directly edits `sitioWebUrl` to a different value before the referente's submission is reviewed
- THEN the admin's value goes live immediately
- AND the referente's pending submission is superseded (cleared or marked stale) rather than silently applied afterward
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
