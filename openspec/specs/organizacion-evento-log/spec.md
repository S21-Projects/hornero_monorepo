# Organizacion Evento Log Specification

## Purpose

Define `organizacion_evento`: the append-only record of every accreditation-relevant fact about an
organizacion — registration, evidence submitted/replaced, requisito approved/observed, level
raised/lowered, referente reassigned. This is the audit trail the user required verbatim: *"no
podemos solo tener un crud, tiene que haber registro."*

## Requirements

### Requirement: Event Taxonomy

The system MUST define a `TipoEventoOrganizacion` enum covering at least: `ORGANIZACION_REGISTRADA`,
`EVIDENCIA_ADJUNTADA`, `EVIDENCIA_REEMPLAZADA`, `REQUISITO_APROBADO`, `REQUISITO_OBSERVADO`,
`NIVEL_ELEVADO`, `NIVEL_REDUCIDO`, `REFERENTE_REASIGNADO`. Each event row MUST carry
`organizacion_id`, `tipo`, `ocurridoEn`, `actorUsuarioId`, `actorTipo`, `nivelAntes`, a nullable
`nivelDespues`, a nullable `requisito`, a nullable `evidenciaId`, a `motivo` text, and a `payload`
stored as canonical `text` — never `jsonb` (PostgreSQL normalizes `jsonb` on write, reordering and
reformatting content, which would break byte-for-byte replay and any future hash chain).

#### Scenario: Registration emits its event

- GIVEN a new organizacion is self-registered
- WHEN the registration transaction commits
- THEN an `ORGANIZACION_REGISTRADA` event is appended with `nivelAntes = null`, `nivelDespues = N0`

#### Scenario: Payload is stored as text, not jsonb

- GIVEN any event with a non-empty `payload`
- WHEN the row is persisted and re-read
- THEN the byte content of `payload` is identical to what was written — no key reordering, no
  number reformatting, no duplicate-key collapsing

### Requirement: Only the MS Service Layer Emits Events

The system MUST emit every `organizacion_evento` row exclusively from the MS service layer, inside
the same `@Transactional` boundary as the state write it records. The BFF and `ts_hornero_admin`
MUST NEVER write events directly — they only trigger MS operations that emit them as a side effect.

#### Scenario: Level change and its event commit together

- GIVEN an admin raises an organizacion's level
- WHEN the service method executes
- THEN the `nivel` update and the `NIVEL_ELEVADO` event insert occur in the same transaction
- AND if the transaction rolls back, neither the level change nor the event persists

#### Scenario: BFF cannot write events directly

- GIVEN the BFF's proxy layer for organizacion endpoints
- WHEN its code is inspected
- THEN no BFF module holds a direct write path to `organizacion_evento` — every mutation is a
  forwarded MS call

### Requirement: Events Are Immutable

The system MUST NOT expose any update or delete operation for `organizacion_evento` rows. The
repository layer MUST expose inserts and finders only, so append-only is enforced by the absence
of the operation rather than by a runtime check alone.

#### Scenario: No update path exists

- GIVEN the `OrganizacionEvento` repository interface
- WHEN it is inspected
- THEN it defines no `update`/`save`-over-existing-id or `delete` method for event rows

#### Scenario: Correcting a mistaken event requires a new event

- GIVEN an event was recorded with an incorrect `motivo` due to admin error
- WHEN the mistake is discovered
- THEN the correction is a new event describing the correction — the original row is never edited or removed

### Requirement: Replay Equals Stored Level

The system MUST guarantee, as a binding invariant asserted by an automated test, that replaying an
organizacion's `organizacion_evento` log (applying each `nivelAntes → nivelDespues` transition in
`ocurridoEn` order) reconstructs exactly its currently stored `nivel`. The stored `nivel` column
remains authoritative for reads (no on-read recomputation); the log remains authoritative for *why*.

#### Scenario: Replay matches stored level after multiple transitions

- GIVEN an organizacion that moved N0 → N1 → N2 through two admin-approved transitions
- WHEN its event log is replayed from the beginning
- THEN the reconstructed level equals `N2`, matching the stored `nivel` column

#### Scenario: A level write without its event would fail the invariant test

- GIVEN the invariant-assertion test suite
- WHEN a hypothetical code path updates `nivel` without appending the corresponding event
- THEN the replay-equals-stored test fails, catching the drift before release

### Requirement: Reassignment Is a Logged Non-Accreditation Event

Reassigning an organizacion's referente MUST append a `REFERENTE_REASIGNADO` event and MUST NOT
alter `nivel`, `estado`, or `validada`. This is a non-accreditation event: it changes ownership,
not accreditation status.

#### Scenario: Reassignment logs an event without touching accreditation

- GIVEN an organizacion at `N2` with `estado = APROBADA`
- WHEN an admin reassigns it to a different referente
- THEN a `REFERENTE_REASIGNADO` event is appended with the old and new referente in its payload
- AND `nivel` remains `N2`, `estado` remains `APROBADA`, `validada` is unchanged

#### Scenario: Unassignment (referente deactivated) also logs an event

- GIVEN an organizacion whose referente is deactivated, per `referente-organizacion-assignment`
- WHEN the organizacion's `referente_id` becomes NULL in that transaction
- THEN a `REFERENTE_REASIGNADO` event is appended recording the unassignment
- AND `nivel`, `estado`, `validada` remain unchanged
