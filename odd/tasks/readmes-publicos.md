# Feature: readmes-publicos

Engram mirror: `odd/readmes-publicos/tasks` (project hornero_monorepo).

## Objective

Make the repository readable for the thesis committee before it is made public: accurate READMEs
and repository instructions, and a check of what becomes exposed when the history is public.

## Why

The root README is from 2026-10 and omits the Go worker, the demo stack and `docs/tfg/`. The BFF,
admin and Astro READMEs are framework boilerplate, and the MS has none. Making the repo public
exposes the whole git history, and the gitleaks findings were never reviewed.

## Scope

- In: root `README.md` (Spanish, neutral register); service READMEs in English (`jar_hornero_ms`
  new, `ts_hornero_bff`, `ts_hornero_admin`, `ts_hornero_astro` rewritten); accuracy refresh of
  `e2e/`, `go_algorithms_worker/`, `scripts/sql/`, `scripts/mapa/`, `bruno/` READMEs; `CLAUDE.md`
  refresh; read-only public-exposure audit.
- Out: changing repository visibility, rewriting history, rotating credentials, code changes,
  `ts_hornero_app` (deprecated).

## Constraints

- Author decision 2026-11-09: root README in Spanish, the rest in English.
- Never read `.env` or `.env.local`. Never print secret values; report path, commit and rule only.
- Every command, port and file path stated must be verified against the Makefile, compose and code.
- TDD: not applicable (documentation only). Checks: structural readback, links and paths resolve,
  commands exist in the Makefile.
- Delivery: work-unit commits on `develop` (author asked to commit directly); no push without asking.

## Tasks

- [x] R1 Root `README.md` in Spanish (delegated writer, 2+ non-trivial files)
- [x] R2 Service READMEs: MS new; BFF, admin, Astro replace boilerplate (same writer)
- [x] R3 Refresh existing READMEs and `CLAUDE.md` for accuracy (same writer)
- [x] R4 Public-exposure audit: gitleaks findings, personal data, internal infra details (delegated read-only)

## Progress

- 2026-11-09: document created; inventory done inline.

## Verification evidence

- R4 (2026-11-09): gitleaks over 461 commits, 9 findings, all placeholders, test fixtures or a template
  badge; no real env file ever committed; nothing to rotate. To review by the author: `entregas_tesis/`
  `.docx` (5.4 MB, not opened), `ana.ong@gmail.com` and `usuario+...@gmail.com` test fixtures, two
  collaborators' commit emails, `common-passwords.txt` holds email-shaped lines from a public list,
  ReNaCoM/INDEC redistribution licence, LICENSE holder is `S21-Projects`.

## Next step

Author reviews the R4 items before making the repo public. Push not requested.
