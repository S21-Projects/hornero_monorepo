# Tesis de ingeniería — documento + DER

## Objective
Produce the content of the engineering thesis document and the UML/DER diagrams it
requires, matching the approved title: *"Sistema de acreditación, asignación priorizada
y trazabilidad de donaciones de alimentos"*.

## Problem
The user writes the `.docx` themselves; what is missing is the content, in the order the
consigna demands, plus the diagrams. Two deployment diagrams already exist
(`docs/tesis/diagramas/despliegue-general`, `despliegue-raspberry`); the DER, the class
diagram and the use-case diagrams do not.

## Why now
The accreditation model is frozen (`openspec/changes/acreditacion-progresiva/`: spec,
design and tasks are written), so the data model the DER must show is fully defined
without implementing a line of it. The document has a delivery date; the code does not
block it.

## Scope
Authorized: writing document content under `docs/tesis/`, and PlantUML sources plus
rendered PNGs under `docs/tesis/diagramas/`.
Not authorized here: implementing `acreditacion-progresiva` (planned, waiting), and the
deferred Slice B items recorded in `docs/tesis/handoff.md` §8.

## Constraints
- Methodology is UML, not Scrum — the analyst thesis used UML too.
- Scope narrowed to **food** (the analyst thesis said "donaciones materiales").
- Diagrams render with PlantUML 1.2026.8, already installed: `plantuml -tpng file.puml`.
- Document content in Spanish (it is the thesis); diagram labels in Spanish domain terms.
- No commits without explicit permission; no push, no PRs.

## Tasks
- [x] T1 — Map every JPA entity, field, relation and enum in the MS, plus the accreditation
      entities frozen in the SDD design, into one reference table for the DER.
- [x] T2 — Write `docs/tesis/diagramas/der.puml` and render it.
- [x] T3 — Write the class diagram (`clases.puml`) and render it.
- [x] T4 — Write the use-case diagram from CU-01..CU-06 plus the new accreditation cases,
      and render it.
- [x] T5 — Sections 1–4 of the document: Diagnóstico y Propuesta, Objetivo del prototipo
      (one sentence, infinitive verbs), Límites (Desde… Hasta…), Alcances.
- [x] T6 — Section 5: functional and non-functional requirements, use-case descriptions
      with the standard template, sequence diagrams.
- [x] T7 — Section 6: data dictionary to accompany the DER.
- [x] T8 — Section 7: at least three interface prototypes coherent with the use cases.
- [x] T9 — Architecture-decisions chapter documenting each divergence from the analyst
      thesis (no MS-Login, one BFF, no Redis, single Postgres, no Cognito, Leaflet instead
      of Google Maps) — pending user confirmation, see open question 2 in the handoff.

## Progress
Created 2026-09-20.
- T1 done: full persistence survey (every entity, field, nullability, relation, enum,
  plus the `Usuario` single-table hierarchy and its discriminator) read from the code by
  a delegated read-only mapper. Route: delegated (mapping trigger — 4+ files).
- T2 done: `docs/tesis/diagramas/der.puml` written and rendered to `der.png` with
  PlantUML 1.2026.8. Covers the six existing tables plus `organizacion_evidencia`,
  `organizacion_evento` and the added `Organizacion.nivel`, with the deferred
  `Necesidad.categoria` marked as such. Verified by reading the rendered PNG.

- T3 done: `diagramas/clases.puml` + `.png`. Domain model with the `Usuario` hierarchy,
  the two new accreditation classes, `AcreditacionReplay`, and every persisted enum.
  Level enum constants corrected to `N0..N3` to match the spec. Verified by reading the PNG.
- T4 done: `diagramas/casos-uso.puml` + `.png`. CU-01..CU-06 from the analyst thesis plus
  CU-07..CU-12 (evidence, audit, level change, legajo, pool assignment, e-mail
  verification), with `<<include>>` on the event log. Actor layout rebalanced after a
  first render crossed too many lines. Verified by reading the PNG.
- T5 done: `docs/tesis/documento.md`, sections 1-4 (Diagnóstico y Propuesta, Objetivo,
  Límites, Alcances), grounded in the approved proposal PDF extracted from
  `entregas_tesis/`.

## Coherence gaps — resolution status
1. "Evalúa de forma continua su nivel de acreditación" — resolved by wording, no design
   change: evidence validity IS evaluated continuously (expiry is derived on every read
   and surfaced), while the level change itself stays an explicit, logged admin act. The
   document says this plainly rather than claiming automatic decay.
2. QR delivery validation — **confirmed as real scope** (user, 2026-09-20). A unique
   identifier plus a single-use QR code with automatic expiry, confirmed by both parties.
   Folded into the document (sections 1.3, 3, 4.4) and added to the use-case diagram as
   CU-13. Needs its own SDD change to implement.
3. "Reasignación automática de las donaciones demoradas" — **out of scope** (user,
   2026-09-20). The engine's scope is allocating pooled donations. What to do with a
   donation that comes back (never collected, or refused) is left as an open problem and
   discussed in the conclusions chapter, not implemented. Recorded in the document's
   out-of-scope list. Verified beforehand that the current system cannot do it anyway:
   `Ronda()` is a pure function with no notion of time (`go_algorithms_worker/internal/assign/ronda.go:47`),
   and the state machine has no path back to the pool (`DonacionService.java:39-46`).
4. "Historial de cumplimiento" — **confirmed as real scope** (user, 2026-09-20), but as a
   **scoring weight for pool donations**, not as an accreditation requirement. The
   8-requirement catalogue stays frozen. The accreditation level remains the hard filter;
   compliance history becomes a score term. Folded into the document (sections 1.3, 1.4,
   4.4). Needs its own SDD change to implement. "Verificación territorial" is already
   covered by `RADIO_50KM_BANCO_ALIMENTOS`.

## Follow-on changes this created
- `entrega-qr-ttl`: single-use QR delivery validation, both-sides confirmation, TTL.
  Precedent to reuse: the shipped OTP (BCrypt hash, expiry column, throttle, no Redis).
- `scoring-historial-cumplimiento`: compliance-history term in the Go worker's score, with
  a neutral prior for organizations with no history and a renormalization of the current
  weights (0.35 deficit / 0.30 urgencia / 0.20 proximidad / 0.15 espera).

**Resolved (2026-10-01):** both follow-ons were absorbed into the SDD change
`tesis-core-features` instead of separate changes. `entrega-qr-ttl` shipped as slices 3a–3c
(spec `donacion-entrega-codigo`); `scoring-historial-cumplimiento` shipped as slices 6a–6b
(spec `asignacion-historial-cumplimiento`, design AD-11), with renormalized weights
0.30 deficit / 0.25 urgencia / 0.17 proximidad / 0.13 espera / 0.15 cumplimiento.

- T6 done: section 5 appended to `docs/tesis/documento.md` (749 lines total) — 15 RF,
  15 RNF (spread across security 3, Pi performance 3, availability 2, usability 3,
  maintainability 2, traceability 2), all 13 use cases with the standard template, plus
  three rendered sequence diagrams: `secuencia-evidencia-acreditacion`,
  `secuencia-donacion-fondo-comun`, `secuencia-entrega-qr`. Route: delegated writer.
  Parent corrections after review: event-type names in the sequence diagram were a mix of
  spec and design wording; aligned to the spec (`EVIDENCIA_ADJUNTADA`, `NIVEL_ELEVADO`,
  `NIVEL_REDUCIDO`) and re-rendered.

## Open point raised by T6 — resolved
CU-10 actors: the **owning referente** may export their own organizacion's information,
the administrador any organizacion (user, 2026-09-20). Recorded as D-01 in
`openspec/changes/acreditacion-progresiva/decisiones-posteriores.md`, which amends the
design's `ADMINISTRADOR`-only endpoint rule, and reflected in RF-12, CU-10 and §4.2 of the
document. Sub-decision defaulted, not yet confirmed: the export shows the auditor's role
and the observación, not the administrator's personal identity.

- T7 done: section 6, data dictionary over the seven tables plus the nine enumerations,
  closing with the design decisions a DER reader would otherwise find strange. Each table
  is marked as applied or designed-not-applied, checked against the entities themselves.
- T8 done: section 7, four PlantUML salt wireframes rendered and referenced —
  `ui-evidencia-referente`, `ui-cola-auditoria`, `ui-legajo`, `ui-mapa-publico`. No Docker,
  no screenshots. Document now at ~1119 lines.
- Parent correction after review: the dictionary had followed `design.md`'s event names
  (`NIVEL_SUBIDO`/`NIVEL_BAJADO`, `EVIDENCIA_CARGADA`). The spec owns requirement wording,
  so these were changed to `NIVEL_ELEVADO`/`NIVEL_REDUCIDO`/`EVIDENCIA_ADJUNTADA`, the same
  resolution `sdd-tasks` already recorded.

- T9 done: section 8, "Decisiones de arquitectura", with the three views the user asked
  for — deseada (analyst thesis), actual (referencing the existing deployment diagrams)
  and objetivo del MVP. Two new diagrams: `arquitectura-deseada` and `arquitectura-mvp`,
  the latter marking every postponed piece as `[pospuesto]`. RNF03 (Cognito) and RNF06
  (primary/replica) are addressed head-on as superseded, with the replacement and the
  reason. Divergence table verified against `docker-compose.yml`, `JwtService.java` and
  the frontends' map library — nothing in it was contradicted by the code, and RNF03/RNF06
  were confirmed verbatim from the analyst `.docx`. Parent correction: accents normalized
  in both new diagrams for consistency with the earlier ones.

Document now at 1259 lines, sections 1-8 complete.

## Next step
The document's eight sections are written. Remaining: the user transfers it to Word and
validates it. Then the `acreditacion-progresiva` implementation resumes (90 tasks, four
work units, `size:exception` vs slicing still to decide), followed by the deferred Slice B
items and the two new changes this session created (`entrega-qr-ttl`,
`scoring-historial-cumplimiento`). (requirements + use-case
descriptions + sequence diagrams), T7 (data dictionary), T8 (interface prototypes),
T9 (architecture-decisions chapter).
