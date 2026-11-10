# Organizacion Acreditacion Specification

## Purpose

Define the N0–N3 progressive accreditation ladder for `organizacion`: the level enum, the
`requisito` catalogue each level demands (transcribed verbatim from Banco de Alimentos Córdoba's
published criteria and its signup form), the legal transitions between levels, who may trigger
each transition, and the caps a level imposes on food-category eligibility and concurrent open
`necesidad` records. This capability replaces the single boolean accreditation flip
(`Organizacion.validada`) with a level that is provably backed by approved evidence, while keeping
`validada`/`estado` as a working projection for backwards compatibility.

## Requirement Transcription Note (read before using the enum below)

`RequisitoAcreditacion` is the **union** of two sources, both transcribed in
`docs/tesis/handoff.md` section 4:

1. The seven-item list published at <https://bancodealimentoscba.org.ar/suma-a-tu-comedor/>.
2. The signup-form list supplied by the user, including the eight legal-documentation options.

After deduplicating requirements that appear in both sources under different wording (merged
below, both quotes preserved), the union yields **8 distinct requirements, not 9**. The proposal's
four "structural placeholders" (organizacion identity, identified referente, fixed premises, and
food-assistance purpose) are **not** independently present as auditable requisitos in either
source list — they overlap with `SERVICIO_REGULAR_GRATUITO` (food-assistance purpose + physical
space) and with the registration data already captured by `Organizacion`/`Referente` (name, phone,
address, barrio), which are administrative identification fields, not audited evidence items with
their own approve/observe lifecycle. This discrepancy MUST be reported to the user as a spec-phase
finding; the enum below reflects the honest transcription, not a forced count of 9.

The 50 km radius conflict (measured from Banco de Alimentos, not Córdoba Capital — confirmed by
the user) and the documentation-options conflict ("Simple Asociación" vs. "aval de otra personería
jurídica" — confirmed covered by the form's eight options) are already resolved per the session
preflight; both resolutions are reflected in the transcriptions below.

## Requirements

### Requirement: Accreditation Level Enum

The system MUST represent an organizacion's accreditation as a `NivelAcreditacion` enum with
exactly four values, stored on `Organizacion` as an additive, nullable, Java-defaulted column
(default `N0`, per the D4 pattern at `Organizacion.java:67-70`), never as a derived/replayed value
on read.

| Value | Name | Demands (cumulative) |
|---|---|---|
| `N0` | `REGISTRADA` | Nothing proven; self-registration only |
| `N1` | `IDENTIFICADA` | `SERVICIO_REGULAR_GRATUITO`, `NO_DISCRIMINACION`, `SEDE_INSCRIPTA_INDIVIDUALMENTE` |
| `N2` | `OPERATIVA` | N1 + `CONDICIONES_SANITARIAS_ADECUADAS`, `SIN_KIOSCO_MISMO_DOMICILIO`, `RADIO_50KM_BANCO_ALIMENTOS` |
| `N3` | `ACREDITADA` | N2 + `PERSONERIA_JURIDICA_O_AVAL`, `ACEPTA_AUDITORIAS_SIN_AVISO` |

#### Scenario: New organizacion defaults to N0

- GIVEN a newly self-registered organizacion
- WHEN it is persisted
- THEN its `nivel` is `N0` (`REGISTRADA`)
- AND it is visible to admins only

#### Scenario: N3 means every union requirement is currently approved

- GIVEN an organizacion at level `N3`
- WHEN its requisito evidence is inspected
- THEN every one of the 8 `RequisitoAcreditacion` items has an evidence row in `APROBADA` state and not expired

### Requirement: Requirement Catalogue (`RequisitoAcreditacion`)

The system MUST define a `RequisitoAcreditacion` enum with exactly the 8 constants below,
transcribed verbatim from the sources named in the Requirement Transcription Note. Each constant's
description field MUST preserve the exact source wording (Spanish, unmodified) rather than a
paraphrase. Each constant MUST be mapped to the single level at which it first becomes demanded;
levels above that one continue to demand it (cumulative).

| Constant | First demanded at | Source quote(s), verbatim |
|---|---|---|
| `SERVICIO_REGULAR_GRATUITO` | N1 | Site: *"Brindar un servicio de alimentación gratuito, sin condicionamientos y de manera regular (al menos una vez por semana) en un espacio físico."* Form: *"servicio regular al menos una vez por semana (en el lugar o como viandas)"* |
| `NO_DISCRIMINACION` | N1 | Site: *"No discriminar en la entrega de los alimentos por raza, religión, credo, vecindad o partido político."* Form: *"alimento gratuito sin discriminar por género, edad, religión"* |
| `SEDE_INSCRIPTA_INDIVIDUALMENTE` | N1 | Form: *"si asiste en varias instituciones, inscribir cada una por separado (el alta se aprueba con auditoría sobre la dirección declarada)"* |
| `CONDICIONES_SANITARIAS_ADECUADAS` | N2 | Site: *"Mantener las instalaciones en condiciones sanitarias adecuadas, de acuerdo con el servicio que se presta."* |
| `SIN_KIOSCO_MISMO_DOMICILIO` | N2 | Site: *"No contar con kiosko, almacén o despensa en el mismo domicilio del merendero/comedor."* |
| `RADIO_50KM_BANCO_ALIMENTOS` | N2 | Site: *"Estar dentro de la ciudad de Córdoba o hasta 50 km de distancia desde el Banco de Alimentos Córdoba."* (conflict resolved: distance is measured from Banco de Alimentos, per user confirmation, superseding the form's "de Córdoba Capital" wording) |
| `PERSONERIA_JURIDICA_O_AVAL` | N3 | Site: *"Contar con Personería Jurídica o Simple Asociación (requisito excluyente)."* Form: *"personería jurídica o aval de otra personería jurídica"*. Satisfied by exactly one of 8 documentation options transcribed from the signup form: Asociación Simple, Asociación Civil, Fichero de Culto, Fundación, Cooperativa, Centro de Jubilados, Centro Vecinal, or Aval de otra personería jurídica. |
| `ACEPTA_AUDITORIAS_SIN_AVISO` | N3 | Site: *"Aceptar las visitas de auditoría que realiza el Banco de Alimentos, sin previo aviso."* |

#### Scenario: Enum matches transcription, not a placeholder

- GIVEN the `RequisitoAcreditacion` enum as implemented
- WHEN it is compared against this table
- THEN every constant name maps to a description containing the exact quoted source text
- AND no constant exists whose description is a paraphrase or an untranscribed placeholder

#### Scenario: Documentation requirement accepts any of the 8 options

- GIVEN a referente submitting evidence for `PERSONERIA_JURIDICA_O_AVAL`
- WHEN they select "Centro Vecinal" as the documentation type
- THEN the submission is accepted as satisfying this requisito
- AND the system does not require "Personería Jurídica" or "Simple Asociación" specifically

### Requirement: Legal Level Transitions

The system MUST maintain an explicit transition table (modelled on `TRANSICIONES_PERMITIDAS`,
`DonacionService.java:36-46`) restricting which level-to-level moves are legal, and MUST NOT allow
raising a level unless every requisito demanded by that level (and all levels below it) currently
has approved, non-expired evidence.

- Raising a level (`N0→N1`, `N1→N2`, `N2→N3`) MUST be triggered only by an admin action, after
  verifying requisito coverage, and MUST append a `NIVEL_ELEVADO` event in the same transaction.
- Lowering a level MUST be an explicit, reasoned admin action (`NIVEL_REDUCIDO` event) — it MUST
  NEVER happen automatically as a side effect of evidence expiry (record-and-warn: see
  `organizacion-evidencia`).
- Skipping a level (e.g. `N0→N2` directly) MUST be rejected: transitions only move one rung at a
  time in either direction.

#### Scenario: Admin raises level after requisito coverage is complete

- GIVEN an organizacion at `N1` with all N2 requisitos (`CONDICIONES_SANITARIAS_ADECUADAS`,
  `SIN_KIOSCO_MISMO_DOMICILIO`, `RADIO_50KM_BANCO_ALIMENTOS`) approved and not expired
- WHEN an admin raises it to `N2`
- THEN the transition succeeds
- AND a `NIVEL_ELEVADO` event is appended with `nivelAntes = N1`, `nivelDespues = N2`, the admin as actor

#### Scenario: Raising a level is rejected when a requisito is missing

- GIVEN an organizacion at `N1` with `SIN_KIOSCO_MISMO_DOMICILIO` evidence still `PENDIENTE`
- WHEN an admin attempts to raise it to `N2`
- THEN the transition is rejected
- AND no `nivel` change or event is written

#### Scenario: Skipping a level is rejected

- GIVEN an organizacion at `N0`
- WHEN an admin attempts to set its level directly to `N2`
- THEN the transition is rejected as illegal

#### Scenario: Admin lowers a level with a reason

- GIVEN an organizacion at `N3` where an admin determines `ACEPTA_AUDITORIAS_SIN_AVISO` evidence was fraudulent
- WHEN the admin lowers the organizacion to `N2` and supplies a reason
- THEN the transition succeeds
- AND a `NIVEL_REDUCIDO` event is appended carrying that reason

### Requirement: Backwards-Compatible Projection Onto `validada`/`estado`

The system MUST keep `Organizacion.validada` and `Organizacion.estado` functioning exactly as
today, as a read projection of `nivel`: `estado = APROBADA ⟺ nivel ≥ N1`. Existing `APROBADA` rows
MUST map to `N1` on migration, `PENDIENTE` to `N0`, and `RECHAZADA` to `N0` with a corresponding
rejection event. `findBySlugPublic`'s `APROBADA` filter, the BFF, and `ts_hornero_astro` MUST
require no changes.

#### Scenario: Existing approved organizacion migrates to N1

- GIVEN an organizacion with `estado = APROBADA` from before this change
- WHEN the migration runs
- THEN its `nivel` becomes `N1`
- AND `estado` continues reading `APROBADA`

#### Scenario: Public site is unaffected by the ladder

- GIVEN an organizacion at `N2`
- WHEN `ts_hornero_astro` requests it via the existing public endpoint
- THEN the response and its `estado` field are unchanged from pre-change behavior
- AND no `nivel` field is required or exposed on that path

### Requirement: Level-Driven Food Category Caps

The system MUST restrict which `CategoriaAlimento` values an organizacion's `necesidad` records may
declare, based on its current `nivel`: N1 permits non-perishable categories only; N2 additionally
permits refrigerated and frozen categories; N3 permits all categories. An organizacion at N0 MUST
NOT be able to publish any `necesidad`. A `necesidad` with `categoria = null` ("unclassified") MUST
continue to behave exactly as it does today, unaffected by this cap.

#### Scenario: N1 organizacion requests a refrigerated category

- GIVEN an organizacion at level `N1`
- WHEN it attempts to create a `necesidad` with `categoria = REFRIGERADO`
- THEN the request is rejected with a clear error naming the required level

#### Scenario: N2 organizacion requests a refrigerated category

- GIVEN an organizacion at level `N2`
- WHEN it attempts to create a `necesidad` with `categoria = REFRIGERADO`
- THEN the request succeeds

#### Scenario: Unclassified necesidad is unaffected

- GIVEN an organizacion at level `N1`
- WHEN it creates a `necesidad` with `categoria = null`
- THEN the request succeeds exactly as before this change

### Requirement: Level-Driven Concurrency Caps

The system MUST reject creating a new `necesidad` when doing so would exceed the requesting
organizacion's level-based cap on concurrently open records, counting records in `ABIERTA` or
`EN_PROGRESO` state (`EstadoNecesidad.java:3-8`). Cap values MUST be configuration, not hardcoded:
defaults are N1 = 3, N2 = 6, N3 = 12 open `necesidad` records; N0 = 0 (cannot publish).

#### Scenario: Organizacion at cap is rejected

- GIVEN an organizacion at `N1` with 3 `necesidad` records in `ABIERTA` state
- WHEN it attempts to create a 4th `necesidad`
- THEN the request is rejected with an error identifying the level cap

#### Scenario: Closing a necesidad frees cap room

- GIVEN an organizacion at `N1` with 3 open `necesidad` records
- WHEN one of them transitions out of `ABIERTA`/`EN_PROGRESO`
- THEN the organizacion can successfully create a new `necesidad`

#### Scenario: Cap values are configurable

- GIVEN the deployment's configuration overrides the N2 cap to 8
- WHEN an organizacion at `N2` with 7 open `necesidad` records creates an 8th
- THEN the request succeeds under the overridden cap, with no code change required
