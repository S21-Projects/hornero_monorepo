# Tasks: Tesis Core Features

Source of truth for slice order and dependencies: `proposal.md` §"Delivery order" and `design.md`
§"Technical Approach" / AD-5 (slice 3 lands before slice 5 because both touch
`TRANSICIONES_PERMITIDAS`). Task IDs mirror the proposal's slice names (`1`, `2`, `3a`…`3c`,
`4a`…`4b`, `5a`…`5f`, `6a`…`6b`) plus a closing documentation slice `7`.

HARD constraint: the agent never commits, pushes, or opens PRs. Every slice ends with a
`USER COMMIT POINT` naming the suggested Conventional Commit message(s) for the user to run.

## Review Workload Forecast

| Slice | Estimated changed lines (incl. tests) |
|---|---|
| 1 | 250–350 |
| 2 | 350–400 |
| 3a | 350–450 |
| 3b | 150–250 |
| 3c | 400–500 |
| 4a | 300–400 |
| 4b | 300–400 |
| 5a | 200–300 |
| 5b | 350–450 |
| 5c | 400–500 |
| 5d | 250–350 |
| 5e | 300–400 |
| 5f | 350–450 |
| 6a | 150–250 |
| 6b | 150–250 |
| 7 (docs) | ~50–100 (docs only, no source) |
| **Total** | **≈ 4,050–5,550** |

400-line budget risk: High
Chained PRs recommended: Yes
Decision needed before apply: Yes
Chain strategy: pending

Delivery strategy received: `ask-on-risk`. Per the guard, the orchestrator MUST ask the user to pick
`stacked-to-main` or `feature-branch-chain` before `sdd-apply` starts any slice at or near the
400-line edge. Slices 1, 2, 3a, 4a have no mutual dependency and MAY be reordered or run in
parallel work units if the user wants faster iteration; 3b→3c and 5a→5b→5c→5d→5e/5f and 6a→6b are
strictly sequential.

### Slices at risk of exceeding 400 lines — proposed sub-splits

| Slice | Risk | Proposed sub-split (still one proposal slice; becomes 2 PRs in the chain) |
|---|---|---|
| 3c | High (400–500) | **3c-i**: QR/scan adapter + presentational components + hooks (`escanearQr.ts`, `payload.ts`, `CodigoQr`, `EscanerQr`, `CodigoInput`, `EstadoConfirmacion`, `Countdown`, `useEntrega.ts`) — no wiring yet. **3c-ii**: route wiring, old button/endpoint removal in admin+BFF+MS, package.json deps. Both must land before the Pi deploy that retires the old endpoint (they may still be separate reviewable PRs merged back-to-back). |
| 5c | High (400–500) | **5c-i**: `Ronda`, `Asignacion` entities + repositories + `RondaService` core (candidate query, input derivations, write transaction). **5c-ii**: `AsignadorClient`, `HttpAsignadorClient`/config, `RondaController`, `AsignacionController`, `SecurityConfig` wiring, `DonacionService` vigente-asignación resolution. |
| 5f | Medium-High (350–450) | **5f-i**: `donacion-detalle.tsx` + `ProgresoDonacion`, `DesgloseScore` + `useAsignaciones.ts`. **5f-ii**: `rondas.tsx` admin screen + `useRondas.ts` + router/nav wiring + `mis-donaciones.tsx` modalidad badge. |

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|------------------|-------------------|
| 1 | Bienvenida onboarding step | PR 1 | `npm test -- register` (admin) | Manual: register a referente on `make up-local`, confirm Bienvenida shows after org success | Revert admin commit; no API/data touched |
| 2 | Evidence files bound to a row, SPA rendering | PR 2 | `mvn test -Dtest=AcreditacionControllerTest`, `npm test -- evidencia-files` (bff), `npm test -- EvidenciaArchivo` (admin) | Manual: view an evidence photo as owning referente and as admin on `make up-local` | Revert MS+BFF+admin together; old ownership-only check is gone, but no data written |
| 3a | Delivery code backend (MS) | PR 3 | `mvn test -Dtest=EntregaServiceTest,TransicionesDonacionTest` | N/A — pure backend unit/integration tests are the harness; old button still calls the untouched `confirmar-entrega` endpoint | Revert MS commit; `codigos_entrega` table orphan-safe |
| 3b | Delivery code BFF proxy | PR 4 | `npm test -- donaciones.controller` (bff) | N/A — unused until 3c wires the screen | Revert BFF commit |
| 3c-i | QR/scan client library | PR 5 | `npm test -- escanearQr` (admin) | Manual: scan a real QR with the adapter mocked in tests, real camera check deferred to 3c-ii | Revert; components unused, no wiring yet |
| 3c-ii | Confirmation screen wired, old button retired | PR 6 | `npm test -- entrega` (admin), `mvn test -Dtest=DonacionControllerTest` (confirmar-entrega removed) | Manual end-to-end on `make up-local`: create donación → accept → generate/scan codes both ways → `ENTREGADA` | Redeploy previous images; `PENDIENTE_CONFIRMACION` donations complete via the restored button |
| 4a | Cross-org audit queue backend | PR 7 | `mvn test -Dtest=AuditoriaControllerTest`, `npm test -- acreditacion` (bff) | N/A — read-only endpoint, no screen yet | Revert MS+BFF; read-only |
| 4b | Cross-org audit queue screen | PR 8 | `npm test -- auditoria` (admin) | Manual: filter/paginate/approve from the queue on `make up-local` | Revert admin commit |
| 5a | Worker contract + HTTP entrypoint | PR 9 | `go test ./...` | Manual: `curl` the worker's /healthz and /v1/ronda with a golden fixture once `docker compose up worker` | Remove the `worker` compose service; unused until 5c |
| 5b | Pool schema + null safety | PR 10 | `mvn test -Dtest=DonacionServiceTest,DonacionRepositoryTest` | **USER ACTION**: run `V001` on the Pi before deploy (see slice below) | Redeploy previous MS; relaxed `NOT NULL` harmless while no pool donation exists |
| 5c-i / 5c-ii | Asignación persistence + ronda trigger | PR 11 / PR 12 | `mvn test -Dtest=RondaServiceTest,AsignacionControllerTest` | Manual: trigger a ronda against the real worker on `make up-local` | Revert; `rondas`, `asignaciones` tables orphan-safe |
| 5d | BFF for modalidad + rondas | PR 13 | `npm test -- rondas` (bff) | N/A — no screen yet | Revert BFF commit |
| 5e | Nueva donación screen | PR 14 | `npm test -- nueva-donacion` (admin) | Manual: submit a `FONDO_COMUN` donación on `make up-local` | Revert admin commit |
| 5f-i / 5f-ii | Progress/detail + admin ronda screen | PR 15 / PR 16 | `npm test -- donacion-detalle,rondas` (admin) | Manual: full pool lifecycle on `make up-local` | Revert admin commit |
| 6a | Worker compliance term | PR 17 | `go test ./...` | N/A — pure unit tests | Revert; `pesos.cumplimiento` optional and defaults to reproducing today's score |
| 6b | MS compliance signal | PR 18 | `mvn test -Dtest=CumplimientoCalculatorTest` | Manual: verify the 5th criterion appears in a ronda breakdown on `make up-local` | Set weight to 0 or revert |
| 7 | Thesis documentation updates | PR 19 | N/A (docs only) | N/A | Revert docs commit |

## Slice 1 — Bienvenida register step (admin)

Depends on: none. Spec: `referente-onboarding`.

- [x] 1.1 RED — Add failing assertions to `ts_hornero_admin/src/routes/register.test.tsx`: after
      successful `Organización` step submission for a REFERENTE, a 3rd step "Acreditación" renders;
      the step indicator shows 3 steps for REFERENTE and 2 for DONANTE; the existing `org-error`
      retry path is unaffected.
- [x] 1.2 RED — Add `ts_hornero_admin/src/components/acreditacion/BienvenidaAcreditacion.test.tsx`:
      renders the N0..N3 ladder copy, shows the current level via a mocked `useAcreditacion(orgId)`,
      and the CTA "Empezar con N1" fires a navigation callback.
- [x] 1.3 RED — Add assertions to `ts_hornero_admin/src/app/ProtectedRoute.test.tsx`: the
      `requireVerified` redirect includes `state={{ from: location.pathname }}`.
- [x] 1.4 RED — Add assertions to the existing verify-email test: after successful verification,
      navigation goes to `state.from` when it is an internal path, else `roleHome`.
      (Deviation: no `verify-email.test.tsx` existed; created it new since the file was missing.)
- [x] 1.5 GREEN — Create `ts_hornero_admin/src/components/acreditacion/BienvenidaAcreditacion.tsx`
      (presentational, N0..N3 ladder + CTA) to satisfy 1.2.
- [x] 1.6 GREEN — Create/modify `ts_hornero_admin/src/lib/acreditacion.ts` (or existing constants
      module) with the static per-nivel ladder copy consumed by 1.5.
- [x] 1.7 GREEN — Modify `ts_hornero_admin/src/routes/register.tsx`: add `Step 'acreditacion'` after
      successful org creation for REFERENTE only; render `BienvenidaAcreditacion`; step indicator
      updated; donante flow untouched. Satisfies 1.1.
- [x] 1.8 GREEN — Modify `ts_hornero_admin/src/app/ProtectedRoute.tsx`: pass
      `state={{ from: location.pathname }}` on the `requireVerified` redirect. Satisfies 1.3.
- [x] 1.9 GREEN — Modify `ts_hornero_admin/src/routes/verify-email.tsx`: navigate to `state.from`
      when internal, else `roleHome`. Satisfies 1.4.
- [x] 1.10 REFACTOR — Confirm no duplicated ladder copy exists elsewhere (e.g.
      `acreditacion.tsx`); extract only if genuinely duplicated.
      (Confirmed: `NivelBadge.tsx` only has short N0-N3 labels, not the full ladder descriptions —
      no extraction needed.)

**Verification (slice 1):** `cd ts_hornero_admin && npm test && npm run build`

**USER COMMIT POINT**: `feat(admin): add bienvenida onboarding step after org creation`

## Slice 2 — Evidence files bound to an evidence row (MS + BFF + admin)

Depends on: none. Spec: `organizacion-evidencia`. Design: AD-12. Natural cut if it overruns:
2a (MS+BFF row binding) / 2b (admin rendering) — kept as one slice unless the diff proves larger
than estimated.

- [x] 2.1 RED — `jar_hornero_ms/src/test/java/org/example/domain/OrganizacionEvidenciaRepositoryTest.java`:
      `existsByOrganizacion_IdAndObjectKey` true for the org's own row, false for the same key under
      another org, false for an unknown key; the existing append-only reflection assertion
      (`delete*`, `saveAndFlush` forbidden) still passes.
- [x] 2.2 RED — New/modified MS controller test (`AcreditacionControllerTest` or a new
      `EvidenciaArchivoTest`): `GET /acreditacion/evidencias/archivo?objectKey=` → 204 for a matching
      row (owning referente and admin); 404 `EVIDENCIA_NO_ENCONTRADA` for a valid key with no row
      (owning referente and admin); 403 for a non-owning referente checked *before* the row lookup
      (no existence oracle); 403 for DONANTE; 401/403 for anonymous; 400
      `EVIDENCIA_CLAVE_INVALIDA` for a foreign prefix, `..`, or extra `, `.
- [x] 2.3 RED — `jar_hornero_ms/src/test/.../acreditacion/AcreditacionServiceTest.java`:
      `existeArchivoEvidencia(orgId, objectKey)` unit-level behavior backing 2.2 (prefix/traversal
      validation, row lookup).
- [x] 2.4 GREEN — `jar_hornero_ms/.../domain/OrganizacionEvidenciaRepository.java`: add the
      `existsByOrganizacion_IdAndObjectKey(Long, String)` read-only finder. Satisfies 2.1.
- [x] 2.5 GREEN — `jar_hornero_ms/.../acreditacion/AcreditacionService.java`: add
      `existeArchivoEvidencia(orgId, objectKey)` (400 on bad prefix/traversal, 404 on no row).
      Satisfies 2.3.
- [x] 2.6 GREEN — `jar_hornero_ms/.../acreditacion/AcreditacionController.java`: add
      `GET /acreditacion/evidencias/archivo?objectKey=` with `@PreAuthorize` for
      ADMINISTRADOR/REFERENTE + `requireAdminOrOwningReferente`. Satisfies 2.2.
- [x] 2.7 GREEN — `jar_hornero_ms/.../acreditacion/dto/EvidenciaResponse.java`: add `objectKey`
      (additive field).
- [x] 2.8 RED — `ts_hornero_bff/src/evidencia-files/evidencia-files.controller.spec.ts`: MS 204 ⇒
      streams the object with its content type (200); MS 404 ⇒ `NotFoundException`, `getObject`
      never called; MS 403 ⇒ `ForbiddenException`, `getObject` never called; admin also goes through
      the MS check (no bypass); `misOrganizaciones` no longer called.
- [x] 2.9 RED — `ts_hornero_bff/src/acreditacion/acreditacion.service.spec.ts`: new
      `verificarArchivoEvidencia(orgId, objectKey, token)` forwards Bearer from the cookie, sends
      the raw (unencoded) `objectKey` and lets the controller URL-encode; relays MS 400/403/404.
- [x] 2.10 GREEN — `ts_hornero_bff/src/acreditacion/acreditacion.service.ts`: implement
      `verificarArchivoEvidencia`. Satisfies 2.9.
- [x] 2.11 GREEN — `ts_hornero_bff/src/acreditacion/acreditacion.module.ts`: `exports:
      [AcreditacionService]`.
- [x] 2.12 GREEN — `ts_hornero_bff/src/evidencia-files/evidencia-files.controller.ts`: replace
      `assertOwnership`, `misOrganizaciones` with `verificarArchivoEvidencia` for every role before
      `getObject`. Satisfies 2.8.
- [x] 2.13 GREEN — `ts_hornero_bff/src/evidencia-files/evidencia-files.module.ts`: import
      `AcreditacionModule` instead of `OrganizacionesModule`.
- [x] 2.14 GREEN — `ts_hornero_bff/src/images/images.controller.ts`: comment-only change — deny-list
      documented as defense-in-depth, `evidencia-files` is the supported path. Remove the stale
      "until Slice B ships" comment (lines 14-20).
- [x] 2.15 RED — `ts_hornero_admin/src/lib/evidenciaArchivo.test.ts` (new file, colocated with
      2.16): the strict parser rejects foreign prefixes, path traversal, and an orgId mismatch, and
      accepts a well-formed `org-evidencia/{orgId}/{filename}` key.
- [x] 2.16 GREEN — `ts_hornero_admin/src/lib/evidenciaArchivo.ts`: create the parser
      (`^org-evidencia/(\d+)/([^/]+)$`, orgId must equal `evidencia.organizacionId`). Satisfies 2.15.
- [x] 2.17 RED — `ts_hornero_admin/src/lib/hooks/useEvidenciaArchivo.test.ts`: axios blob fetch,
      revokes the object URL on unmount, maps both 403 and 404 to an "unavailable" result.
- [x] 2.18 GREEN — `ts_hornero_admin/src/lib/hooks/useEvidenciaArchivo.ts`: implement the hook.
      Satisfies 2.17.
- [x] 2.19 RED — `ts_hornero_admin/src/components/acreditacion/EvidenciaArchivo.test.tsx`: renders
      `<img>` for `image/*`, an "Abrir documento" link otherwise, and "Archivo no disponible" when
      the hook reports unavailable.
- [x] 2.20 GREEN — `ts_hornero_admin/src/components/acreditacion/EvidenciaArchivo.tsx`: implement.
      Satisfies 2.19.
- [x] 2.21 GREEN — `ts_hornero_admin/src/types/domain.ts`: add `objectKey?: string | null` on
      evidencia types; remove the stale "until Slice B" comment (lines 161-167).
- [x] 2.22 GREEN — Modify `ts_hornero_admin/src/components/acreditacion/AuditQueue.tsx`,
      `ts_hornero_admin/src/routes/legajo.tsx`, `ts_hornero_admin/src/routes/acreditacion.tsx`:
      render `EvidenciaArchivo` for FOTO/DOCUMENTO rows instead of any direct `img`/link.
      `AuditQueue.tsx` and `legajo.tsx` done in this slice. `acreditacion.tsx` (the referente's own
      view) completed by task 2.24 below, once `RequisitoEnLegajo` carried `objectKey`.
- [x] 2.23 REFACTOR — Grep the admin source tree for any remaining `images?key=`-style construction
      of an evidence URL outside `evidenciaArchivo.ts`, `useEvidenciaArchivo.ts`; there should be
      none besides the unrelated `OrgImagesEditor.tsx` public-image flow.
- [x] 2.24 GREEN (corrective, follow-up to 2.22) — Add `objectKey` (nullable) to the MS
      `RequisitoEnLegajo` DTO and populate it from `OrganizacionEvidencia.getObjectKey()` in
      `AcreditacionService.legajo()`. No BFF DTO change needed (the BFF's `/legajo` passthrough is
      untyped). Add `objectKey?: string | null` to the admin `RequisitoEnLegajo` domain type. Render
      `EvidenciaArchivo` in `acreditacion.tsx`'s `RequisitoRow` for FOTO/DOCUMENTO requisitos with a
      known `objectKey`. The `/legajo` MS endpoint stays ADMINISTRADOR/owning-REFERENTE only
      (`@PreAuthorize` + `requireAdminOrOwningReferente`, unchanged) — `objectKey` is never exposed
      on a public endpoint. Satisfies the spec scenario "SPA renders evidence via the authenticated
      route in the referente's own view".
      RED: `AcreditacionServiceLegajoTest` (2 new cases: FOTO evidence carries `objectKey`,
      DECLARACION evidence has `objectKey: null`) — compile failure (`objectKey()` didn't exist).
      `acreditacion.test.tsx` (new, 4 cases: FOTO/DOCUMENTO render `EvidenciaArchivo`, DECLARACION
      and FALTANTE-with-no-key don't) — 2/4 failing (testid not found).
      GREEN: MS 267/267 (full suite), admin 225/225 (full suite), `npm run build` and `npm run lint`
      clean. BFF unaffected (105/105, no BFF files touched).

**Verification (slice 2):**
`cd jar_hornero_ms && mvn test -Dtest=AcreditacionControllerTest,AcreditacionServiceTest,OrganizacionEvidenciaRepositoryTest`
`cd ts_hornero_bff && npm test -- evidencia-files acreditacion`
`cd ts_hornero_admin && npm test && npm run build`

**USER COMMIT POINT**: `feat(evidencia): bind authenticated evidence-file access to an existing row`

## Slice 3a — Delivery code backend (MS)

Depends on: none (lands before slice 5 per AD-5). Spec: `donacion-entrega-codigo`.

- [x] 3a.1 RED — `jar_hornero_ms/src/test/.../donacion/TransicionesDonacionTest.java`: the
      full transition matrix from AD-5's table, including the new
      `ACEPTADA/EN_CAMINO → PENDIENTE_CONFIRMACION → ENTREGADA` entries, `overrideEstado` staying
      outside the table.
- [x] 3a.2 RED — `jar_hornero_ms/src/test/.../donacion/ParticipantesDonacionTest.java`:
      `parteDe(Donacion, Long actorId)` resolves DONANTE/REFERENTE correctly, and returns
      `Optional.empty()` (no NPE) when `necesidad == null`.
- [x] 3a.3 RED — `jar_hornero_ms/src/test/.../donacion/entrega/EntregaServiceTest.java` (Mockito +
      fixed `Clock`, mirroring `OtpServiceTest`): generate hashes + 10-minute TTL; regenerate burns
      the previous unused code immediately; throttle → `429 ESPERA_ANTES_DE_REENVIAR`; generating
      when the counterpart already validated this party's code → `409 YA_CONFIRMADO`; verify: wrong
      party's own code rejected, expired → `410 CODIGO_EXPIRADO` without consuming an attempt, 5th
      wrong attempt burns the code with `429 DEMASIADOS_INTENTOS`, correct code after fewer wrong
      attempts succeeds, success sets the verifier's own confirmation timestamp, first verification
      → `PENDIENTE_CONFIRMACION`, second → `ENTREGADA` + `fechaEntrega`, re-verifying one's own
      already-satisfied side is idempotent 200; non-party → 403; donation with `necesidad == null`
      has no referente party (no NPE, per 3a.2).
- [x] 3a.4 RED — `jar_hornero_ms/src/test/.../donacion/entrega/CodigoEntregaThrottleTest.java`:
      cooldown/window algorithm mirrors `OtpThrottleTest`.
- [x] 3a.5 RED — `jar_hornero_ms/src/test/.../donacion/entrega/EntregaControllerIntegrationTest.java`
      (`@SpringBootTest` + H2, two threads): concurrent double verification ends in `ENTREGADA`
      exactly once (row lock via `PESSIMISTIC_WRITE`), never stuck at
      `PENDIENTE_CONFIRMACION` forever.
- [x] 3a.6 RED — Security test (`@Import(SecurityConfig.class)`): anonymous
      `GET /api/donaciones/{id}/entrega` is denied.
- [x] 3a.7 GREEN — Create `jar_hornero_ms/.../donacion/TransicionesDonacion.java`: static map +
      `validar(ModalidadDonacion, EstadoDonacion desde, EstadoDonacion hacia)`. Satisfies 3a.1.
      **Deviation**: implemented as `validar(EstadoDonacion desde, EstadoDonacion hacia)` — no
      `ModalidadDonacion` parameter. `ModalidadDonacion` doesn't exist yet (it's created in slice
      5b) and none of 3a's table entries are modalidad-dependent (only the 5b-only
      `OFRECIDA→OFRECIDA` devolución and `OFRECIDA→RECHAZADA` DIRECTA-only entries are); adding an
      unused parameter now would be dead code. Documented in the class Javadoc; 5b will add the
      parameter when it has a real modalidad-dependent entry to gate.
- [x] 3a.8 GREEN — Create `jar_hornero_ms/.../donacion/ParticipantesDonacion.java`: null-safe
      `parteDe`. Satisfies 3a.2.
- [x] 3a.9 GREEN — Create `jar_hornero_ms/.../donacion/entrega/CodigoEntrega.java` (entity, table
      `codigos_entrega`) and `CodigoEntregaRepository.java` (`findTopByDonacion_IdAndEmisorParteAndUsadoFalseOrderByCreadoEnDesc`,
      `findByDonacion_IdAndEmisorIdAndUsadoFalse`).
- [x] 3a.10 GREEN — Create `jar_hornero_ms/.../donacion/entrega/CodigoEntregaThrottle.java`: copy of
      the `OtpThrottle` algorithm under `app.entrega.*` config. Satisfies 3a.4.
- [x] 3a.11 GREEN — `jar_hornero_ms/.../domain/DonacionRepository.java`: add `findByIdForUpdate`
      with `@Lock(PESSIMISTIC_WRITE)`. Backs 3a.5.
- [x] 3a.12 GREEN — Create `jar_hornero_ms/.../donacion/entrega/EntregaService.java`: `generar`,
      `verificar`, `estado`, using 3a.7–3a.11. Satisfies 3a.3, 3a.5.
- [x] 3a.13 GREEN — Create `jar_hornero_ms/.../donacion/entrega/dto/CodigoEntregaResponse.java`,
      `VerificarCodigoRequest.java`, `EntregaEstadoResponse.java`.
- [x] 3a.14 GREEN — Create `jar_hornero_ms/.../donacion/entrega/EntregaController.java`: `POST
      codigo`, `POST verificar`, `GET` estado at /api/donaciones/{id}/entrega.
- [x] 3a.15 GREEN — `jar_hornero_ms/.../config/SecurityConfig.java`: declare
      `GET /api/donaciones/*/entrega` `.authenticated()` **before** the existing
      `GET /api/donaciones/**` permitAll matcher. Satisfies 3a.6.
- [x] 3a.16 GREEN — `jar_hornero_ms/src/main/resources/application.yml`: add `app.entrega.*`
      (`ttl-minutes: 10`, `max-attempts: 5`, `generar-max: 5`, `generar-window-minutes: 15`,
      `generar-cooldown-seconds: 30`). Also mirrored into `src/test/resources/application.yml`
      (required for `@SpringBootTest` contexts to resolve the new `${app.entrega.*}` placeholders).
- [x] 3a.17 GREEN — `jar_hornero_ms/.../donacion/DonacionService.java`: switch to
      `TransicionesDonacion` + `ParticipantesDonacion`; extract package-private
      `registrarConfirmacion(d, parte)` shared with `EntregaService`; keep `confirmarEntrega`
      working identically (removed only in 3c). **Deviation**: the shared logic is
      `org.example.donacion.ConfirmacionEntrega.registrar(Donacion, Parte, Clock)` — a top-level
      class in the `donacion` package, not a package-private method on `DonacionService` — because
      `EntregaService` lives in the `donacion.entrega` sub-package and Java package-private
      visibility does not extend to sub-packages. A public static helper on a dedicated class is
      the equivalent single-implementation shape without duplicating the logic in each caller;
      documented in the class Javadoc.
- [x] 3a.18 REFACTOR — Confirm no logic duplication remains between `EntregaService.verificar` and
      the still-present `confirmarEntrega` beyond the shared `registrarConfirmacion`
      (`ConfirmacionEntrega.registrar`) helper. Confirmed by inspection: both call sites are
      one-line delegations to `ConfirmacionEntrega.registrar`; no duplicated transition/timestamp
      logic remains in either.

**Verification (slice 3a):**
`cd jar_hornero_ms && mvn test -Dtest=TransicionesDonacionTest,ParticipantesDonacionTest,EntregaServiceTest,CodigoEntregaThrottleTest,EntregaControllerIntegrationTest`

**USER ACTION (precondition before this slice's endpoints are exercised in production)**:
Verify on the Pi that `donaciones_estado_check` already allows `PENDIENTE_CONFIRMACION`
(`docs/db-changes.md` shows this Pi entry unchecked). Run, backed up first:
```bash
docker compose exec -T postgres psql -U "$DB_USERNAME" -d "$DB_NAME" \
  -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'donaciones_estado_check';"
```
If `PENDIENTE_CONFIRMACION` is missing from the printed definition, do not deploy 3a/3c until the
constraint is widened (see `docs/db-changes.md` for the existing widening precedent). Record the
result back in `docs/db-changes.md`.

**USER COMMIT POINT**: `feat(ms): add mutual delivery-code confirmation backend`

## Slice 3b — Delivery code BFF proxy

Depends on: 3a. Spec: `donacion-entrega-codigo`.

- [x] 3b.1 RED — `ts_hornero_bff/src/donaciones/donaciones.controller.spec.ts`: three new routes
      (`POST :id/entrega/codigo`, `POST :id/entrega/verificar`, `GET :id/entrega`) require
      `@Roles(DONANTE, REFERENTE)` and forward the Bearer token from the cookie.
- [x] 3b.2 RED — `ts_hornero_bff/src/donaciones/donaciones.service.spec.ts`: the three proxy
      methods call the correct MS URL with the Bearer header and relay MS error bodies unchanged.
- [x] 3b.3 RED — `ts_hornero_bff/src/donaciones/dto/verificar-codigo.dto.spec.ts` (or inline
      validation test): `codigo` rejects anything not matching `^\d{6}$` (regex).
- [x] 3b.4 GREEN — Create `ts_hornero_bff/src/donaciones/dto/verificar-codigo.dto.ts`. Satisfies
      3b.3.
- [x] 3b.5 GREEN — `ts_hornero_bff/src/donaciones/donaciones.service.ts`: add the three proxy
      methods. Satisfies 3b.2.
- [x] 3b.6 GREEN — `ts_hornero_bff/src/donaciones/donaciones.controller.ts`: add the three routes.
      Satisfies 3b.1.

**Verification (slice 3b):** `cd ts_hornero_bff && npm test -- donaciones`

**USER COMMIT POINT**: `feat(bff): proxy delivery-code generate/verify/status routes`

## Slice 3c — Confirmation screen, old button retired (admin + BFF + MS)

Depends on: 3b. Spec: `donacion-entrega-codigo`. Sub-split per the forecast: **3c-i** (QR/scan
library, no wiring) then **3c-ii** (screen wiring + retirement). Both land, and are deployed,
together — no intermediate deploy has the screen without the retirement, or vice versa.

### 3c-i — QR/scan client library

- [x] 3c.1 Verify at apply time: confirm `qrcode.react` and `qr-scanner` (nimiq) current versions,
      React 19 peer range, MIT license, and last-release recency; if `qr-scanner` looks unmaintained,
      swap to the `barcode-detector` ponyfill inside the same adapter module with no screen changes
      (AD-7). Record the chosen versions in this checklist item's commit.
      **Verified 2026-09-30**: `qrcode.react@4.2.0` (peer `react: ^16.8.0 || ^17.0.0 || ^18.0.0 ||
      ^19.0.0`, last published 2024-12-11) — kept. `qr-scanner@1.4.2` last published 2022-11-23
      (~4 years stale, no maintenance activity) — judged unmaintained; swapped to the design's
      named fallback `barcode-detector@3.2.2` (last published 2026-08-16, framework-agnostic, no
      React peer needed) per AD-7. Adapter module boundary absorbs the swap with no component
      changes.
- [x] 3c.2 RED — `ts_hornero_admin/src/lib/qr/payload.test.ts`: parses/formats
      `HORNERO-ENTREGA:{donacionId}:{codigo}` and the bare 6-digit form; rejects a payload for a
      different `donacionId`.
- [x] 3c.3 GREEN — Create `ts_hornero_admin/src/lib/qr/payload.ts`. Satisfies 3c.2.
- [x] 3c.4 RED — `ts_hornero_admin/src/lib/qr/escanearQr.test.ts` (`vi.mock` the underlying
      scanner library, never the camera): `iniciar(video, onPayload)` invokes the callback on a
      decoded payload; `detener()` cleans up.
- [x] 3c.5 GREEN — Create `ts_hornero_admin/src/lib/qr/escanearQr.ts`: adapter using
      `BarcodeDetector` when present, falling back to `barcode-detector`'s ponyfill decoder (see
      3c.1 deviation — `qr-scanner` judged unmaintained). Satisfies 3c.4.
- [x] 3c.6 RED — Component tests for `CodigoQr.test.tsx` (renders `QRCodeSVG` from a code),
      `CodigoInput.test.tsx` (6-digit numeric input, `inputMode="numeric"`,
      `autoComplete="one-time-code"`), `Countdown.test.tsx` (ticks down, reaches zero), and
      `EstadoConfirmacion.test.tsx` (renders both parties' status).
- [x] 3c.7 GREEN — Create `ts_hornero_admin/src/components/entrega/CodigoQr.tsx`,
      `CodigoInput.tsx`, `Countdown.tsx`, `EstadoConfirmacion.tsx`. Satisfies 3c.6.
- [x] 3c.8 RED — `ts_hornero_admin/src/components/entrega/EscanerQr.test.tsx` (lazy component,
      `vi.mock('../../lib/qr/escanearQr')`): shows the scan button, starts/stops the adapter, shows
      a fallback reason when permission is denied or no camera exists, and the typed input stays
      usable regardless.
- [x] 3c.9 GREEN — Create `ts_hornero_admin/src/components/entrega/EscanerQr.tsx` (dynamic
      `import()` of the adapter, only loaded on "Escanear código" tap). Satisfies 3c.8.
- [x] 3c.10 RED — `ts_hornero_admin/src/lib/hooks/useEntrega.test.ts`: `useEstadoEntrega` polls
      every 3s until `ENTREGADA` then stops; `useGenerarCodigo`, `useVerificarCodigo` call the 3b
      routes and invalidate the estado query.
- [x] 3c.11 GREEN — Create `ts_hornero_admin/src/lib/hooks/useEntrega.ts`. Satisfies 3c.10.
      **Deviation (task ordering only)**: 3c.21 (`package.json` dependency additions) was pulled
      forward into this 3c-i batch per the orchestrator's explicit instruction, instead of staying
      in 3c-ii — `qrcode.react` and `barcode-detector` (not `qr-scanner`, see 3c.1) were added now
      so `npm test`/`npm run build` are green for this batch in isolation. 3c.12-3c.22 (route
      wiring, old-button/endpoint retirement) remain untouched, still `[ ]`, still scoped to 3c-ii.

**Verification (3c-i):** `cd ts_hornero_admin && npm test -- qr entrega/Codigo entrega/Escaner entrega/Countdown entrega/Estado`

**USER COMMIT POINT (3c-i)**: `feat(admin): add QR render/scan adapter and delivery-code building blocks`

### 3c-ii — Route wiring + retirement

- [x] 3c.12 RED — `ts_hornero_admin/src/routes/entrega.test.tsx`: QR rendered from `qrPayload`;
      countdown reaching zero shows "Generar código nuevo"; scanning updates status without reload
      (mocked adapter); typed input submits and verifies; polling stops at `ENTREGADA`.
      **Deviation (RED evidence quality)**: some assertions initially RED for the "module not
      found" reason (route file didn't exist yet) rather than a real assertion failure — standard
      for a brand-new route file, matching the convention already used for every other 3c-i
      component/hook in this change.
- [x] 3c.13 GREEN — Create `ts_hornero_admin/src/routes/entrega.tsx`
      (/donaciones/:id/entrega), composing 3c-i's components and hooks.
- [x] 3c.14 GREEN — `ts_hornero_admin/src/app/router.tsx`: register the route with
      `allow={['DONANTE','REFERENTE']} requireVerified`. RED first via `router.test.tsx`'s
      structural guard assertion (mirrors the existing `/organizaciones/:id/legajo` pattern).
- [x] 3c.15 RED — Assertions in `mis-donaciones.test.tsx` (created new — none existed before
      this batch) and `dashboard.test.tsx`: a "Confirmar entrega" link to the new route is
      present.
- [x] 3c.16 GREEN — `ts_hornero_admin/src/routes/mis-donaciones.tsx`,
      `ts_hornero_admin/src/routes/dashboard.tsx`: replace the button with the link. Satisfies
      3c.15.
- [x] 3c.17 GREEN — Delete `ts_hornero_admin/src/lib/hooks/useConfirmarEntrega.ts` (retired).
- [x] 3c.18 RED — MS `DonacionControllerTest` + new BFF `donaciones.routing.spec.ts`: a request
      to the old `confirmar-entrega` route returns 404.
      **Deviation/finding**: on the MS side, removing the mapping alone made the route fall
      through to Spring's static-resource handler, which throws `NoResourceFoundException` —
      `GlobalExceptionHandler`'s generic `Exception` catch-all turned that into 500, not 404.
      Added a dedicated `@ExceptionHandler(NoResourceFoundException.class)` → 404 case (see 3c.19).
- [x] 3c.19 GREEN — `jar_hornero_ms/.../donacion/DonacionController.java`,
      `DonacionService.java`: removed the `confirmar-entrega` endpoint and `confirmarEntrega`
      method (the shared `ConfirmacionEntrega.registrar` helper stays, used only by
      `EntregaService` now). `GlobalExceptionHandler` gained the `NoResourceFoundException` → 404
      mapping (see 3c.18 finding). Satisfies 3c.18 (MS side).
- [x] 3c.20 GREEN — `ts_hornero_bff/src/donaciones/*`: removed the `confirmar-entrega` route and
      service method. Satisfies 3c.18 (BFF side).
- [x] 3c.21 GREEN — `ts_hornero_admin/package.json`: add `qrcode.react`, `qr-scanner` (or the
      chosen fallback per 3c.1) as dependencies.
      **Done early, in the 3c-i batch** (orchestrator instruction): added `qrcode.react@4.2.0` and
      `barcode-detector@3.2.2` (the AD-7 fallback — not `qr-scanner`, see 3c.1's verification note).
- [x] 3c.22 REFACTOR — Confirmed by inspection: `TransicionesDonacion`'s `PERMITIDAS` table already
      carries explicit `PENDIENTE_CONFIRMACION` → `ENTREGADA` entries (added in slice 3a); no code
      path bypasses the table now that `confirmarEntrega` is gone — the code-verified path
      (`EntregaService`) is the only route to `ENTREGADA` besides `overrideEstado`. No code change
      needed.

      **3c-ii open item resolved**: `EscanerQr`'s scan-button label now fits the viewer's role via
      a new optional `contraparte` prop (`'ORGANIZACION'` default / `'DONANTE'`) — a donante sees
      "Escanear código de la organización", a referente sees "Escanear código del donante".
      `entrega.tsx` passes `contraparte={parteActual === 'REFERENTE' ? 'DONANTE' : 'ORGANIZACION'}`.

**Verification (3c-ii):**
`cd ts_hornero_admin && npm test -- entrega mis-donaciones dashboard && npm run build`
`cd jar_hornero_ms && mvn test -Dtest=DonacionControllerTest`
`cd ts_hornero_bff && npm test -- donaciones`

**USER COMMIT POINT (3c-ii)**: `feat(entrega): wire mutual delivery-code confirmation and retire the plain confirm button`
(deploy 3c-i and 3c-ii together — `docker compose up --build -d` for admin+BFF+MS — so no
deployed UI ever calls the retired endpoint)

## Slice 4a — Cross-org audit queue backend (MS + BFF)

Depends on: none. Spec: `auditoria-cola-global`. Design: AD-8.

- [x] 4a.1 RED — `jar_hornero_ms/src/test/.../domain/OrganizacionEvidenciaRepositoryTest.java`:
      `buscarCola(...)` tab semantics (`PENDIENTE` not expired vs. any expired row regardless of
      `estado`, `REEMPLAZADA` never included unless expired — matching the spec's precedence rule);
      each filter (`requisito`, `tipoEvidencia`, `nivel` → resolved `requisito IN`) alone and
      combined; paging metadata; `size` capped at 100; the append-only reflection test still passes.
- [x] 4a.2 RED — `jar_hornero_ms/src/test/.../acreditacion/AuditoriaControllerTest.java`
      (`@WebMvcTest` + real `SecurityConfig`): ADMINISTRADOR succeeds; REFERENTE and DONANTE get
      403; anonymous gets 401/403; empty filter combination returns a valid empty page, not an
      error.
- [x] 4a.3 GREEN — Create `jar_hornero_ms/.../acreditacion/dto/TabCola.java` (`PENDIENTES` |
      `VENCIDAS`) and `dto/EvidenciaEnColaResponse.java` (`EvidenciaResponse` fields +
      `organizacionNombre`, `organizacionNivel`).
- [x] 4a.4 GREEN — `jar_hornero_ms/.../domain/OrganizacionEvidenciaRepository.java`: add
      `@Query buscarCola(...)` with `JOIN FETCH e.organizacion o` and an explicit `countQuery`,
      default sort `cargadoEn ASC`. Satisfies 4a.1.
- [x] 4a.5 GREEN — `jar_hornero_ms/.../acreditacion/AcreditacionService.java`: add
      `colaAuditoria(filtros, pageable)`, resolving `nivel` to the set of
      `RequisitoAcreditacion.nivelExigido == nivel`, always passing a non-empty `requisito IN`
      collection.
- [x] 4a.6 GREEN — Create `jar_hornero_ms/.../acreditacion/AuditoriaController.java`:
      `GET /api/auditoria/evidencias?tab=&nivel=&requisito=&tipoEvidencia=&page=&size=&sort=`,
      returning `PageData<EvidenciaEnColaResponse>` through `ApiResponse`. Satisfies 4a.2.
- [x] 4a.7 GREEN — `jar_hornero_ms/.../config/SecurityConfig.java`: add
      `.requestMatchers("/api/auditoria/**").hasRole("ADMINISTRADOR")` (deliberately not under
      /api/organizaciones/**), plus `@PreAuthorize` on the controller as defense-in-depth.
- [x] 4a.8 RED — `ts_hornero_bff/src/acreditacion/auditoria.controller.spec.ts` (new sibling
      `AuditoriaController` in the same module): whitelisted query params forwarded,
      `@Roles(ADMINISTRADOR)`.
- [x] 4a.9 GREEN — `ts_hornero_bff/src/acreditacion/auditoria.controller.ts` (new),
      `acreditacion.service.ts`: add `GET auditoria/evidencias`. Satisfies 4a.8.

**Verification (slice 4a):**
`cd jar_hornero_ms && mvn test -Dtest=OrganizacionEvidenciaRepositoryTest,AuditoriaControllerTest`
`cd ts_hornero_bff && npm test -- acreditacion`

**USER COMMIT POINT**: `feat(auditoria): add cross-org audit queue read endpoint`

## Slice 4b — Cross-org audit queue screen (admin)

Depends on: 4a. Spec: `auditoria-cola-global`.

- [x] 4b.1 RED — `ts_hornero_admin/src/lib/hooks/useColaAuditoria.test.tsx`: query key includes
      tab/filters/page/size, uses `keepPreviousData`.
- [x] 4b.2 GREEN — Create `ts_hornero_admin/src/lib/hooks/useColaAuditoria.ts`. Satisfies 4b.1.
- [x] 4b.3 RED — `ts_hornero_admin/src/routes/auditoria.test.tsx`: tabs and filter changes reset
      to page 0 and change the query key; pager renders; selecting a row opens the existing detail
      with Aprobar/Observar; approving from the opened detail invalidates `['auditoria','cola']` and
      the row disappears from Pendientes on refresh.
- [x] 4b.4 GREEN — Create `ts_hornero_admin/src/routes/auditoria.tsx`: tabs, filters, paged list,
      row → detail drawer reusing `AuditQueue.tsx` with `organizacionId` + `evidenciaIds=[id]`.
      Satisfies 4b.3.
- [x] 4b.5 GREEN — `ts_hornero_admin/src/lib/hooks/useAcreditacion.ts`: `useAuditarEvidencia` also
      invalidates `['auditoria','cola']`.
- [x] 4b.6 GREEN — `ts_hornero_admin/src/app/router.tsx`, `ts_hornero_admin/src/app/AppShell.tsx`:
      register /auditoria under the ADMINISTRADOR block + nav entry.

**Verification (slice 4b):** `cd ts_hornero_admin && npm test -- auditoria && npm run build`

**USER COMMIT POINT**: `feat(admin): add cross-org audit queue screen`

## Slice 5a — Worker contract + HTTP entrypoint (worker, compose)

Depends on: none (transport decision AD-1 already made — HTTP endpoint in a new compose service).
Spec: `ronda-asignacion`, `donacion-fondo-comun`. Design: AD-1, AD-2, AD-10, AD-14.

- [x] 5a.1 RED — `go_algorithms_worker/internal/contrato/ronda_v1_test.go`: decode/validate the v1
      request (version check → `400 VERSION_NO_SOPORTADA` for unknown major, body size limit,
      ≤ 500 donaciones/candidatos, finite coordinates in range, unrecognized-but-present `categoria`
      strings pass through untouched).
- [x] 5a.2 RED — `go_algorithms_worker/internal/geo/deficit_test.go`: the 4-row precedence table
      (`PROVISTO` > `RADIO` > `CERCANO` > `NEUTRAL`), including the zero-population/no-CSV case
      resolving every candidate to `NEUTRAL`.
- [x] 5a.3 RED — `go_algorithms_worker/internal/assign/ronda_test.go`: the per-donation
      unassignment-penalty dummy column (AD-10) — `penalizacionNoAsignar = 0` reproduces the old
      solver's assigned set and `ScoreTotal` on randomized instances (property test alongside the
      existing oracle); under contention, the older (`diasEnFondo` larger) donation wins the scarce
      necesidad; `organizacionesExcluidas` acts as a hard filter.
- [x] 5a.4 RED — `go_algorithms_worker/internal/assign/scoring_test.go`: `ScoreDetallado` →
      `Desglose` renaming/delegation keeps existing callers/tests green.
- [x] 5a.5 RED — `go_algorithms_worker/internal/api/handler_test.go` (`httptest`): `POST /v1/ronda`
      200 on a valid golden request; 400 on invalid input; 413 on an oversized body; `GET /healthz`
      200.
- [x] 5a.6 RED — Golden fixture test: `go_algorithms_worker/testdata/ronda-v1/request.json` →
      `response.json` round-trips through the handler exactly.
- [x] 5a.7 GREEN — Create `go_algorithms_worker/internal/contrato/ronda_v1.go`: wire DTOs,
      validation, mapping to unchanged `internal/assign` types. Satisfies 5a.1.
- [x] 5a.8 GREEN — Create `go_algorithms_worker/internal/geo/deficit.go`: `ResolverDeficit`,
      loaded once at startup from `data/renacom.csv` and optional `POBLACION_CSV`. Satisfies 5a.2.
- [x] 5a.9 GREEN — Modify `go_algorithms_worker/internal/assign/scoring.go`: rename to `Desglose`,
      `Score` delegates. Satisfies 5a.4.
- [x] 5a.10 GREEN — Modify `go_algorithms_worker/internal/assign/ronda.go`: `Asignacion.Desglose`;
      per-donation dummy columns with the unassignment penalty; `Donacion.DiasEnFondo`,
      `OrganizacionesExcluidas` hard filter. Satisfies 5a.3.
- [x] 5a.11 GREEN — Create `go_algorithms_worker/internal/api/handler.go`: `POST /v1/ronda`,
      `GET /healthz`, size limit (`http.MaxBytesReader`), error envelope `{error, detalle}`.
      Satisfies 5a.5, 5a.6.
- [x] 5a.12 GREEN — Modify `go_algorithms_worker/main.go`: add `serve --addr :8090 --data ...
      [--poblacion ...] [--provincia ...]`; the existing `assign` CLI now uses `internal/contrato`.
- [x] 5a.13 GREEN — Create `go_algorithms_worker/Dockerfile`, `.dockerignore`: `golang:1.26-alpine`
      build (`CGO_ENABLED=0`) → `alpine` runtime with `wget` for the healthcheck; copies
      `data/renacom.csv`.
- [x] 5a.14 GREEN — Modify `docker-compose.yml`: add `worker` service (build
      `./go_algorithms_worker`, no `ports`, healthcheck `wget -qO- http://localhost:8090/healthz`,
      network `hornero`, optional `POBLACION_CSV`).
- [x] 5a.15 GREEN — Create `go_algorithms_worker/contract/ronda-v1.md` and the golden fixtures
      `go_algorithms_worker/testdata/ronda-v1/{request,response}.json`; note that these fixtures are
      copied into `jar_hornero_ms/src/test/resources/contract/` in slice 5c and both suites must
      change together.
- [x] 5a.16 GREEN — Modify `go_algorithms_worker/README.md`: document `serve` usage.
- [x] 5a.17 REFACTOR — Confirm `internal/assign.Candidato.Deficit` stays a plain `float64`;
      "absent vs zero" stays a wire-only concern in `internal/contrato`.

**Verification (slice 5a):** `cd go_algorithms_worker && go test ./...`

**USER ACTION (operational precondition, not blocking this slice's tests)**: source and mount the
INDEC population CSV as `POBLACION_CSV` before relying on non-`NEUTRAL` deficit results in
production; until then every candidate resolves to `deficitFuente = NEUTRAL` (AD-2 known
limitation) and the thesis document (slice 7) must state this.

**USER COMMIT POINT**: `feat(worker): add versioned ronda contract and HTTP serve entrypoint`

## Slice 5b — Pool schema + null safety (MS, SQL)

Depends on: 3c (per AD-5, slice 3 must stabilize the transition table first). Spec:
`donacion-fondo-comun`. Design: AD-3, AD-4, AD-13.

- [x] 5b.1 GREEN (infra, no test) — Create `scripts/sql/V001__donaciones_necesidad_id_nullable.sql`
      (idempotent, transactional `ALTER TABLE donaciones ALTER COLUMN necesidad_id DROP NOT NULL`)
      and `scripts/sql/README.md` documenting the `V{NNN}__{snake_description}.sql` convention.
- [x] 5b.2 GREEN (docs) — `docs/db-changes.md`: add a log entry (Reason / Before / Migration /
      After / Rollback / Applied to). `docs/deploy-rpi-cloudflare.md`: add the pre-deploy step
      (backup, run `V001`, verify with `\d donaciones`).
- [x] 5b.3 RED — `jar_hornero_ms/src/test/.../donacion/DonacionServiceTest.java`: creating
      `DIRECTA` is unchanged; creating `FONDO_COMUN` requires `categoria` + coordinates and rejects
      a supplied `necesidadId`; `modalidad` is not updatable after creation (no code path can change
      it, including override); `eliminar` on a `FONDO_COMUN` donación → 409 `USAR_CANCELACION`;
      devolución (`decidir RECHAZADA` on a `FONDO_COMUN` donación with an assigned necesidad) clears
      `necesidad` **without** removing the donation from `necesidad.getDonaciones()` (the
      `orphanRemoval` regression test pinned by AD-3's gotcha).
- [x] 5b.4 RED — `jar_hornero_ms/src/test/.../donacion/FaseDonacionTest.java`: the full AD-4
      derivation table (modalidad × estado × necesidad presence → `fase`).
- [x] 5b.5 RED — `jar_hornero_ms/src/test/.../domain/DonacionRepositoryTest.java`
      (`@DataJpaTest` on H2): `findMias`, `findById`, `findActivas` and the donante/admin list
      queries return an unassigned `FONDO_COMUN` donación (organizacion/necesidad fields absent, not
      a server error) via the new `LEFT JOIN FETCH`; org-scoped queries stay inner-joined and
      exclude unassigned pool donations; count queries use explicit left joins too.
- [x] 5b.6 RED — `jar_hornero_ms/src/test/.../donacion/DonacionResponseTest.java` (or an existing
      response test): a pool donación's `latitud`, `longitud` are never serialized in any
      `DonacionResponse`, `DonacionActivaResponse`, even for the owning donante on `GET
      /api/donaciones` — location stays write-only.
- [x] 5b.7 RED — `jar_hornero_ms/src/test/.../config/EsquemaVerificadorTest.java`: when
      `necesidad_id` is still `NOT NULL` at boot (simulated), `crear(FONDO_COMUN)` answers `503
      ESQUEMA_PENDIENTE`; `DIRECTA` keeps working; the check is skipped on H2 (PostgreSQL-only
      guard, verified via a conditional/profile check rather than run against H2 directly).
- [x] 5b.8 GREEN — Create `jar_hornero_ms/.../domain/ModalidadDonacion.java`: `DIRECTA`,
      `FONDO_COMUN`.
- [x] 5b.9 GREEN — Modify `jar_hornero_ms/.../domain/Donacion.java`: `necesidad` `nullable = true`;
      add `modalidad` (`updatable = false`, null read as `DIRECTA`), `categoria`
      (`CategoriaAlimento`), `latitud`, `longitud`.
- [x] 5b.10 GREEN — Create `jar_hornero_ms/.../donacion/FaseDonacion.java`: the AD-4 derivation.
      Satisfies 5b.4.
- [x] 5b.11 GREEN — Modify `jar_hornero_ms/.../donacion/dto/CreateDonacionRequest.java`: add
      `modalidad`, optional `necesidadId`, `categoria`, `latitud`, `longitud` with cross-field
      validation (`FONDO_COMUN` requires categoria+coords and forbids `necesidadId`; `DIRECTA`
      requires `necesidadId` and forbids categoria/coords per the spec's field-omission scenario).
- [x] 5b.12 GREEN — Modify `jar_hornero_ms/.../donacion/DonacionService.java`: `crear` branches per
      modalidad; `decidir` implements the devolución-to-pool rule for `FONDO_COMUN` rejections
      (AD-3); cancel resolves a vigente asignación hook (no-op stub until 5c persists `Asignacion`);
      `eliminar` → 409 for `FONDO_COMUN`; null-safe `toResponse`, `toActivaResponse`; compute `fase`
      via 5b.10. Satisfies 5b.3.
- [x] 5b.13 GREEN — Modify `jar_hornero_ms/.../donacion/DonacionResponse.java`,
      `DonacionActivaResponse.java`: nullable `necesidadId`, `organizacionId`; add `modalidad`,
      `categoria`, `fase`; never serialize `latitud`, `longitud`. Satisfies 5b.6.
- [x] 5b.14 GREEN — Modify `jar_hornero_ms/.../domain/DonacionRepository.java`: switch
      `findAllWithDonante` (×2), `findByIdWithRelations`, `findByDonante_IdWithRelations` (×2),
      `findActivas` + its `countQuery` to `LEFT JOIN FETCH d.necesidad n LEFT JOIN FETCH n.organizacion
      o`; org-scoped queries stay inner. Satisfies 5b.5.
- [x] 5b.15 GREEN — Create `jar_hornero_ms/.../config/EsquemaVerificador.java`
      (`ApplicationRunner`, PostgreSQL-only): reads `information_schema.columns.is_nullable` for
      `donaciones.necesidad_id` at boot; logs `ERROR` naming the script and flags
      `crear(FONDO_COMUN)` to answer `503 ESQUEMA_PENDIENTE` when still `NO`. Satisfies 5b.7.
- [x] 5b.16 REFACTOR — Sweep `DonacionService`, `DonacionController` for any remaining direct
      `d.getNecesidad().getOrganizacion()` call not already routed through `ParticipantesDonacion`
      (introduced in 3a) — this is the fix for the historical `DonacionService.java:157` NPE risk
      once pool donations exist.
      **Confirmed by inspection**: `rg "getNecesidad\(\)\.get"` across `donacion/*.java` and
      `donacion/entrega/*.java` returns no matches — `toResponse`/`toActivaResponse` now go through
      local null-checked `necesidad`/`organizacion` variables, and `DonacionController` never
      dereferences `necesidad` directly.

**Verification (slice 5b):**
`cd jar_hornero_ms && mvn test -Dtest=DonacionServiceTest,FaseDonacionTest,DonacionRepositoryTest,DonacionResponseTest,EsquemaVerificadorTest`

**USER ACTION (blocking deploy of this slice)**: run `scripts/sql/V001__donaciones_necesidad_id_nullable.sql`
on the Pi **before** deploying the new MS image, per `docs/deploy-rpi-cloudflare.md`'s updated
pre-deploy step:
```bash
docker compose exec -T postgres pg_dump -U "$DB_USERNAME" "$DB_NAME" | gzip > backup_$(date +%F).sql.gz
docker compose exec -T postgres psql -U "$DB_USERNAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  < scripts/sql/V001__donaciones_necesidad_id_nullable.sql
docker compose exec -T postgres psql -U "$DB_USERNAME" -d "$DB_NAME" -c '\d donaciones'
```
Confirm `necesidad_id` shows nullable in the `\d donaciones` output, then record "Applied to" in
`docs/db-changes.md`. Running it before the new MS is deployed is safe — the old code never writes
`NULL`. Also run the script a second time locally (idempotency check) as part of manual QA on
`make up-local` before touching the Pi.

**USER COMMIT POINT**: `feat(ms): make necesidad_id nullable and add fondo comun modalidad`

## Slice 5c — Asignación persistence + ronda trigger (MS)

Depends on: 5a (worker contract), 5b (schema). Sub-split per the forecast: **5c-i** (entities +
`RondaService` core) then **5c-ii** (client + controllers + security wiring).

### 5c-i — Entities + RondaService core

- [x] 5c.1 RED — `jar_hornero_ms/src/test/.../asignacion/RondaServiceTest.java`: candidate query
      excludes N0 organizaciones (RED test pinning the empty-`categoriasPermitidas` = uncapped
      worker behavior interacting with `AcreditacionService.categoriasPermitidas(N0)` being empty),
      excludes closed/expired necesidades, excludes orgs without a referente or coordinates;
      `urgencia`, `diasDesdeUltimaDonacion` derivations match `UrgenciaCalculator`; exclusions from
      rejected assignments (`organizacionesExcluidas`) are applied; `ReentrantLock.tryLock()`
      failure → `409 RONDA_EN_CURSO`; worker timeout/error → `Ronda(FALLIDA, error)` persisted +
      `503`, `502`, nothing assigned; a donation that went stale between read and write (donante
      cancelled mid-call) is counted as `descartadas`, not assigned; happy path persists `Ronda` +
      `Asignacion` rows and sets `donacion.necesidad`.
      **Deviation**: the "excludes N0/expired/no-referente-or-coordinates" eligibility predicate
      moved from JPQL (`NecesidadRepository`) into a Java-side filter inside `RondaService`
      (`esCandidataElegible`), so it stays covered by plain Mockito unit tests instead of a
      `@DataJpaTest` fixture — this matches the task's own framing of these as `RondaServiceTest`
      RED cases, not a repository test. `NecesidadRepository` gained a simpler
      `findByEstadoInWithOrganizacion` fetch instead of a complex filtering `@Query`.
      **TDD note**: written and passing against the already-implemented `RondaService`/
      `EntradaRondaFactory` (not strict RED-first for this file) — see the TDD Cycle Evidence table
      in `apply-progress.md`.
- [x] 5c.2 RED — `jar_hornero_ms/src/test/.../asignacion/UrgenciaCalculatorTest.java`: `urgencia =
      max(base(prioridad), vencimiento)` per the documented constants and clamp.
- [x] 5c.3 RED — `jar_hornero_ms/src/test/.../domain/AsignacionTest.java` /
      `RondaTest.java` (`@DataJpaTest`): entity persistence round-trips every field in AD-9's model,
      including `deficitFuente`, `codigoRadio` and the weight snapshot columns.
      **TDD note**: entities were created together with these tests (not strict RED-first) given
      their mechanical, spec-dictated shape (design.md's `Ronda`/`Asignacion` interface block);
      confirmed GREEN on first run.
- [x] 5c.4 GREEN — Create `jar_hornero_ms/.../domain/EstadoRonda.java`,
      `jar_hornero_ms/.../domain/Ronda.java`, `RondaRepository.java`.
- [x] 5c.5 GREEN — Create `jar_hornero_ms/.../domain/EstadoAsignacion.java`,
      `jar_hornero_ms/.../domain/Asignacion.java`, `AsignacionRepository.java` (indexes on
      `donacion_id`, `ronda_id`). Satisfies 5c.3.
- [x] 5c.6 GREEN — Create `jar_hornero_ms/.../asignacion/UrgenciaCalculator.java`. Satisfies 5c.2.
      True RED→GREEN: `UrgenciaCalculatorTest` failed to compile (`cannot find symbol
      UrgenciaCalculator`) before the class existed, then passed once created.
- [x] 5c.7 GREEN — Create `jar_hornero_ms/.../asignacion/EntradaRondaFactory.java`: assembles
      `EntradaRondaV1` from the pool, candidates, days-since-last-donation, and exclusions.
      **Deviation**: takes `AcreditacionService` directly as a constructor collaborator (its
      `categoriasPermitidas` method is `public`) instead of an injected `Function` — simpler, and
      `AcreditacionService` is already a Spring-managed singleton with no compliance-count
      dependency yet (6b doesn't exist). No dedicated test class; covered indirectly through
      `RondaServiceTest`'s captured `EntradaRondaV1` assertions (candidate list, exclusions,
      urgencia/diasDesdeUltimaDonacion), per the task's own verification list (only
      `RondaServiceTest`, `UrgenciaCalculatorTest`, `AsignacionTest`, `RondaTest` are named).
- [x] 5c.8 GREEN — Create `jar_hornero_ms/.../asignacion/RondaService.java`: `ejecutar(adminId)`
      implementing AD-9's five steps against a fake `AsignadorClient` collaborator. Satisfies 5c.1.
      **Deviation (scope note for 5c-ii)**: 5c-i's own scope required an `AsignadorClient`
      interface seam, which in turn required the worker contract v1 wire DTOs
      (`EntradaRondaV1`/`SalidaRondaV1`/etc.) to exist so the interface method signature compiles —
      these were created now under `org.example.asignacion.worker(.dto)`, even though the task
      file map nominally lists `dto/*` under 5c-ii (5c.13). **5c-ii should reuse these DTOs
      as-is** for `HttpAsignadorClient`'s (de)serialization rather than recreating them.
      Also added `AsignadorNoDisponibleException`, `AsignadorRespuestaInvalidaException`, and a
      placeholder `AsignadorNoConfiguradoClient` (`@Component`, always throws
      `AsignadorNoDisponibleException`) — required so the full Spring application context can boot
      at all (a `@Service` singleton with an unsatisfied constructor dependency fails
      `ApplicationContext` startup for every `@SpringBootTest`, which broke 6 unrelated test
      classes until this placeholder was added). **5c-ii should replace this placeholder** with the
      real conditional wiring (`HttpAsignadorClient` when `app.worker.url` is set, this
      no-op/`AsignadorNoConfigurado` behavior when blank) rather than deleting it outright — its
      behavior already matches the design's documented blank-URL fallback.
      Uses `TransactionTemplate`/`PlatformTransactionManager` (already an established pattern in
      this codebase, see `EntregaControllerIntegrationTest`) for two explicit transactional phases
      (read, then write) around the worker call, per AD-9's "call the worker outside any
      transaction" requirement.

**Verification (5c-i):**
`cd jar_hornero_ms && mvn test -Dtest=RondaServiceTest,UrgenciaCalculatorTest,AsignacionTest,RondaTest`

**USER COMMIT POINT (5c-i)**: `feat(ms): add ronda/asignacion persistence and ronda orchestration core`

### 5c-ii — Worker client + controllers + security

- [x] 5c.9 RED — `jar_hornero_ms/src/test/.../asignacion/worker/HttpAsignadorClientTest.java`
      (`MockRestServiceServer` against the golden fixtures copied from
      `go_algorithms_worker/testdata/ronda-v1/`): request serializes to exactly the golden request;
      response deserializes to exactly the golden response; connect timeout 2s / read timeout 30s
      configured; blank `app.worker.url` yields an `AsignadorNoConfigurado` client that throws for a
      503.
      **TDD note (resumed batch)**: this file was already written and GREEN when this batch resumed
      — RED not re-observed (resumed batch). Reviewed against 5c.9's RED criteria and confirmed
      complete: golden request/response fidelity, timeout constants, and the blank-URL →
      `AsignadorNoConfiguradoClient` → `AsignadorNoDisponibleException` path are all covered, plus
      extra coverage for the down/malformed/4xx → `AsignadorRespuestaInvalidaException` mapping.
- [x] 5c.10 RED — `jar_hornero_ms/src/test/.../asignacion/RondaControllerTest.java`
      (`@WebMvcTest` + real `SecurityConfig`): `POST /api/rondas` admin-only, 403 for
      REFERENTE/DONANTE, 401/403 anonymous; `GET /api/rondas`, /api/rondas/{id},
      /api/rondas/fondo admin-only.
      **TDD note (resumed batch)**: RED not re-observed (resumed batch) — reviewed and confirmed
      complete against the criteria above.
- [x] 5c.11 RED — `jar_hornero_ms/src/test/.../asignacion/AsignacionControllerTest.java`:
      `GET /api/donaciones/{id}/asignaciones` accessible to the owning donante, any referente
      involved in the donation's assignment history, and admin; denied to unrelated actors.
      **TDD note (resumed batch)**: RED not re-observed (resumed batch) — reviewed and confirmed
      complete against the criteria above.
- [x] 5c.12 RED — Assertions in `DonacionServiceTest.java`: accept, devolución, cancel, and
      `overrideEstado` each resolve the vigente `Asignacion` to the matching `EstadoAsignacion`
      (`ACEPTADA`, `RECHAZADA`, `CANCELADA`), replacing 5b.12's no-op stub.
      True RED→GREEN observed in this session: added
      `decidir_ofrecidaToAceptada_resuelveAsignacionVigenteComoAceptada`,
      `decidir_ofrecidaToAceptada_sinAsignacionVigente_noLanzaYNoGuardaNada`,
      `decidir_fondoComunAsignada_rechazada_resuelveAsignacionVigenteComoRechazada`,
      `actualizarEstado_cancelada_resuelveAsignacionVigenteComoCancelada`,
      `overrideEstado_haciaCancelada_resuelveAsignacionVigenteComoCancelada`,
      `overrideEstado_haciaEntregada_noResuelveAsignacion_noEsUnEstadoDeAsignacion` — all failed with
      `NullPointerException` (no `asignacionRepository` field wired, stub no-op from 5b.12) before
      5c.17's implementation, then passed after.
- [x] 5c.13 GREEN — Create `jar_hornero_ms/.../asignacion/worker/AsignadorClient.java` (interface),
      `HttpAsignadorClient.java` (Spring `RestClient`), `AsignadorConfig.java`, `dto/*` (request/
      response wire DTOs). Satisfies 5c.9.
      (`AsignadorClient` and `dto/*` were created in 5c-i per that slice's documented deviation;
      this task's remaining scope — `HttpAsignadorClient`, `AsignadorConfig` — was already present
      and reviewed complete when this batch resumed.)
- [x] 5c.14 GREEN — Copy `go_algorithms_worker/testdata/ronda-v1/{request,response}.json` into
      `jar_hornero_ms/src/test/resources/contract/`, referenced by 5c.9's test (both copies change
      together per AD-14).
- [x] 5c.15 GREEN — Create `jar_hornero_ms/.../asignacion/RondaController.java`: `POST
      /api/rondas`, `GET /api/rondas`, `GET /api/rondas/{id}`, `GET /api/rondas/fondo`. Satisfies
      5c.10.
- [x] 5c.16 GREEN — Create `jar_hornero_ms/.../asignacion/AsignacionController.java` (or add to
      `DonacionController`): `GET /api/donaciones/{id}/asignaciones`. Satisfies 5c.11.
- [x] 5c.17 GREEN — Modify `jar_hornero_ms/.../donacion/DonacionService.java`: implement the
      vigente-asignación resolution stubbed in 5b.12. Satisfies 5c.12.
      Added `AsignacionRepository.findFirstByDonacion_IdAndEstadoOrderByCreadaEnDesc(donacionId,
      PROPUESTA)` and a private `resolverAsignacionVigente(donacionId, destino)` helper in
      `DonacionService`, called from `decidir` (ACEPTADA and the FONDO_COMUN devolución branch),
      `actualizarEstado` (CANCELADA), and `overrideEstado` (ACEPTADA/RECHAZADA/CANCELADA targets
      only — ENTREGADA/EN_CAMINO/PENDIENTE_CONFIRMACION have no matching `EstadoAsignacion` and are
      explicitly left untouched, pinned by
      `overrideEstado_haciaEntregada_noResuelveAsignacion_noEsUnEstadoDeAsignacion`). A `DIRECTA`
      donación or any donación with no `PROPUESTA` row is a silent no-op (`Optional.empty()`), never
      an error — pinned by
      `decidir_ofrecidaToAceptada_sinAsignacionVigente_noLanzaYNoGuardaNada`.
- [x] 5c.18 GREEN — `jar_hornero_ms/.../config/SecurityConfig.java`: /api/rondas/**
      `hasRole("ADMINISTRADOR")`; `GET /api/donaciones/*/asignaciones` `.authenticated()` declared
      before the donaciones permitAll matcher.
- [x] 5c.19 GREEN — `jar_hornero_ms/src/main/resources/application.yml`,
      `docker-compose.yml`: `app.worker.url: ${WORKER_URL:}`; MS service environment
      `WORKER_URL: http://worker:8090`.
- [x] 5c.20 REFACTOR — Confirm `RondaService.ejecutar` wires `HttpAsignadorClient` (not the fake) in
      the Spring context, and the fake stays test-only.
      Confirmed: `AsignadorNoConfiguradoClient` is no longer `@Component` (placeholder removed per
      5c-i's note); `AsignadorConfig.asignadorClient` is the sole bean source, returning
      `HttpAsignadorClient` when `app.worker.url` is non-blank and `AsignadorNoConfiguradoClient`
      otherwise. `RondaServiceTest` continues to use a hand-rolled fake `AsignadorClient`
      (test-only, never a Spring bean).

**Verification (5c-ii):**
`cd jar_hornero_ms && mvn test -Dtest=HttpAsignadorClientTest,RondaControllerTest,AsignacionControllerTest,DonacionServiceTest`

**USER COMMIT POINT (5c-ii)**: `feat(ms): call the worker over HTTP and expose ronda/asignacion endpoints`

## Slice 5d — BFF (modalidad + rondas)

Depends on: 5c. Spec: `donacion-fondo-comun`, `ronda-asignacion`.

- [x] 5d.1 RED — `ts_hornero_bff/src/donaciones/dto/crear-donacion.dto.spec.ts` (or inline
      validation test): `modalidad`, optional `necesidadId`, `categoria`, `latitud`, `longitud`
      with `ValidateIf` matching the MS's cross-field rules.
      **Deviation**: implemented with per-field custom `@Validate(...)` constraint classes
      (`NecesidadIdCrossFieldConstraint`, `CategoriaCrossFieldConstraint`,
      `CoordenadaCrossFieldConstraint`) instead of stacked `@ValidateIf` decorators — empirically
      verified (scratch spec, deleted) that class-validator 0.15.1 does not independently scope two
      `@ValidateIf` conditions applied to the same property; the first conditional short-circuits
      all later decorators on that property regardless of its own guard. The custom-constraint
      approach reproduces the exact same required/forbidden cross-field semantics as
      `CreateDonacionRequest`/`DonacionService.crear` (null modalidad reads as DIRECTA).
      RED confirmed: 7/10 cases failed against the pre-existing 2-field DTO before the rewrite.
- [x] 5d.2 RED — Assertions in `donaciones.controller.spec.ts`: `GET :id/asignaciones` requires
      `@Roles(DONANTE, REFERENTE, ADMINISTRADOR)`.
      RED confirmed: `controller.asignaciones is not a function` + `Reflect.getMetadata` TypeError
      before the route existed.
- [x] 5d.3 RED — `ts_hornero_bff/src/rondas/rondas.controller.spec.ts`,
      `rondas.service.spec.ts`: `POST /rondas`, `GET /rondas`, `GET /rondas/:id`, `GET
      /rondas/fondo`, all `@Roles(ADMINISTRADOR)`, forwarding the Bearer token.
      RED confirmed: `Cannot find module './rondas.controller'` / `'./rondas.service'` before
      either file existed.
- [x] 5d.4 GREEN — Modify `ts_hornero_bff/src/donaciones/dto/crear-donacion.dto.ts`. Satisfies
      5d.1. 10/10 dto spec cases pass.
- [x] 5d.5 GREEN — Modify `ts_hornero_bff/src/donaciones/*`: add the `GET :id/asignaciones` route.
      Satisfies 5d.2. Service method's own RED→GREEN also independently verified (removed then
      restored `DonacionesService.asignaciones`, confirmed 2/2 failing then passing).
- [x] 5d.6 GREEN — Create `ts_hornero_bff/src/rondas/rondas.module.ts`, `rondas.controller.ts`,
      `rondas.service.ts`. Satisfies 5d.3. `fondo` route declared before `:id` in the controller so
      Express/Nest matches the literal path first (mirrors the MS's `RondaController` route set:
      `POST /api/rondas`, `GET /api/rondas`, `GET /api/rondas/{id}`, `GET /api/rondas/fondo`).
- [x] 5d.7 GREEN — `ts_hornero_bff/src/app.module.ts`: register `RondasModule`.

**Verification (slice 5d):** `cd ts_hornero_bff && npm test -- donaciones rondas` — 7 suites /
64 tests pass. Full `npm test` (whole BFF): 22 suites / 158 tests pass. `npm run build`: clean
(`tsc -b && vite build` equivalent for Nest — `nest build`, no errors).

**Size note**: actual authored diff (~656 lines incl. tests) exceeds the slice's 250-350 forecast —
driven by the strict-TDD custom cross-field validator (deviation documented in 5d.1) and the full
RED+GREEN test suites for the new `rondas` module, not scope creep (file list matches design.md's
5d table exactly: `crear-donacion.dto.ts`, `donaciones.controller.ts`/`donaciones.service.ts`
(`asignaciones` route only), `rondas.module.ts`/`rondas.controller.ts`/`rondas.service.ts`,
`app.module.ts`). Per the tasks file's size policy, it splits into 3 natural-seam commits instead
of one, same scope, same branch:

**USER COMMIT POINT (seam 1 — DTO validation)**: `feat(bff): validate modalidad cross-field rules on donacion creation`
(`ts_hornero_bff/src/donaciones/dto/crear-donacion.dto.ts`, `crear-donacion.dto.spec.ts`)

**USER COMMIT POINT (seam 2 — asignaciones route)**: `feat(bff): proxy donation assignment history`
(`ts_hornero_bff/src/donaciones/donaciones.controller.ts`, `donaciones.service.ts`, their specs)

**USER COMMIT POINT (seam 3 — rondas module)**: `feat(bff): expose ronda trigger and history routes`
(`ts_hornero_bff/src/rondas/*`, `ts_hornero_bff/src/app.module.ts`)

## Slice 5e — Nueva donación screen (admin)

Depends on: 5d. Spec: `donacion-fondo-comun`.

- [ ] 5e.1 RED — `ts_hornero_admin/src/routes/nueva-donacion.test.tsx`: choosing `DIRECTA`
      navigates to /explorar without embedding a picker (decision 14); choosing `FONDO_COMUN`
      reveals the required categoria selector and map control before submit; submitting
      `FONDO_COMUN` sends the correct payload shape.
- [ ] 5e.2 RED — `ts_hornero_admin/src/components/donacion/CriteriosAsignacionPanel.test.tsx`:
      renders a static explainer of the 4 (visually; 5th criterion arrives cosmetically in 6b)
      scoring criteria without exposing organizacion-identifying data.
- [ ] 5e.3 GREEN — Create `ts_hornero_admin/src/components/donacion/CriteriosAsignacionPanel.tsx`.
      Satisfies 5e.2.
- [ ] 5e.4 GREEN — Create `ts_hornero_admin/src/routes/nueva-donacion.tsx` (/donar, DONANTE):
      modalidad choice; `FONDO_COMUN` branch with categoria (required) + map pin (reuse
      `OrgLocationPickerLazy`) + observaciones + the criteria panel; `DIRECTA` branch routes to
      /explorar per decision 14 (`necesidad-detalle.tsx` keeps its existing inline-create flow,
      unchanged). Satisfies 5e.1.
- [ ] 5e.5 GREEN — Modify `ts_hornero_admin/src/lib/hooks/useCrearDonacion.ts`: new payload union
      (`DIRECTA` vs `FONDO_COMUN`).
- [ ] 5e.6 GREEN — Modify `ts_hornero_admin/src/types/domain.ts`: `ModalidadDonacion`,
      `FaseDonacion`, nullable `necesidadId`, `organizacionId`.
- [ ] 5e.7 GREEN — `ts_hornero_admin/src/app/router.tsx`, `ts_hornero_admin/src/app/AppShell.tsx`:
      register /donar for DONANTE + nav entry (if not already present via the existing donation
      entry point).

**Verification (slice 5e):** `cd ts_hornero_admin && npm test -- nueva-donacion CriteriosAsignacion && npm run build`

**USER COMMIT POINT**: `feat(admin): add nueva donacion screen with fondo comun modalidad`

## Slice 5f — Progress, detail, admin ronda (admin)

Depends on: 5d. Sub-split per the forecast: **5f-i** (donante-facing progress/detail) then
**5f-ii** (admin ronda screen + nav wiring).

### 5f-i — Donación progress + detail

- [ ] 5f.1 RED — `ts_hornero_admin/src/components/donacion/ProgresoDonacion.test.tsx`: maps every
      `FaseDonacion` value to the correct visual step, distinguishing `EN_FONDO` (unassigned) from
      `ASIGNADA`.
- [ ] 5f.2 RED — `ts_hornero_admin/src/components/donacion/DesgloseScore.test.tsx`: renders each
      per-criterion contribution (`term × weight`) and `deficitFuente`.
- [ ] 5f.3 GREEN — Create `ts_hornero_admin/src/components/donacion/ProgresoDonacion.tsx`.
      Satisfies 5f.1.
- [ ] 5f.4 GREEN — Create `ts_hornero_admin/src/components/donacion/DesgloseScore.tsx`. Satisfies
      5f.2.
- [ ] 5f.5 RED — `ts_hornero_admin/src/lib/hooks/useAsignaciones.test.ts`: fetches
      `GET :id/asignaciones` and exposes the timeline.
- [ ] 5f.6 GREEN — Create `ts_hornero_admin/src/lib/hooks/useAsignaciones.ts`. Satisfies 5f.5.
- [ ] 5f.7 RED — `ts_hornero_admin/src/routes/donacion-detalle.test.tsx`: shows the progress
      (5f.3), modalidad badge, assigned organizacion, ronda date, score breakdown (5f.4), assignment
      timeline; null organizacion renders as "Esperando ronda"; `?nueva=1` shows a success banner.
- [ ] 5f.8 GREEN — Create `ts_hornero_admin/src/routes/donacion-detalle.tsx`
      (/mis-donaciones/:id). Satisfies 5f.7.
- [ ] 5f.9 GREEN — Modify `ts_hornero_admin/src/routes/mis-donaciones.tsx`: modalidad badge, link
      to the detail route, handle a null organizacion gracefully.

**Verification (5f-i):** `cd ts_hornero_admin && npm test -- donacion-detalle Progreso Desglose useAsignaciones mis-donaciones`

**USER COMMIT POINT (5f-i)**: `feat(admin): show fondo comun progress and score breakdown in mis donaciones`

### 5f-ii — Admin ronda screen

- [ ] 5f.10 RED — `ts_hornero_admin/src/lib/hooks/useRondas.test.ts`: query for pool size/history,
      mutation to trigger a ronda, surfaces `409`, `503` distinctly.
- [ ] 5f.11 GREEN — Create `ts_hornero_admin/src/lib/hooks/useRondas.ts`. Satisfies 5f.10.
- [ ] 5f.12 RED — `ts_hornero_admin/src/routes/rondas.test.tsx`: shows pool size and history
      table; "Ejecutar ronda" disabled while a run is pending; `409`, `503` render distinct user
      messages.
- [ ] 5f.13 GREEN — Create `ts_hornero_admin/src/routes/rondas.tsx` (/rondas, ADMINISTRADOR).
      Satisfies 5f.12.
- [ ] 5f.14 GREEN — `ts_hornero_admin/src/app/router.tsx`, `ts_hornero_admin/src/app/AppShell.tsx`:
      register /rondas under the ADMINISTRADOR block + nav entry.

**Verification (5f-ii):** `cd ts_hornero_admin && npm test -- rondas && npm run build`

**USER COMMIT POINT (5f-ii)**: `feat(admin): add admin ronda trigger and history screen`

**USER ACTION (manual end-to-end check before considering slice 5 series done)**: on
`make up-local`, create a `FONDO_COMUN` donación → trigger a ronda as ADMINISTRADOR → accept as the
assigned referente → exchange delivery codes both ways → confirm `ENTREGADA`. No automated E2E
suite exists across services; this manual run is the documented substitute per `design.md`
"Testing Strategy".

## Slice 6a — Worker compliance term

Depends on: 5a (may run in parallel with 5b–5f). Spec: `asignacion-historial-cumplimiento`.

- [ ] 6a.1 RED — `go_algorithms_worker/internal/assign/cumplimiento_test.go`: `p0` computed as the
      ronda-average rate over candidates with history; `p0 = 0.5` when the whole ronda has zero
      history; the smoothed rate formula (`m = 5` pseudo-observations, or the overridden
      `parametros.cumplimientoPrior` in place of `p0`) matches the spec's worked example (8
      entregadas / 1 fallida ⇒ excludes `CANCELADA`, handled MS-side in 6b — this test only checks
      the worker's smoothing math given raw counts).
- [ ] 6a.2 RED — `go_algorithms_worker/internal/assign/scoring_test.go`: `Pesos.Cumplimiento` +
      `Normalizados()` renormalize the five terms; `Cumplimiento = 0` reproduces the four-term
      score exactly (property test against the pre-change formula); accreditation still hard-filters
      via `acepta()`, unaffected by compliance.
- [ ] 6a.3 RED — `go_algorithms_worker/internal/contrato/ronda_v1_test.go`: optional
      `cumplimiento {entregadas, fallidas}` per candidate and optional `pesos.cumplimiento` and
      `parametros.cumplimientoPrior` decode correctly; absent fields default to the neutral-prior
      behavior (candidates without the field get `p0`, per AD-11, satisfying design's note that 5c
      candidates before 6b also default correctly).
- [ ] 6a.4 GREEN — Create `go_algorithms_worker/internal/assign/cumplimiento.go`: `p0` +
      smoothed-rate computation, honoring an optional caller-supplied prior override. Satisfies
      6a.1.
- [ ] 6a.5 GREEN — Modify `go_algorithms_worker/internal/assign/scoring.go`: add
      `Pesos.Cumplimiento`, update `Normalizados()`, new defaults (deficit 0.30, urgencia 0.25,
      proximidad 0.17, espera 0.13, cumplimiento 0.15); add `Candidato.TasaCumplimiento`. Satisfies
      6a.2.
- [ ] 6a.6 GREEN — Modify `go_algorithms_worker/internal/contrato/ronda_v1.go`: optional
      `cumplimiento`, `pesos.cumplimiento`, `parametros.cumplimientoPrior`. Satisfies 6a.3.
- [ ] 6a.7 GREEN — Modify `go_algorithms_worker/testdata/ronda-v1/*`,
      `go_algorithms_worker/contract/ronda-v1.md`: additive fields documented and reflected in the
      golden fixtures (re-copy into `jar_hornero_ms/src/test/resources/contract/` happens in 6b).

**Verification (slice 6a):** `cd go_algorithms_worker && go test ./...`

**USER COMMIT POINT**: `feat(worker): add compliance-history scoring term with neutral prior`

## Slice 6b — MS compliance signal

Depends on: 5c, 6a. Spec: `asignacion-historial-cumplimiento`.

- [ ] 6b.1 RED — `jar_hornero_ms/src/test/.../asignacion/CumplimientoCalculatorTest.java`: a
      grouped count query classifies `ENTREGADA` → entregada, `RECHAZADA` → fallida, and excludes
      every `CANCELADA` and non-terminal donation from both numerator and denominator (matching the
      spec's amended scenario: 8 ENTREGADA + 1 CANCELADA + 1 RECHAZADA ⇒ 8/9, not 8/10).
- [ ] 6b.2 RED — Assertions in `EntradaRondaFactoryTest.java` (extending 5c's factory tests):
      `cumplimiento {entregadas, fallidas}` is attached per candidate in the assembled
      `EntradaRondaV1`.
- [ ] 6b.3 RED — Assertions in `AsignacionTest.java`, `RondaServiceTest.java`: `terminoCumplimiento`
      is persisted on `Asignacion` once the worker response carries a `desglose.cumplimiento` value.
- [ ] 6b.4 GREEN — Create `jar_hornero_ms/.../asignacion/CumplimientoCalculator.java`: one grouped
      query (`org.id, estado, count`) over `donacion` rows with `estado IN (ENTREGADA, RECHAZADA)`
      only. Satisfies 6b.1.
- [ ] 6b.5 GREEN — Modify `jar_hornero_ms/.../domain/DonacionRepository.java`: add the aggregate
      query backing 6b.4.
- [ ] 6b.6 GREEN — Modify `jar_hornero_ms/.../asignacion/EntradaRondaFactory.java`: attach
      `cumplimiento` counts per candidate via `CumplimientoCalculator`. Satisfies 6b.2.
- [ ] 6b.7 GREEN — Modify `jar_hornero_ms/.../domain/Asignacion.java`: persist
      `terminoCumplimiento` (nullable, populated once 6a's response field is present). Satisfies
      6b.3.
- [ ] 6b.8 GREEN — Re-copy the updated `go_algorithms_worker/testdata/ronda-v1/*` fixtures into
      `jar_hornero_ms/src/test/resources/contract/` (per AD-14's "both copies change together"
      rule).
- [ ] 6b.9 GREEN — Modify `ts_hornero_admin/src/components/donacion/DesgloseScore.tsx`,
      `CriteriosAsignacionPanel.tsx`: render the 5th (cumplimiento) criterion.
- [ ] 6b.10 RED/GREEN — Add or extend a vitest assertion in `DesgloseScore.test.tsx` covering the
      5th criterion, then implement 6b.9 to satisfy it (small, may ride together as one commit per
      the design note that this piece "may ride in 6b or a follow-up").

**Verification (slice 6b):**
`cd jar_hornero_ms && mvn test -Dtest=CumplimientoCalculatorTest,EntradaRondaFactoryTest,RondaServiceTest`
`cd ts_hornero_admin && npm test -- Desglose Criterios && npm run build`

**USER COMMIT POINT**: `feat(ms): feed compliance-history counts into the ronda input`

## Slice 7 — Thesis documentation updates (docs only, no source/behavior change)

Depends on: all prior slices being applied (the statements below describe the shipped system).
This slice lists documentation edits the implementation implies; it does not include any of the
edits themselves — the tasks below name what still needs to change in the thesis text and diagrams
once slices 1–6b are done.

- [ ] 7.1 Update `docs/tesis/` (or the specific document `odd/tasks/tesis-documento-der.md` points
      at) to remove any "no está implementado" statement about **asignación priorizada / fondo
      común**, replacing it with a description of the shipped ronda flow (worker HTTP transport,
      manual ADMINISTRADOR trigger, `Asignacion` persistence).
- [ ] 7.2 Update the same thesis document to remove any "no está implementado" statement about
      **trazabilidad / dual confirmation**, replacing it with the mutual delivery-code (QR +
      typed fallback) description, and explicitly noting the retirement of the plain
      `confirmar-entrega` button.
- [ ] 7.3 Add or update the entity-relationship / UML diagrams under `docs/tesis/` (typed
      subfolders per the existing convention) to include the new entities: `Asignacion`, `Ronda`,
      `CodigoEntrega`, and the `ModalidadDonacion`, `FaseDonacion` enums, with their relationships to
      `Donacion`, `Necesidad`, and `Organizacion`.
- [ ] 7.4 Add the documented **known limitation** (AD-2): until the INDEC population CSV is
      sourced and mounted as `POBLACION_CSV`, every ronda candidate resolves to
      `deficitFuente = NEUTRAL`, so the deficit term is currently a constant that does not distort
      ranking. State this explicitly wherever the thesis claims the deficit criterion is "live".
- [ ] 7.5 Update the architecture/sequence diagrams to show `go_algorithms_worker` as a live
      internal compose service (HTTP, no host port) rather than a CLI-only offline tool, per AD-1.
- [ ] 7.6 Update any thesis section listing pending/future work to remove the items now delivered
      by this change (per proposal's "Success Criteria") and to retain the still-open items listed
      in `design.md` under "Operational Preconditions" (INDEC CSV, Pi check-constraint pre-flight,
      V001 script) as explicit deployment prerequisites, not code gaps.
- [ ] 7.7 Cross-check `odd/tasks/tesis-documento-der.md` itself: mark the "compliance-history
      scoring term" item it names as resolved, pointing at `asignacion-historial-cumplimiento` and
      AD-11.

**Verification (slice 7):** manual proofreading pass; no test command applies (docs only).

**USER COMMIT POINT**: `docs(tesis): update thesis document and diagrams for delivered features`
