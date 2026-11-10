# Admin Referente Management Specification

## Purpose

Define the new admin panel capability to view each referente's managed organizaciones and reassign an organizacion to a different referente or leave it unassigned.

## Requirements

### Requirement: Admin Views Referente-to-Organizaciones Mapping
The system MUST provide an admin-only view listing referentes with the organizaciones each one currently manages, including unassigned organizaciones flagged separately.

#### Scenario: Admin browses referentes and orgs
- GIVEN an authenticated admin opens the new referentes management section
- WHEN the view loads
- THEN each referente is shown with the list of organizaciones they manage
- AND any unassigned organizacion is visibly flagged as needing reassignment

### Requirement: Admin Reassigns an Organizacion
The system MUST allow an admin to change an organizacion's referente to a different active referente.

#### Scenario: Admin reassigns an organizacion to a new referente
- GIVEN an organizacion is currently managed by referente A
- WHEN an admin reassigns it to referente B via the admin panel
- THEN the organizacion's `referente_id` is updated to referente B
- AND the organizacion no longer appears under referente A's managed list
- AND appears under referente B's managed list

### Requirement: Admin Reassigns an Unassigned Organizacion
The system MUST allow an admin to assign a currently unassigned organizacion to an active referente.

#### Scenario: Admin assigns an unassigned org
- GIVEN an organizacion has `referente_id = NULL`
- WHEN an admin assigns it to an active referente
- THEN the organizacion's `referente_id` is set to that referente
- AND it is no longer flagged as unassigned in the admin panel

### Requirement: Reassignment Respects Existing Approval State
Reassigning an organizacion MUST NOT alter its `validada`/`estado` approval state.

#### Scenario: Reassignment preserves validation status
- GIVEN a validated organizacion is unassigned
- WHEN an admin reassigns it to a referente
- THEN the organizacion's `validada`/`estado` value is unchanged
- AND it remains publicly visible on Astro throughout the reassignment
