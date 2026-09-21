# Organizacion Legajo Specification

## Purpose

Define the accreditation dossier ("legajo"): a server-assembled export of an organizacion's
current level, per-requisito evidence status, and full chronological event history, rendered as a
printable view in `ts_hornero_admin`. The legajo is the artifact an admin (or the organizacion
itself) can present as a defensible audit trail — declared and admin-audited, explicitly never
system-verified.

## Requirements

### Requirement: Legajo Assembly

The system MUST assemble the legajo server-side in the MS as JSON, proxied unmodified by the BFF,
and MUST include: organizacion identity, its current `nivel` with the since-date of the transition
that produced it, one entry per `RequisitoAcreditacion` with its status, evidence type, validity
window, `VIGENTE`/`VENCIDA` flag, and who audited it and when; links to evidence photos (served
through the authenticated evidence route, never the public `/images` route); and the full
chronological `organizacion_evento` log for that organizacion.

#### Scenario: Legajo lists every union requisito, even unfulfilled ones

- GIVEN an organizacion at `N1` (only N1 requisitos have evidence)
- WHEN its legajo is assembled
- THEN all 8 `RequisitoAcreditacion` entries appear
- AND N2/N3 requisitos without any evidence row show status `FALTANTE`

#### Scenario: Legajo reflects VIGENTE vs VENCIDA per requisito

- GIVEN an organizacion with `APROBADA` evidence for `CONDICIONES_SANITARIAS_ADECUADAS` whose `validoHasta` is in the future, and `APROBADA` evidence for `RADIO_50KM_BANCO_ALIMENTOS` whose `validoHasta` has passed
- WHEN the legajo is assembled
- THEN the first entry shows `VIGENTE` and the second shows `VENCIDA`
- AND neither entry's status changes the organizacion's stored `nivel`

#### Scenario: Legajo includes the full event log in order

- GIVEN an organizacion with 5 recorded events
- WHEN its legajo is assembled
- THEN all 5 events appear in chronological order with actor, timestamp, and type

### Requirement: Per-Requisito Status Values

The system MUST report each requisito's legajo status as exactly one of `APROBADA`, `OBSERVADA`,
`PENDIENTE`, or `FALTANTE` (no evidence row exists at all for that requisito).

#### Scenario: Requisito with observed evidence shows OBSERVADA

- GIVEN an evidence row for `NO_DISCRIMINACION` in `OBSERVADA` state
- WHEN the legajo is assembled
- THEN that requisito's status is `OBSERVADA`, not `PENDIENTE` or `FALTANTE`

### Requirement: Not-System-Verified Disclosure

The legajo MUST include a footer or equivalent visible statement declaring plainly that the
document records declared and admin-audited evidence, not system-verified facts. This disclosure
MUST be present on every legajo export, not conditional on level or requisito status.

#### Scenario: Disclosure present regardless of level

- GIVEN a legajo for an organizacion at `N0` and a legajo for an organizacion at `N3`
- WHEN either is rendered or exported
- THEN both display the same not-system-verified disclosure text

### Requirement: Printable Rendering, No Server-Side PDF

The system MUST render the legajo as a printable HTML view in `ts_hornero_admin` with a print
stylesheet, and MUST NOT generate PDFs server-side (no headless-browser dependency on the
Raspberry Pi deployment). Browser print-to-PDF is the supported export path.

#### Scenario: Admin exports a legajo as PDF via browser print

- GIVEN an admin viewing an organizacion's legajo in `ts_hornero_admin`
- WHEN they use the browser's print-to-PDF function
- THEN a correctly formatted PDF is produced with no server-side rendering involved

#### Scenario: No PDF-generation dependency is introduced

- GIVEN the MS and BFF dependency manifests
- WHEN they are inspected after this change
- THEN neither adds a headless-browser or PDF-rendering library
