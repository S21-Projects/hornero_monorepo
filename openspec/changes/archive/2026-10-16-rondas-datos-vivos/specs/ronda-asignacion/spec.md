# Delta for Ronda Asignacion

## ADDED Requirements

### Requirement: Factory Supplies Radio and Live Deficit

For every candidate, the MS ronda input factory MUST fill `codigoRadio` (the organizacion's stored
radio, or absent) and `deficit` with its `deficitFuente`, as defined in `ronda-vulnerabilidad-viva`.
The worker MUST honor the supplied value (PROVISTO or NEUTRAL) over any CSV-based resolution. No
schema version bump is required.

#### Scenario: Candidate carries codigoRadio and deficit

- GIVEN a candidate necesidad of an organizacion with a radio and population
- WHEN the ronda input is assembled
- THEN the candidate carries that `codigoRadio`, a computed `deficit`, and `deficitFuente` PROVISTO

### Requirement: Worker Serve Mode Requires No CSV Data

The worker `serve` mode MUST start and solve rondas without any CSV data file present, and the
worker Docker image MUST NOT ship the vulnerability or ReNaCoM CSVs. The `metrics` and `assign` CLI
subcommands MUST keep supporting CSV data for offline batch runs.

#### Scenario: Serve starts and assigns without CSVs

- GIVEN a worker started in `serve` mode with no CSV files available
- WHEN it receives a ronda input whose candidates carry `deficit`
- THEN it starts and returns the assignment result without error

#### Scenario: CLI subcommands still read CSVs

- GIVEN the CSV data files
- WHEN `metrics` or `assign` is run with `--data`
- THEN they work as before
