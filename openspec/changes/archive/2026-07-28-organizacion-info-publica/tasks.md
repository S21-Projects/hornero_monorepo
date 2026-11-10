# Tasks: Public Organization Info (donation badge + external links)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1400-1600 (MS ~540, BFF ~210, Astro ~70, SPA ~670) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 MS -> PR2 BFF -> PR3 Astro -> PR4 SPA referente -> PR5 SPA admin |
| Delivery strategy | not yet asked — orchestrator must resolve before apply |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | MS: columns, validator, DTOs, service, controller, tests | PR 1 | Base = main (or `referentes-organizaciones` if unmerged — rebase per proposal risk); largest unit (~540 lines), self-contained and independently deployable |
| 2 | BFF: DTOs, service, controller, tests | PR 2 | Base = PR1 branch/tracker; depends on MS response shape |
| 3 | Astro: types + badge/links rendering | PR 3 | Base = PR2 (or main if BFF already merged); independent of SPA |
| 4 | SPA referente: hooks, `InfoPublicaForm` (referente mode), `mi-organizacion.tsx`, router/nav | PR 4 | Base = PR2; depends on BFF endpoints only |
| 5 | SPA admin: `InfoPublicaForm` (admin mode), `organizaciones.tsx`, approve/reject wiring, nav pending count | PR 5 | Base = PR4 (shares `InfoPublicaForm`) |

## Phase 1: MS — Schema, Validation, Service (jar_hornero_ms)

- [x] 1.1 `domain/Organizacion.java`: add nullable `aceptaDonaciones` (Java default `false`), `sitioWebUrl`, `donacionDirectaUrl` (`@Column(length=500)`), + `*Pendiente` mirrors + `infoPublicaPendienteEn`.
- [x] 1.2 Create `common/validation/UrlSegura.java` + `UrlSeguraValidator.java` per design's Contracts block (null/""/blank/scheme rules).
- [x] 1.3 `dto/CrearOrganizacionRequest.java`, `ActualizarOrganizacionRequest.java`: add 3 fields with `@UrlSegura @Size(max=500)`.
- [x] 1.4 Create `dto/ActualizarInfoPublicaRequest.java` (3 fields, admin body).
- [x] 1.5 `dto/OrganizacionResponse.java`: append +3 live, +3 `*Pendiente`, +`infoPublicaPendienteEn` at the end (positional `@AllArgsConstructor`); audit every `toResponse()` call site.
- [x] 1.6 `OrganizacionService.java`: `crear` maps live fields (D7); `actualizar` calls `seedPendiente()` then applies onto pending; add `normalizarUrl` helper (""/blank -> NULL).
- [x] 1.7 `OrganizacionService.java`: add `actualizarInfoPublica` (admin, writes live + clears pending), `aprobarInfoPublica` (copy pending->live, null timestamp, 409 if none pending), `rechazarInfoPublica` (clear pending, 409 if none pending).
- [x] 1.8 Split `toResponse` (pending fields nulled, public paths) vs `toResponseAutenticado` (pending populated, owner/admin paths); rewire `listarValidadas`/`findBySlugPublic` vs `listarPorReferente`/`listarTodas`/`listarPendientes`/`findBySlug`(owner|admin). Deviation: `findBySlug`'s APROBADA branch also checks isAdmin/isOwner before choosing the mapper (not a blanket toResponseAutenticado) so an arbitrary authenticated donante viewing an approved org never sees another org's pending edit — stricter reading of D6, same intent.
- [x] 1.9 `OrganizacionController.java`: add `PATCH /{id}/info-publica`, `/aprobar`, `/rechazar` with `@PreAuthorize("hasRole('ADMINISTRADOR')")`.
- [x] 1.10 Unit tests: `UrlSeguraValidatorTest` (scheme allowlist, blank, length); `OrganizacionServiceTest` additions (snapshot seeding idempotency, `""`->NULL, aprobar/rechazar incl. 409, toResponse vs toResponseAutenticado). 54 MS tests total, all green.
- [x] 1.11 Boot verification: fresh `docker compose --env-file .env.local up -d --build postgres ms` against seeded (non-empty) data, inspected `\d organizaciones` — all 7 columns added, `acepta_donaciones`/`sitio_web_url`/etc all `Nullable` with no `NOT NULL` failure (D4 empirically confirmed).

## Phase 2: BFF — Passthrough (ts_hornero_bff/src/organizaciones)

- [x] 2.1 `dto/crear-organizacion.dto.ts`, `dto/actualizar-organizacion.dto.ts`: add 3 optional fields mirroring MS validation.
- [x] 2.2 Create `dto/actualizar-info-publica.dto.ts` (same 3 fields).
- [x] 2.3 `organizaciones.service.ts`: add `actualizarInfoPublica`, `aprobarInfoPublica`, `rechazarInfoPublica` (axios patch + authHeaders).
- [x] 2.4 `organizaciones.controller.ts`: add the 3 routes with `@Roles(Role.ADMINISTRADOR)`.
- [x] 2.5 Jest tests: DTO accepts `''`/rejects `javascript:`; new routes forward Bearer header. 22 BFF tests total, all green.

## Phase 3: Astro — Public Rendering (ts_hornero_astro)

- [x] 3.1 `src/lib/types.ts`: `Org` gains `aceptaDonaciones?`, `sitioWebUrl?`, `donacionDirectaUrl?`.
- [x] 3.2 `src/pages/org/[slug].astro`: hero pill (aceptaDonaciones), "Sobre el comedor" website link, "¿Querés colaborar?" secondary donation link below "Ir a donar" — escaped `<a>`, `rel="noopener noreferrer nofollow"`, `target="_blank"`.
- [x] 3.3 `src/components/islands/OrgList.tsx`, `HomeMapExplorer.tsx`: badge-only pill, no links, card stays single anchor.
- [x] 3.4 Manual check: org with all 3 fields unset renders byte-identical to pre-change (conditional rendering guards verified by code review — no unconditional badge/link markup added).
- [x] 3.5 `npm run build` (tsc) in `ts_hornero_astro` to compile-check the widened `Org` type — build succeeds.

## Phase 4: SPA — Referente Self-Edit (ts_hornero_admin)

- [x] 4.1 Checked tree state: `referentes-organizaciones` SPA slice (uncommitted in working tree) already provides `useMisOrganizaciones`, `useTodasOrganizaciones`, `useAsignarReferente`, `routes/referentes.tsx`, `routes/mis-organizaciones.tsx`, `domain.ts` `estado`/`referenteId` — reused all of it, created nothing duplicate.
- [x] 4.2 `src/types/domain.ts`: added `InfoPublica`/`InfoPublicaPendiente` interfaces; `Organizacion`/`OrganizacionAdmin` now extend both.
- [x] 4.3 `useMisOrganizaciones.ts` already present from `referentes-organizaciones` — no action needed.
- [x] 4.4 Created `src/lib/hooks/useActualizarInfoPublica.ts` (referente mutation, `PATCH /organizaciones/{id}`).
- [x] 4.5 Created `src/lib/hooks/mapInfoPublicaError.ts` (400/403/409 messages).
- [x] 4.6 Created `src/components/org/InfoPublicaForm.tsx` referente mode: pending-snapshot pre-fill, `Badge tone="sky"` "Cambios pendientes de aprobación" (no `warn` tone exists in this codebase's `Badge` — used `sky`), muted "Actualmente público" line, post-submit note.
- [x] 4.7 DEVIATION (documented, not a gap): did NOT create `src/routes/mi-organizacion.tsx`. `routes/mis-organizaciones.tsx` already exists (plural, from `referentes-organizaciones`) and is the real "my orgs" screen; embedded `InfoPublicaForm mode="referente"` as a collapsible "Editar info pública" section per org card there instead of building a redundant singular route. No router/AppShell changes needed — the route and nav entry already exist.
- [x] 4.8 Vitest + RTL (`InfoPublicaForm.test.tsx`): referente mode with no pending renders live values, no badge; referente mode with pending renders the badge and pre-fills from the snapshot plus the "Actualmente público" line.

## Phase 5: SPA — Admin Edit & Approval (ts_hornero_admin)

- [x] 5.1 Created `src/lib/hooks/useAdminInfoPublica.ts` (actualizar/aprobar/rechazar; all invalidate `['organizaciones']`).
- [x] 5.2 `useTodasOrganizaciones.ts` already present from `referentes-organizaciones` — no action needed.
- [x] 5.3 `InfoPublicaForm.tsx` admin mode: writes live immediately via `useAdminInfoPublica().actualizar`, no pending badge ever rendered in this mode regardless of `infoPublicaPendienteEn`.
- [x] 5.4 DEVIATION (documented, per design D8's own risk callout): did NOT create `src/routes/organizaciones.tsx`. `routes/referentes.tsx` already exists (from `referentes-organizaciones`, uncommitted) and already lists every org via `GET /organizaciones/todas` grouped by referente — extended its `OrgRow` with an "Editar info pública" toggle (`InfoPublicaForm mode="admin"`) plus Aprobar/Rechazar buttons shown when `infoPublicaPendienteEn != null`, instead of building a second, largely-redundant admin org-listing screen.
- [x] 5.5 No router/AppShell changes needed — `/referentes` route and nav entry already exist and now carry both features. Added an inline `Badge tone="sky"` "Info pública pendiente" marker per row instead of a nav-level pending count (no existing nav-badge affordance in `AppShell.tsx` to hook into without a larger nav redesign, out of this change's scope).
- [x] 5.6 Vitest + RTL: `InfoPublicaForm.test.tsx` admin mode never shows the pending badge even when `infoPublicaPendienteEn` is set; `useAdminInfoPublica.test.tsx` covers actualizar/aprobar/rechazar hitting the right endpoints plus a 409 on aprobar; `mapInfoPublicaError.test.ts` covers 400/403/409/500/generic.
- [x] 5.7 `npm run build` (`tsc -b` + vite build) in `ts_hornero_admin` — succeeds. Fixed 4 pre-existing test fixtures (`AuthInitializer.test.tsx`, `deriveAdminSummary.test.ts`, `admin.test.tsx`, `dashboard.test.tsx`) that needed `aceptaDonaciones` added to satisfy the now-required `InfoPublica` field. Full suite: 143/143 tests green.

## Phase 6: Cross-cutting Verification

- [x] 6.1 Rebase order vs `referentes-organizaciones`: discovered mid-apply that the entire `referentes-organizaciones` change (MS+BFF+SPA) was sitting **uncommitted** in the working tree (not yet merged), not just the MS+BFF slices the design baseline described. Recovered from an incident where `git stash` briefly reverted then successfully restored it — see engram memory "Incident: git stash accidentally captured uncommitted referentes-organizaciones work" for full detail. Final state: both changes coexist cleanly in the same uncommitted working tree, no overlapping touched lines, all touched files' full test suites green (MS 69, BFF 22, SPA 143).
- [x] 6.2 Success criteria from proposal.md re-checked end-to-end: set/edit/clear via referente form (MS pending-snapshot tests + SPA form tests) — done; 400 on non-http(s) schemes incl. `javascript:`/`data:` (validator tests) — done; `""` clears to NULL, omitted field unchanged (MS tests) — done; org with no values set renders unchanged (conditional guards in Astro/SPA, no unconditional markup added) — done; `/org/{slug}` escaped `<a>` with `rel="noopener noreferrer nofollow"` + `target="_blank"` — done; org cards show badge only, stay single-anchor — done; "Ir a donar" stays primary CTA, donation-directa link is secondary below it — done.
