# go_algorithms_worker

Hornero's geographic metrics and donation-assignment solver. Two of its three subcommands
(`metrics`, `assign`) are deliberately offline/batch jobs; the third (`serve`) is the AD-1 HTTP
entrypoint the MS calls for a ronda.

`metrics` stays a batch job on purpose: census radios do not move and coverage changes slowly, so
it is recomputed on a schedule and the MS only ever reads flat numbers. `serve` is a long-lived
process specifically so RENACOM (and the optional census CSV) load once at startup (AD-2) instead
of once per request — the solver itself (`internal/assign`) is unchanged either way. Keeping the
geospatial work here means the Java MS never grows a PostGIS dependency, which matters on the
Raspberry Pi deployment.

## The dataset

`data/renacom.csv` is the ReNaCoM open dataset — 2730 community comedores and
merenderos registered and validated by the Argentine state, georeferenced by
CONICET/Poblaciones.

- Landing page: <https://ri.conicet.gov.ar/handle/11336/278030>
- Direct CSV (no auth):
  `https://ri.conicet.gov.ar/bitstream/handle/11336/278030/Comedores_y_merenderos__ReNaCoM_.csv?sequence=5&isAllowed=y`

The column that carries the project is **`Código de radio`**: a 9-digit INDEC
census radio code (`PP DDD FF RR` = province, department, fraction, radio),
populated on every row. It is not Censo 2022 vintage, so the worker prefers the
point-in-polygon radio from `data/renacom-radio-2022.csv` (see "Radio vintage" below).

`Tipo de georreferenciación` is the coordinate precision, per the published
data dictionary: 1 georeferenced by RENACOM, 2 precise via Google Maps, 3
precise manual, 4-5 street intersection (somewhere on the block), 6 within 300
metres, 7 could not be located at all, 9 never processed manually. Levels 1-5
are block-accurate or better; `Comedor.PrecisionDudosa()` flags 6 and up — 193
of 2730 rows nationally, 8 of 264 in Córdoba. `internal/geo` only uses levels
1-5 points to resolve the AD-2 `CERCANO` deficit term.

## Commands

```bash
go test ./...

# Coverage per census radio. Without --poblacion it still counts comedores,
# but leaves the deficit at zero.
go run . metrics --provincia "Córdoba" --top 20
go run . metrics --poblacion data/poblacion-radios.csv --json

# One allocation round, offline — reads/writes the same contract `serve` answers over HTTP
# (see contract/ronda-v1.md). --data/--poblacion resolve AD-2 the same way `serve` does.
go run . assign --input testdata/ronda-v1/request.json

# The AD-1 HTTP entrypoint: POST /v1/ronda, GET /healthz. This is what
# docker-compose.yml's `worker` service runs; --poblacion is the same
# optional census CSV as above (AD-2's documented NEUTRAL fallback applies
# equally here when it is not mounted).
go run . serve --addr :8090 --data data/renacom.csv [--poblacion data/poblacion-radios.csv] [--provincia "Córdoba"]
```

`serve` has no host port in `docker-compose.yml` on purpose (AD-1): only the MS reaches it, over
the compose network at `http://worker:8090`. The MS does not `depends_on` it — the MS boots fine
with the worker down, only `POST /api/rondas` answers `503 WORKER_NO_DISPONIBLE` while it is.

`--poblacion` expects a CSV with headers `codigo_radio,habitantes,hogares`
(hogares optional). `data/poblacion-radios.csv` is committed: Censo 2022 population
per radio (66,502 radios, INDEC; cartography by Rodriguez & de Grande/CONICET,
CC-BY-4.0). `hogares` is empty because the source has no households column.

Regenerate it with `make mapa-datos` (needs the `duckdb` CLI; see `scripts/mapa/README.md`).

**Radio vintage.** ReNaCoM's declared `Código de radio` is not Censo 2022 vintage: it
matches the radio containing the point in only ~22% of rows, so joining it to the 2022
population would attach the wrong figures. `make mapa-datos` also writes
`data/renacom-radio-2022.csv` (`identificador,codigo_radio_2022`) by point-in-polygon.
When that file sits next to `renacom.csv`, `renacom.Cargar` uses it instead of the
declared code (matched by `Identificador`); without it the declared code is kept.

## The metric

Counting comedores per area says nothing on its own: 108 comedores in a dense,
poor radio and 108 in a wealthy one mean opposite things. The figure that
carries signal is coverage:

```
habitantesPorComedor = habitantes(radio) / comedores(radio)
deficit              = habitantesPorComedor / mediana(ciudad)
```

`deficit` is a ratio against the median, so it stays comparable between cities
of different sizes. 1.0 is typical, 2.0 is twice as underserved.

## The assignment

A donor can either pick a necesidad directly, or hand the donation to Hornero
to distribute. Only the second kind reaches this worker. A direct donation is
already assigned and must never be re-routed.

Donations are **indivisible**: one donation goes whole to one necesidad, and a
necesidad is filled by at most one donation per round.

The candidate is the **necesidad, not the organizacion**. Scoring the
organizacion would produce a ranking rather than an allocation — the same
well-rated comedor would win every donation, including goods it never asked
for. Keying on the necesidad also lets one organizacion receive two donations
in a round when it has two distinct open necesidades.

That one-per-necesidad constraint is the entire reason this is an assignment
problem. If a necesidad could absorb any number of donations, each donation
would simply pick its own best candidate and nothing would be coupled. Because
a necesidad taken by one donation is denied to every other, the round's optimum
is not the sum of the individual optima — so the round is solved as a whole
with the Hungarian (Kuhn-Munkres) algorithm, Jonker-Volgenant variant, O(n²m).

Each pair is scored in `[0, 1]`:

```
score = 0.35*deficit + 0.30*urgencia + 0.20*proximidad + 0.15*espera
```

Every term is normalized before weighting — kilometres, ratios and days live
on different scales, and skipping that step is the usual reason a weighted
score behaves nothing like its weights suggest. Proximity decays exponentially
rather than linearly, so a distant comedor in a starved radio can still win.

`espera` is the anti-starvation term: it grows with days since the
organizacion's last donation and saturates at 90. A comedor that keeps losing
on the other three terms climbs on its own until it wins. It is deterministic
rather than randomized on purpose — on a donation platform, being able to
explain why a donation went where it went is worth more than squeezing out the
last bit of optimality.

**`espera` must count direct donations too**, even though those never pass
through this solver. An organizacion with many direct donors would otherwise
look starved to the algorithm and be prioritized in the pool as well,
collecting from both channels at once — the opposite of what the term exists
to enforce.

Category mismatches and candidates beyond `distanciaMaximaKm` are hard
filters, not penalties: they can never be matched.

### Explaining a result

Hungarian buys optimality at the cost of local explainability. An individual
allocation can score lower than another option that was free, because some
other donation needed that option more. "It had the highest score" is
therefore not always the reason.

Each `Asignacion` carries `costoOportunidad` for exactly this: the best score
that donation could have had alone, minus what it actually got. Zero means the
round agreed with the greedy pick; a positive value is the measurable amount
the round asked this donation to give up, and the number to quote when someone
asks why.

Solver correctness is pinned by `internal/assign/hungarian_test.go`, which
checks 200 random matrices against a brute-force oracle.
