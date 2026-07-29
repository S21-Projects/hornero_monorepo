# Referente-Organizacion Assignment Specification

## Purpose

Define the 1:N relationship between `Referente` and `Organizacion`: a referente may hold multiple organizations (capped), an organizacion has at most one referente, and organizations may become unassigned.

## Requirements

### Requirement: One Referente Manages Multiple Organizaciones
The system MUST allow a `Referente` to own more than one `Organizacion` and MUST return all owned organizaciones as a list from referente-scoped org lookups (e.g. `GET /api/organizaciones/mia`).

#### Scenario: Referente with two organizaciones
- GIVEN a referente owns two validated organizaciones
- WHEN they request their organizaciones
- THEN both are returned in the response list
- AND necesidades/donaciones operations resolve against an explicit organization id rather than an implicit single org

### Requirement: Self-Service Organizacion Cap
The system MUST allow a referente to self-service create additional organizaciones beyond the one created at registration, up to a hard cap of 3 organizaciones total per referente.

#### Scenario: Referente creates a second and third organizacion
- GIVEN a referente owns 1 organizacion
- WHEN they self-service create a 2nd and then a 3rd organizacion
- THEN each creation succeeds and each new organizacion enters the existing `validada`/`estado` approval flow before being publicly visible

#### Scenario: Cap enforcement rejects a 4th organizacion
- GIVEN a referente already owns 3 organizaciones
- WHEN they attempt to self-service create a 4th organizacion
- THEN the request is rejected with a clear error indicating the 3-organization cap has been reached
- AND no new organizacion record is created

### Requirement: Organizacion Referente Is Nullable
The system MUST allow an `Organizacion.referente` to be null, representing an "unassigned" state, without requiring a NOT NULL constraint at the schema level.

#### Scenario: Organizacion persists with no referente
- GIVEN an organizacion whose referente has been unassigned
- WHEN the record is persisted or queried
- THEN `referente_id` is NULL and the organizacion is treated as unassigned by downstream consumers

### Requirement: Unassigned Organizacion Stays Visible
An organizacion that becomes unassigned MUST remain visible to admins (flagged as needing reassignment) and MUST remain publicly visible on the Astro public site, since it is still a validated organization.

#### Scenario: Referente deactivated, organizacion becomes unassigned
- GIVEN a referente owns 1 validated organizacion
- WHEN the referente is deactivated
- THEN the organizacion's `referente_id` becomes NULL in the same transaction
- AND the organizacion remains visible and flagged in the admin panel
- AND the organizacion remains visible on the public Astro site exactly as before

#### Scenario: Deactivation unassigns all owned organizaciones
- GIVEN a referente owns 2 validated organizaciones
- WHEN the referente is deactivated from `/users`
- THEN both organizaciones become unassigned in the same operation
- AND the admin is not required to unassign each one individually
