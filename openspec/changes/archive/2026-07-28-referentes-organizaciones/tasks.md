# Tasks: Referente ↔ Organizacion 1:N and Onboarding Repair

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1100-1400 total (MS ~450-550, BFF ~150-200, SPA ~550-700) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 MS → PR2 BFF → PR3 SPA onboarding → PR4 SPA self-service → PR5 SPA admin |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | MS: nullable referente, list-returning repo/services, cap, reassign endpoint, tests | PR 1 | Base: main. Breaking contract change — ships with BFF/SPA in same release train |
| 2 | BFF: proxy new shapes, reassign route, upload.controller fix | PR 2 | Base: PR 1 branch (or main if stacked-to-main) |
| 3 | SPA: onboarding repair (register org step, AuthInitializer, pending-validation) | PR 3 | Base: PR 2 branch |
| 4 | SPA: self-service org creation + needs org selector | PR 4 | Base: PR 3 branch |
| 5 | SPA: admin referente↔org assignment panel | PR 5 | Base: PR 4 branch; independent of Unit 4 logic-wise but shares types/domain.ts |

## Phase 1: MS — Schema & Repository (satisfies referente-organizacion-assignment: nullable referente)

- [x] 1.1 Run `\d organizaciones` on fresh volume (`docker compose down -v && make up`) and existing dev DB; confirm `referente_id` is already nullable (D1)
- [x] 1.2 `domain/Organizacion.java`: make `nullable = true` explicit on `@JoinColumn(referente_id)`
- [x] 1.3 `OrganizacionRepository.java`: add `findByReferente_Id` (List), `findByIdAndReferente_Id`, `countByReferente_IdAndEstadoNot`, `findByReferenteIsNull`

## Phase 2: MS — Service & Controller

- [x] 2.1 `OrganizacionService.java`: `listarPorReferente(Long)` returns `[]` never 404; `crear` cap check (3, excl. RECHAZADA) → 409
- [x] 2.2 `OrganizacionService.java`: add `asignarReferente` (404/400/409 per contract), `listarTodas`
- [x] 2.3 `OrganizacionController.java`: `/mia` returns `List`; `PATCH /{id}/referente`; `GET /todas` (admin) — declared before `/{slug}`
- [x] 2.4 Create `organizacion/dto/AsignarReferenteRequest.java`
- [x] 2.5 `OrganizacionResponse.java`: add nullable `referenteId`
- [x] 2.6 `CrearNecesidadRequest.java`: add `@NotNull organizacionId`
- [x] 2.7 `NecesidadService.java`: `crear` via `findByIdAndReferente_Id`; `checkOwnership` traverses aggregate
- [x] 2.8 `DonacionService.java`: `findDeMisOrganizaciones(referenteId, orgId?)`; `actualizarEstado` traverses aggregate
- [x] 2.9 `DonacionController.java`: `/mi-organizacion` accepts optional `?organizacionId=`
- [x] 2.10 `UsuarioService.java`: inject `OrganizacionRepository`; `toggleActivo(false)` on a `Referente` unassigns all owned orgs in same tx

## Phase 3: MS — Tests (PR 1, satisfies all three specs' MS scenarios)

- [x] 3.1 `OrganizacionServiceTest`: cap enforcement excludes RECHAZADA; `asignarReferente` null/valid/inactive/over-cap
- [x] 3.2 `NecesidadServiceTest`: foreign `organizacionId` → 403; `referente == null` → 403
- [x] 3.3 `DonacionServiceTest`: ownership traversal
- [x] 3.4 `UsuarioServiceTest`: deactivating a Referente unassigns their orgs; other roles untouched
- [x] 3.5 `@SpringBootTest`: boots clean on fresh volume; `GET /organizaciones` with `referente_id IS NULL` returns 200 — verified empirically via `docker compose down -v && up` (see apply-progress; no dedicated `@SpringBootTest` file added, verification done via live boot + curl, deviation noted)

## Phase 4: BFF — Proxy Layer (PR 2)

- [x] 4.1 `organizaciones.service.ts`: `misOrganizaciones` (array), `asignarReferente`, `listarTodas`
- [x] 4.2 `organizaciones.controller.ts`: `GET mia` array; `@Roles(ADMINISTRADOR)` `PATCH :id/referente` + `GET todas`, declared before `@Get(':slug')`
- [x] 4.3 Create `organizaciones/dto/asignar-referente.dto.ts`
- [x] 4.4 `necesidades/dto/crear-necesidad.dto.ts`: add `@IsInt() organizacionId`
- [x] 4.5 **Fix `upload/upload.controller.ts:87-90`**: `assertOwnership` → `orgs.some(o => o.id === orgId)` (breaks silently on array `.id` otherwise)
- [x] 4.6 `donaciones.controller.ts` / `donaciones.service.ts`: forward optional `organizacionId` query param
- [x] 4.7 Jest: `assertOwnership` with array input; reassign forwards Bearer header

## Phase 5: SPA — Onboarding Repair (PR 3, satisfies referente-onboarding)

- [x] 5.1 `types/domain.ts`: `Organizacion` add `estado`, `referenteId?`; `OrganizacionAdmin` referente fields optional
- [x] 5.2 `useMiOrganizacion.ts` → `useMisOrganizaciones` (array, key `['organizaciones','mias']`)
- [x] 5.3 Create `useCrearOrganizacion.ts` (shared registration/self-service)
- [x] 5.4 Create `mapCrearOrganizacionError.ts` (409 → cap message)
- [x] 5.5 `AuthInitializer.tsx`: `orgValidada = orgs.some(o => o.validada)`; `orgChecked` set on success or error
- [x] 5.6 `auth.store.ts`: add `orgCount`
- [x] 5.7 `register.tsx`: `Step` = role/account/org/done/org-error; org step + retry (UX reference: deprecated `ts_hornero_app/src/app/register/page.tsx:417-606`)
- [x] 5.8 `pending-validation.tsx`: `orgCount === 0` → resumable "Crear tu organización" CTA (routes to `/mis-organizaciones`)
- [x] 5.9 Vitest: `mapCrearOrganizacionError`; `AuthInitializer` for `[]`/all-PENDIENTE/one-APROBADA; register `org-error` retry

## Phase 6: SPA — Self-Service & Needs Wiring (PR 4)

- [x] 6.1 Create `routes/mis-organizaciones.tsx`: list own orgs, "Agregar organización" disabled at 3
- [x] 6.2 `routes/needs.tsx`: org selector when referente owns >1 org; pass `organizacionId` to `useCrearNecesidad`

## Phase 7: SPA — Admin Assignment Panel (PR 5, satisfies admin-referente-management)

- [x] 7.1 Create `useTodasOrganizaciones.ts`
- [x] 7.2 Create `useAsignarReferente.ts` (invalidates `organizaciones` + `usuarios`)
- [x] 7.3 Create `routes/referentes.tsx`: join `/usuarios` (REFERENTE) with `/organizaciones/todas`; "Sin referente" bucket; reassign action
- [x] 7.4 `app/router.tsx`: `/referentes` in ADMINISTRADOR group; `/mis-organizaciones` in REFERENTE group without `requireValidated`
- [x] 7.5 `app/AppShell.tsx`: nav entries for both new routes

## Phase 8: Regression & Verification

- [ ] 8.1 Astro regression test: `GET /organizaciones` renders unassigned org without `referenteNombre`/`referenteEmail` errors — DEFERRED: `ts_hornero_astro` has no test runner configured at all (no `test` script, no vitest/playwright in package.json). Adding one is out of scope for an SPA-focused apply batch; the underlying behavior was already verified analytically in design.md (D-notes: `listarValidadas` filters on `estado` only, `toResponse` null-guards `getReferente()`, Astro's `Org` type already has `referenteNombre?`/`referenteEmail?` optional, `org/[slug].astro:151` renders conditionally) but not re-verified empirically this batch.
- [x] 8.2 Regression check: `mia`, `pendientes`, `todas` remain unreachable as `{slug}` on `GET /api/organizaciones/{slug}` — VERIFIED ANALYTICALLY by verify phase: Spring's pattern matcher scores literal patterns above template patterns independent of declaration order, so `/mia`, `/pendientes`, `/todas` always beat `/{slug}`. Additionally `misOrganizaciones` and `listarTodas` carry role guards `{slug}` does not. Structurally safe, archiving closed.
- [x] 8.3 `npm run build` (`tsc -b`) in `ts_hornero_admin` — PASS. `npm test` — 129/129 PASS. `npm run lint` — clean.
