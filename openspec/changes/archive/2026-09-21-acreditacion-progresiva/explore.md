# Exploration: acreditacion-progresiva

Progressive accreditation ladder for `organizacion`, with the state/evidence history
that records it. Level and history are ONE change, not two: the level changes over
time, so the history is how accreditation is recorded.

User requirement, verbatim: *"no podemos solo tener un crud, tiene que haber registro."*

Engram mirror: `sdd/acreditacion-progresiva/explore` (observation #673).

## Current state (verified against code)

| Fact | Evidence |
|---|---|
| Accreditation today is binary: `validada` (Boolean) + `estado` (`PENDIENTE`/`APROBADA`/`RECHAZADA`) + `validadoPor` (single `Administrador` FK, overwritten on each call, never appended). No level, no history, no evidence fields. | `jar_hornero_ms/src/main/java/org/example/domain/Organizacion.java:44-52`, `EstadoOrganizacion.java` |
| `validar()` is a single mutation with no transition table and no actor/timestamp log beyond that one FK. | `OrganizacionService.java:85-107` |
| `rechazar()` is only allowed from `PENDIENTE`; there is no re-review path back from `RECHAZADA`. | `OrganizacionService.java:110-122` |
| The existing "pending snapshot" pattern (info-publica self-edit) is one mutable pending row per organizacion. It scales to 3 scalar fields, not to a ladder with many evidence documents each carrying an independent expiry — one pending row cannot express "3 of 5 documents renewed, 2 expiring". | `Organizacion.java:80-92`, `OrganizacionService.java:206-322`, `openspec/specs/organizacion-self-edit/spec.md` |
| `TRANSICIONES_PERMITIDAS` (`EnumMap<EstadoDonacion, Set<EstadoDonacion>>`) + `validateTransition()` is a genuine legal-transition-graph precedent, reusable for level transitions. It validates and mutates one `estado` column; it does NOT log who, when, or why. | `DonacionService.java:36-46`, `DonacionService.java:245-251` |
| `Donacion` has no event/history entity either — only the direct timestamp columns `confirmadaDonanteEn`, `confirmadaReferenteEn`, `overrideEn`. So the pattern above is a transition **validator** precedent, not an audit-log precedent: reusing it alone does not satisfy "tiene que haber registro". | `Donacion.java` |
| No audit/event entity exists anywhere in the MS domain package (confirmed by grep: only `Organizacion`, `Necesidad`, `Donacion`, plus the OTP entity). | `jar_hornero_ms/src/main/java/org/example/domain/` |
| The shipped OTP flow is the project's "time-boxed evidence without Redis" precedent: BCrypt-hashed code, `expiraEn` Instant, `intentos`, `usado`, in-memory throttle. The architecture transfers (a Postgres row with an expiry, no new service); the code-matching mechanism does not — accreditation evidence expires in months or years and needs admin audit review, not self-verification in 15 minutes. | `docs/otp-email-validation.md`, `org/example/auth/otp/CodigoVerificacion.java` |
| There is no quantity or volume field anywhere: `Necesidad` has `descripcion`, `prioridad`, `estado`, `fechaPublicacion`, `fechaVencimiento`; `Donacion` has `fechaOferta`, `fechaEntrega`, `estado`, `observaciones`. The accreditation model is therefore the only place a volume cap can live. | `Necesidad.java`, `Donacion.java` |
| The assignment score has exactly 4 weighted terms (deficit, urgencia, proximidad, espera) and two hard filters today (category acceptance, distance cutoff). No accreditation term exists on either side. The natural integration point is extending `acepta()` as a hard filter, not adding a fifth weighted term. | `go_algorithms_worker/internal/assign/scoring.go:116-155` |
| Hibernate Envers is NOT a current dependency — adopting it is a new dependency, not something already available. | `jar_hornero_ms/pom.xml` |
| Live invariant to preserve: reassigning an organizacion MUST NOT alter its `validada`/`estado` approval state. Reassignment is not an accreditation event. | `openspec/specs/organizacion-self-edit/spec.md:38-46` (referente-organizacion-assignment area) |
| Schema precedent under `ddl-auto=update`: additive, nullable, Java-defaulted columns only. See the "D4" comment. | `Organizacion.java:67-70` |

## Approaches compared

| Approach | Handles evidence decay (level drops with no user action)? | Dossier export | New dependency / Pi cost |
|---|---|---|---|
| Append-only `organizacion_evento` log, level derived on read | Only if the level is recomputed on read; an append-only log with no re-derivation step will not reflect a document that quietly expired | Cheap: the dossier is a filtered query over the log | None |
| Mutable `nivel_actual` column + parallel `organizacion_evento` history table, written together | Only with an explicit scheduled re-evaluation job — same requirement, split differently | Cheap reads; the log still yields the dossier | None |
| Hibernate Envers | No. Envers audits ORM row revisions, not domain evidence with independent expiry; nothing forces re-evaluation on expiry | Poor: revision tables are not shaped for a human-readable dossier | New Maven dependency |
| Hash chain over events | Orthogonal concern | Orthogonal | No new service, but real tamper-evidence requires revoking `UPDATE`/`DELETE` from the app's DB role or anchoring the last hash externally — an operational cost on a single-Postgres Pi, not a checkbox |

Either of the first two is viable. Both **require an explicit re-evaluation step** (scheduled job or on-read computation) to handle expiring evidence; none of the "just log it" options handles decay for free. That step is new infrastructure the codebase has no precedent for, and must be sized explicitly in design and tasks.

## Carried design constraints

- The accreditation level is a **hard filter** on the assignment engine (capping what an organizacion may request), never a score weight. Counting it on both sides rewards the same thing twice and penalizes exactly the newly accredited organizacion in an underserved area — the one the system should be finding.
- `REASIGNADA` is an event, not a state; the resulting state is a return to the pool. The reassignment invariant above supports this.
- `jsonb` breaks hash chains: Postgres normalizes on write (reorders keys, drops duplicates, reformats numbers). Store event payloads as `json`/`text` with canonical serialization, or hash only scalar fields.
- No Redis on the Pi. Expiring evidence is a Postgres row with an expiry column, not a new service.

## Open question — RESOLVED (user decision, 2026-09-20)

Banco de Alimentos Córdoba's live requirements page lists 7 items; the user's older, form-derived list omits three of them (sanitary conditions, accepting unannounced audits, no kiosk/grocery co-located at the same address). The two lists also disagree on whether the alternative to Personería Jurídica is "Simple Asociación" or "aval de otra personería jurídica", and on whether the 50 km radius is measured from Banco de Alimentos or from Córdoba Capital.

**Decision: take the union (AND) of both lists.** They are the same organization's
requirements published in two places, so neither supersedes the other. Where the two
genuinely conflict, the live site wins on the 50 km reference point (measured from
Banco de Alimentos, the more precise statement), and the documentation options come
from the form (Asociación Simple, Asociación Civil, Fichero de Culto, Fundación,
Cooperativa, Centro de Jubilados, Centro Vecinal, Aval), which already covers both
"Simple Asociación" and "aval de otra personería jurídica" as separate options.

**Scope decision (same turn): declared evidence with photo attachments and manual
admin validation.** No automated verification engine; the prototype reaches onboarding
plus admin audit by hand.

Source: <https://bancodealimentoscba.org.ar/suma-a-tu-comedor/>.

## Evidence expiry — decided (user, 2026-09-20)

**Record and warn.** Every piece of evidence stores its own validity date. When that
date passes, the system marks the evidence expired and surfaces it to the admin, but
the accreditation level does NOT drop on its own — only an admin lowers it. No
scheduled job and no on-read recomputation of the level: expiry is a comparison the
read already has the data for, and the level stays an explicit, audited admin event.

Consequences: the DER carries a validity-date column on the evidence entity; the
dossier can state, per requirement, whether its evidence is current or expired; and
the "level decays silently" infrastructure discussed above is out of scope.

## Hash chain — decided (user, 2026-09-20)

**Not in this change.** The append-only event log is the traceability mechanism:
nothing is ever updated, every change is a new row, and current state is derived from
the log. A hash chain is deferred — it can be added later on top of the same log
without reshaping it, since the chain is an extra column over rows that already exist
and are already immutable by convention.

Recorded rationale for the thesis: a chain stored in the same database the application
can `UPDATE` detects accidental corruption, not deliberate tampering, because SHA-256 is
keyless and whoever edits a row can recompute the chain forward. Making it real evidence
requires revoking `UPDATE`/`DELETE` from the application's DB role (leaving `INSERT`), or
anchoring the latest hash outside the database. Both are operational costs on the single
Raspberry Pi deployment, and neither buys anything the log itself does not already give.

## What the level caps — decided (user, 2026-09-20)

**Category plus concurrency, no quantities.** The accreditation level governs which
food categories an organizacion may request (for example, refrigerated goods only from
the level that demands sanitary conditions) and how many `necesidad` records it may
hold open at once. No quantity or unit field is added to `Necesidad` or `Donacion`.

This keeps the cap expressible with fields that already exist, and it lands in the
assignment engine exactly where the design warning says it should: as a hard filter
inside `acepta()` (`go_algorithms_worker/internal/assign/scoring.go:116-126`), never as
a fifth weighted term in `Score()`.

## Risks

1. ~~Evidence-expiry re-derivation is new infrastructure with no precedent in the codebase.~~ Resolved: record-and-warn, no automatic decay, no job.
2. ~~The Banco de Alimentos discrepancy blocks the top level's requirement set.~~ Resolved: union of both lists.
3. ~~Hash-chain tamper-evidence requires a DB-role privilege change or external anchoring.~~ Resolved: no hash chain in this change; deferred.
4. Any new columns must stay additive, nullable and Java-defaulted under `ddl-auto=update`.

Next recommended phase: `sdd-propose` — the open question is answered.
