# Spec: reclamo-evidencia-borrado (new capability)

Claim evidence objects live under `reclamo-evidencia/{orgId}/{userId}/{uuid}.{ext}` in the
S3-compatible bucket. Keys are referenced by `reclamo_organizacion_evidencias`. Other prefixes
(`org-evidencia/`, `org-banner/`, `org-profile/`) are out of this capability's reach.

## ADDED Requirements

### Requirement: Evidence deletion after anonymization

After a user's anonymization transaction commits, the system MUST delete every claim evidence
object whose key was referenced by the user's claims at anonymization time, and every other object
under `reclamo-evidencia/*/{userId}/`. Keys MUST be captured before the claim rows are cleared.
Deletion MUST NOT run if the transaction rolls back.

#### Scenario: Referenced and stray objects are deleted after commit
- GIVEN a user with claims referencing 2 evidence keys and 1 extra stray object under `reclamo-evidencia/{orgId}/{userId}/`
- WHEN the user is anonymized and the transaction commits
- THEN all 3 objects are deleted from the store
- AND objects under `reclamo-evidencia/` belonging to other users are untouched

#### Scenario: Rollback deletes nothing
- GIVEN a user with claim evidence
- WHEN the anonymization transaction rolls back
- THEN no object is deleted

### Requirement: Deletion failure is isolated and recorded

A storage failure during post-commit deletion MUST NOT undo or fail the committed anonymization.
The failure MUST be logged and recorded as an actividad. The nightly sweep is the retry.

#### Scenario: Storage error after commit
- GIVEN the store throws when deleting
- WHEN a user is anonymized
- THEN the anonymization remains committed and the call succeeds
- AND a failure actividad is recorded

### Requirement: Actividad never exposes object keys

Actividad records for evidence deletion (per-user and sweep summary) MUST contain counts only and
MUST NOT contain object keys, org ids or user-identifying paths.

#### Scenario: Count-only record
- GIVEN an anonymization deletes 3 objects
- WHEN the actividad is recorded
- THEN it states the count 3 and contains no key or path fragment

### Requirement: Nightly orphan sweep

A scheduled sweep (nightly, America/Argentina/Buenos_Aires, plus startup catch-up) MUST delete
only objects that: are under `reclamo-evidencia/`, match `OBJECT_KEY_PATTERN`, are not referenced by
any claim row, and have `LastModified` older than the grace period (default 7 days). It MUST delete
at most the per-run cap (default 500) and MUST record a `.sistema()` summary actividad (count only)
only when more than 0 objects were deleted.

#### Scenario: Deletes only unreferenced and old keys
- GIVEN under `reclamo-evidencia/`: an old unreferenced key, an old referenced key, a recent unreferenced key
- WHEN the sweep runs
- THEN only the old unreferenced key is deleted

#### Scenario: Other prefixes and non-matching keys are never touched
- GIVEN old unreferenced objects under `org-evidencia/`, `org-banner/` and a non-pattern key under `reclamo-evidencia/`
- WHEN the sweep runs
- THEN none of them is deleted

#### Scenario: Per-run cap
- GIVEN 600 eligible orphans and a cap of 500
- WHEN the sweep runs
- THEN exactly 500 are deleted and the rest remain for the next run

#### Scenario: Nothing to delete records nothing
- GIVEN no eligible orphans
- WHEN the sweep runs
- THEN no summary actividad is recorded

### Requirement: Sweep kill switch

The sweep MUST be disableable by configuration. When disabled it MUST perform no listing and no
deletion.

#### Scenario: Disabled sweep
- GIVEN the kill switch is off and eligible orphans exist
- WHEN the sweep is triggered
- THEN nothing is listed or deleted

### Requirement: Operation without object storage

When bucket configuration is absent, the MS MUST boot and all deletion operations MUST be no-ops
without error. A warning MUST be logged at startup.

#### Scenario: S3 not configured
- GIVEN no bucket configuration
- WHEN the MS starts and a user is anonymized
- THEN the MS boots with a startup warning, anonymization succeeds and no deletion is attempted

### Requirement: Admin label for new actividad types

Each new actividad type MUST have a label in the admin SPA so the activity log renders it.

#### Scenario: Labels exist
- GIVEN the new actividad types
- WHEN the admin domain-ui enumeration test runs
- THEN every type has a label

### Requirement: Deletion is opt-in

Object deletion (anonymization deletion and the nightly sweep) MUST be enabled only when
`app.evidencia.borrado-habilitado` is true, set from `EVIDENCIA_BORRADO_ENABLED`. The default MUST be
false. When it is false the MS MUST use the no-op object store, so no object is listed or deleted.
The flag is set to true on the production Pi only; local stacks that use the production R2 bucket
MUST leave it unset.

#### Scenario: Flag unset on a stack that has bucket credentials
- GIVEN bucket credentials are configured and `EVIDENCIA_BORRADO_ENABLED` is unset
- WHEN the MS starts and a user is anonymized
- THEN the MS logs that deletion is disabled, anonymization succeeds and no object is deleted or listed

#### Scenario: Flag enabled
- GIVEN `EVIDENCIA_BORRADO_ENABLED=true` and bucket credentials are configured
- WHEN a user is anonymized
- THEN the claim evidence deletion described above applies
