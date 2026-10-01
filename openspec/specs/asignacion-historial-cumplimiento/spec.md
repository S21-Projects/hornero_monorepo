# Asignacion Historial Cumplimiento Specification

## Purpose

Define the compliance-history scoring term: a per-organizacion reliability signal derived from its
existing donación delivery/cancellation record, folded into the ronda scoring alongside deficit,
urgencia, proximidad, and espera, with a neutral prior for organizaciones lacking history. No new
tracking tables are introduced — the signal is computed from existing `donacion` rows.

## Requirements

### Requirement: Compliance Rate Definition

The system MUST compute an organizacion's compliance rate from its existing donaciones as the
proportion delivered (`ENTREGADA`) out of its total resolved donaciones, where "resolved" means
`ENTREGADA` or `RECHAZADA`. `CANCELADA` donaciones MUST NOT be counted either way: every
cancellation is initiated by the donante (or an admin override), so it says nothing about the
organizacion's reliability. Donaciones still in a non-terminal state MUST NOT be counted either
way.

#### Scenario: Compliance rate from mixed history

- GIVEN organizacion X has 8 `ENTREGADA` donaciones, 1 `CANCELADA`, and 1 `RECHAZADA`
- WHEN its compliance rate is computed
- THEN the `CANCELADA` donacion is ignored and the rate is 8/9 ≈ 0.889

#### Scenario: In-flight donations do not affect the rate

- GIVEN organizacion X has the history above plus 2 donaciones currently `EN_CAMINO`
- WHEN its compliance rate is computed
- THEN the 2 `EN_CAMINO` donaciones are excluded from both numerator and denominator — the rate
  remains 8/9

### Requirement: Neutral Prior for Organizaciones Without History

The system MUST assign a neutral prior compliance value to an organizacion with zero resolved
donaciones, so a new organizacion is neither penalized nor unduly favored relative to
organizaciones with an established track record. By default the prior is the average compliance
rate of the organizaciones with history in the same ronda; the ronda input MAY override it with an
explicit value (`parametros.cumplimientoPrior`).

#### Scenario: New organizacion gets the neutral prior

- GIVEN an organizacion with zero `ENTREGADA`/`RECHAZADA` donaciones
- WHEN its compliance signal is computed for a ronda
- THEN it receives the average rate of the ronda's organizaciones with history, not zero and not a
  perfect score

#### Scenario: Prior is configurable

- GIVEN the ronda input sets `parametros.cumplimientoPrior`
- WHEN a new organizacion's compliance signal is computed
- THEN the overridden value is used, with no code change required

### Requirement: Weight Renormalization

The system MUST renormalize `Pesos` (`scoring.go`) when the compliance term is added, so the five
weighted terms (deficit, urgencia, proximidad, espera, cumplimiento) remain readable as
contributing to a bounded score, consistent with the existing `PesosPorDefecto` convention of
weights that need not sum to 1 but stay normalized for readability.

#### Scenario: Adding compliance changes existing weights

- GIVEN the current four-term default weights (`0.35/0.30/0.20/0.15`)
- WHEN the compliance term is introduced with its own weight
- THEN the four existing weights are reduced proportionally so the five-term set stays normalized,
  rather than the compliance term being added on top unnormalized

#### Scenario: Setting compliance weight to zero reproduces the old score

- GIVEN the compliance weight is configured to 0
- WHEN a ronda scores a candidate
- THEN the renormalized remaining four weights reduce to exactly the pre-change
  `PesosPorDefecto` ratios, and the total score matches what the four-term formula would have
  produced

### Requirement: Compliance Is a Weighted Term, Not a Hard Filter

The system MUST treat compliance history strictly as one weighted scoring term among several — it
MUST NOT be used to hard-filter (exclude) a candidate the way accreditation level and `acepta()`
category/geography checks do (`Candidato.acepta`, `scoring.go:125-146`). Accreditation remains the
only hard filter; compliance only affects ranking among otherwise-eligible candidates.

#### Scenario: Low-compliance organizacion is still eligible

- GIVEN organizacion X has a compliance rate of 0.2 (mostly cancelled/rejected history) but is
  otherwise accreditation-eligible and geographically in range
- WHEN a ronda scores candidates for a donación
- THEN organizacion X's necesidad is still included as a feasible candidate, scored lower on the
  compliance term but not excluded

#### Scenario: Accreditation ineligibility still hard-filters regardless of compliance

- GIVEN organizacion Y has a perfect compliance rate of 1.0 but its accreditation level does not
  permit the donación's `categoria`
- WHEN a ronda scores candidates
- THEN organizacion Y's necesidad is excluded as infeasible, exactly as `acepta()` already enforces
  today, unaffected by its high compliance score
