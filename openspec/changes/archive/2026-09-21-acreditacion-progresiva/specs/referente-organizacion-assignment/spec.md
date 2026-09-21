# Delta for Referente-Organizacion Assignment

## ADDED Requirements

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
