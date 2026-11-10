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
### Requirement: Reassignment Logs an Event and Never Alters Accreditation

Any change to `Organizacion.referente` — assigning a referente to a previously unassigned
organizacion, moving an organizacion from one referente to another, or the referente deactivation
path already specified under "Unassigned Organizacion Stays Visible" — MUST append a
`REFERENTE_REASIGNADO` event (per `organizacion-evento-log`) in the same transaction as the
`referente_id` write, and MUST NOT alter `nivel`, `estado`, or `validada`. This extends the
existing "unassigned organizacion stays visible" invariant; it does not change any previously
specified behavior of that requirement.

#### Scenario: Admin assigns a referente to a previously unassigned organizacion

- GIVEN an organizacion at `N1` with `referente_id = NULL`
- WHEN an admin assigns a referente to it
- THEN `referente_id` is set to that referente
- AND a `REFERENTE_REASIGNADO` event is appended in the same transaction
- AND `nivel` remains `N1`, `estado` and `validada` are unchanged

#### Scenario: Admin moves an organizacion between two referentes

- GIVEN an organizacion at `N2` owned by referente A
- WHEN an admin reassigns it to referente B
- THEN `referente_id` changes from A to B
- AND a `REFERENTE_REASIGNADO` event is appended recording both the old and new referente
- AND `nivel`, `estado`, `validada` are unchanged

#### Scenario: Referente-deactivation unassignment also logs the event

- GIVEN a referente owning 2 validated organizaciones is deactivated (per the existing "Deactivation unassigns all owned organizaciones" scenario)
- WHEN both organizaciones' `referente_id` become NULL in that operation
- THEN a `REFERENTE_REASIGNADO` event is appended for each organizacion
- AND neither organizacion's `nivel`, `estado`, or `validada` changes as a result

#### Scenario: A regression test asserts accreditation state is untouched by reassignment

- GIVEN the automated test suite for `referente-organizacion-assignment`
- WHEN a reassignment test runs against an organizacion with a non-N0 level
- THEN it asserts `nivel`, `estado`, and `validada` are bit-for-bit unchanged before and after reassignment, failing the build if any of the three drifts
