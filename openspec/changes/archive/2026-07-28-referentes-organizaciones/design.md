# Design: Referente ↔ Organizacion 1:N and Onboarding Repair

## Technical Approach

The entity graph is already correct (`@ManyToOne`); the 1:1 assumption lives entirely in
application code. This change removes it layer by layer, MS contract first: repository returns
`List`, ownership checks traverse `Organizacion.referente` instead of re-querying "the" org,
and every referente-scoped write carries an explicit `organizacionId`. BFF stays a thin proxy.
The SPA gains an org-selection concept, a restored registration step, and an admin assignment
section.

## Architecture Decisions

| # | Decision | Choice | Alternatives rejected | Rationale |
|---|----------|--------|----------------------|-----------|
| D1 | Schema delta for nullable `referente_id` | **No DDL change required.** `@JoinColumn(name = "referente_id")` in `Organizacion.java:53-55` has no `nullable = false`, and there is no `@Column(nullable=false)` on the field — JPA defaults to nullable, so Hibernate already created the column as `NULL`-able. We only make it explicit (`nullable = true`) for readability. | Flyway/Liquibase introduction; manual `ALTER TABLE` | `ddl-auto=update` is additive-only: it never relaxes a `NOT NULL`. Because the column was never `NOT NULL`, there is nothing to relax. Verify on a fresh volume (`docker compose down -v && make up`) and against the existing dev DB with `\d organizaciones`. If any environment shows `NOT NULL`, a one-off `ALTER TABLE organizaciones ALTER COLUMN referente_id DROP NOT NULL` is needed — Hibernate will not do it. |
| D2 | Referente-scoped ownership resolution | Traverse the loaded aggregate: `necesidad.getOrganizacion().getReferente()` / `donacion.getNecesidad().getOrganizacion().getReferente()`, null-guarded. Writes that need a *target* org take an explicit `organizacionId` validated with `findByIdAndReferente_Id`. | Keep repository lookup and "pick the first org"; pass org id in a header | Traversal is O(1), null-safe by construction, and works when a referente owns N orgs. "First org" silently writes to the wrong organization. |
| D3 | Deactivation cascade | Imperative, in-transaction, inside `UsuarioService.toggleActivo` (inject `OrganizacionRepository`). | Spring `ApplicationEventPublisher` + `@TransactionalEventListener` | The MS has **zero** event infrastructure today; introducing it for one rule is unjustified. `AFTER_COMMIT` listeners also violate the proposal's "same transaction" requirement. One `@Transactional` method gives atomicity for free and matches the codebase's direct-repository service style. |
| D4 | Cap accounting | Cap = 3, counted over `estado != RECHAZADA`. Enforced in `OrganizacionService.crear`, returns **409 CONFLICT**. Also re-checked in the admin reassign path. | Count all rows incl. RECHAZADA; enforce in the controller; 400/422 | A rejected proposal must not permanently burn a slot. Service-layer enforcement covers both entry points (registration and self-service) with one check. 409 = state conflict; the SPA disambiguates with a dedicated error mapper (see D6). |
| D5 | Admin assignment data source | Two flat calls the SPA joins client-side: `GET /usuarios` (already used by `/users`) + a new admin `GET /organizaciones/todas`; add nullable `referenteId` to `OrganizacionResponse`. | Aggregate `ReferenteConOrganizaciones` DTO; per-referente `GET /organizaciones?referenteId=` (N+1) | No new aggregate shape, no N+1, reuses an endpoint the admin bundle already loads. `referenteId` is needed by the SPA anyway to distinguish assigned from unassigned. |
| D6 | Error surfacing for the cap | New `mapCrearOrganizacionError.ts`; leave `mapOrganizacionError.ts` alone. | Overload `mapOrganizacionError` | `mapOrganizacionError` already maps 409 → "Esta organización ya fue procesada" (validate/reject flow). Per-flow mappers are the established pattern (`mapNecesidadError`, `mapUsuarioError`). |
| D7 | Reactivating a referente | Does **not** restore assignments. | Restore prior `referente_id` | Orgs may have been reassigned in the meantime; restoring would silently create conflicts. Admin re-assigns explicitly. |

## Data Flow

Referente creates a need for a specific org:

    needs.tsx (org selector) ──POST /necesidades {organizacionId,…}──→ BFF NecesidadesController
       (thin proxy, cookie→Bearer)  ──→ MS NecesidadController ──→ NecesidadService.crear
       ──→ findByIdAndReferente_Id(organizacionId, referenteId)  → 403 if not owned

Admin reassigns / unassigns:

    /referentes (SPA) ──PATCH /organizaciones/{id}/referente {referenteId|null}──→ BFF
       @Roles(ADMINISTRADOR) ──→ MS @PreAuthorize("hasRole('ADMINISTRADOR')")
       ──→ OrganizacionService.asignarReferente → validates target is active REFERENTE + cap

Public path (unchanged, verified):

    Astro /organizaciones ──publicFetch('/organizaciones')──→ BFF @Public GET /organizaciones
       ──→ MS GET /api/organizaciones ──→ listarValidadas() → findByEstado(APROBADA)

`listarValidadas` filters on `estado` only — never on `referente`. `toResponse`
(`OrganizacionService.java:165-168`) already null-guards `getReferente()`. Astro's `Org` type
(`ts_hornero_astro/src/lib/types.ts:16-17`) declares `referenteNombre?`/`referenteEmail?` as
optional and `org/[slug].astro:151` renders the contact block conditionally. **No Astro change
is required**; unassigned orgs already render correctly. Add a regression test rather than code.

## File Changes

### MS (`jar_hornero_ms`)

| File | Action | Description |
|------|--------|-------------|
| `domain/Organizacion.java` | Modify | `@JoinColumn(name = "referente_id", nullable = true)` — explicit, no DDL delta (D1) |
| `domain/OrganizacionRepository.java` | Modify | `List<Organizacion> findByReferente_Id(Long)`; add `Optional<Organizacion> findByIdAndReferente_Id(Long,Long)`, `long countByReferente_IdAndEstadoNot(Long,EstadoOrganizacion)`, `List<Organizacion> findByReferenteIsNull()` |
| `organizacion/OrganizacionService.java` | Modify | `findByReferente` → `List<OrganizacionResponse> listarPorReferente(Long)` returning `[]` (no 404); `crear` gains cap check; new `asignarReferente`, `listarTodas` |
| `organizacion/OrganizacionController.java` | Modify | `/mia` returns `List`; new `PATCH /{id}/referente`, `GET /todas` (admin) |
| `organizacion/dto/AsignarReferenteRequest.java` | Create | `Long referenteId` (nullable = unassign) |
| `organizacion/dto/OrganizacionResponse.java` | Modify | Add nullable `Long referenteId` |
| `necesidad/dto/CrearNecesidadRequest.java` | Modify | Add `@NotNull Long organizacionId` |
| `necesidad/NecesidadService.java` | Modify | `crear` resolves via `findByIdAndReferente_Id` (:30); `checkOwnership` traverses the aggregate (:86) |
| `donacion/DonacionService.java` | Modify | `findByMiOrganizacion` → `findDeMisOrganizaciones(referenteId, @Nullable orgId)` (:73); `actualizarEstado` traverses the aggregate (:84) |
| `donacion/DonacionController.java` | Modify | `/mi-organizacion` accepts optional `?organizacionId=` |
| `user/UsuarioService.java` | Modify | Inject `OrganizacionRepository`; on `activo=false` + `instanceof Referente`, null out `referente` on all their orgs in the same tx (D3) |
| `config/SecurityConfig.java` | Unchanged | `PATCH` is not in the `permitAll` GET list; `@EnableMethodSecurity` + `@PreAuthorize` is the authority |

### BFF (`ts_hornero_bff`) — thin proxy only

| File | Action | Description |
|------|--------|-------------|
| `organizaciones/organizaciones.service.ts` | Modify | `miOrganizacion` → `misOrganizaciones` (array); add `asignarReferente(id, dto, token)`, `listarTodas(token)` |
| `organizaciones/organizaciones.controller.ts` | Modify | `GET mia` returns array; `@Roles(ADMINISTRADOR) PATCH :id/referente`; `@Roles(ADMINISTRADOR) GET todas` — declare **before** `@Get(':slug')` |
| `organizaciones/dto/asignar-referente.dto.ts` | Create | `@ValidateIf(o => o.referenteId !== null) @IsInt() referenteId: number \| null` |
| `necesidades/dto/crear-necesidad.dto.ts` | Modify | Add `@IsInt() organizacionId` |
| `upload/upload.controller.ts:87-90` | Modify | `assertOwnership`: `orgs.some(o => o.id === orgId)` instead of `org.id !== orgId` — **breaks silently otherwise** |
| `donaciones/donaciones.{controller,service}.ts` | Modify | Forward optional `organizacionId` query param |

### Admin SPA (`ts_hornero_admin`)

| File | Action | Description |
|------|--------|-------------|
| `types/domain.ts:30-35` | Modify | `Organizacion`: add `estado`, `referenteId?: number \| null` |
| `types/domain.ts:98-113` | Modify | `OrganizacionAdmin`: `referenteId?: number \| null`; `referenteNombre`/`referenteEmail` become optional (unassigned orgs) |
| `lib/hooks/useMiOrganizacion.ts` | Modify | → `useMisOrganizaciones`, `useQuery<Organizacion[]>`, key `['organizaciones','mias']` |
| `lib/hooks/useTodasOrganizaciones.ts` | Create | Admin list for the assignment view |
| `lib/hooks/useAsignarReferente.ts` | Create | Mutation; invalidates `['organizaciones']` and `['usuarios']` |
| `lib/hooks/useCrearOrganizacion.ts` | Create | Shared by registration and self-service |
| `lib/hooks/mapCrearOrganizacionError.ts` | Create | 409 → "Alcanzaste el máximo de 3 organizaciones" (D6) |
| `components/AuthInitializer.tsx:38-50` | Modify | `orgValidada = orgs.some(o => o.validada)`; `orgChecked` still set on success **or** error. `validada` is real JSON — `OrganizacionResponse.isValidada()` serializes it |
| `store/auth.store.ts` | Modify | Add `orgCount: number` so `/pending-validation` can offer "create your organizacion" when count is 0 |
| `routes/register.tsx` | Modify | `Step` → `'role' \| 'account' \| 'org' \| 'done' \| 'org-error'`. Sequence: `POST /auth/register` → `login()` → `POST /organizaciones`. Org step mirrors the deprecated `ts_hornero_app/src/app/register/page.tsx:417-556` (tipo, direccion, descripcion, lat/lng picker) and its `org-error` retry (:606) — UX reference only, React 19 / react-router implementation |
| `routes/pending-validation.tsx` | Modify | If `orgCount === 0`, render a resumable "Crear tu organización" CTA instead of the waiting copy |
| `routes/mis-organizaciones.tsx` | Create | Referente self-service: list own orgs, "Agregar organización" disabled at 3 |
| `routes/referentes.tsx` | Create | Admin: referentes (from `/usuarios` filtered to `REFERENTE`) joined with `/organizaciones/todas`; "Sin referente" bucket flagged; reassign action |
| `routes/needs.tsx` | Modify | Org selector when the referente owns >1 org; pass `organizacionId` to `useCrearNecesidad` |
| `app/router.tsx` | Modify | `/referentes` inside the existing `ProtectedRoute allow={['ADMINISTRADOR']}` group (:47-59); `/mis-organizaciones` inside the REFERENTE group **without** `requireValidated` |
| `app/AppShell.tsx` | Modify | Nav entries for the two new routes |

### Astro (`ts_hornero_astro`)

No changes. Verified above; covered by a regression test only.

## Interfaces / Contracts

```java
// MS — new admin endpoint
@PatchMapping("/{id}/referente")
@PreAuthorize("hasRole('ADMINISTRADOR')")
public OrganizacionResponse asignarReferente(@PathVariable Long id,
                                             @Valid @RequestBody AsignarReferenteRequest request);
// referenteId == null  → unassign (referente_id = NULL)
// referenteId != null  → 404 if user missing, 400 if not a Referente, 409 if inactive
//                        or if the target already holds 3 non-RECHAZADA orgs
```

```java
// MS — /mia becomes list-returning; empty list, never 404
@GetMapping("/mia")
@PreAuthorize("hasRole('REFERENTE')")
public List<OrganizacionResponse> misOrganizaciones();
```

```ts
// SPA
export interface Organizacion {
  id: number; slug: string; nombre: string; validada: boolean;
  estado: EstadoOrganizacion; referenteId?: number | null;
}
```

**Reserved-slug hazard**: `GET /api/organizaciones/{slug}` is declared after the literal mappings,
so `mia`, `pendientes`, and the new `todas` are unreachable as slugs. Pre-existing; `generateSlug`
should reject that reserved set (note for tasks, not in scope here).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (MS) | Cap at 3 (RECHAZADA excluded); `crear` with a foreign `organizacionId` → 403; ownership traversal with `referente == null` → 403; `asignarReferente` null/valid/inactive/over-cap; `toggleActivo(false)` unassigns all orgs of a Referente and leaves other roles untouched | JUnit + Mockito, mirroring `OrganizacionServiceTest` |
| Unit (BFF) | `assertOwnership` with an array; reassign forwards the Bearer header | Jest, mirroring `donaciones.service.spec.ts` |
| Unit (SPA) | `mapCrearOrganizacionError`; `AuthInitializer` with `[]` / all-PENDIENTE / one-APROBADA; register `org-error` retry path | Vitest + RTL |
| Integration | `GET /organizaciones` returns an org with `referente_id IS NULL`; boot against a fresh volume and confirm no DDL error | Spring `@SpringBootTest` + manual `make up` on a wiped volume |
| Build | `npm run build` (`tsc -b`) in `ts_hornero_admin` — the type widening must be compile-checked, not just unit-tested | Per project convention |

## Migration / Rollout

No data migration (no real data). No DDL delta expected (D1) — **must be verified empirically on
both a fresh volume and the existing dev DB before the MS slice is merged**. Rollout order is
MS → BFF → SPA; the MS `/mia` shape change is breaking, so BFF and SPA must ship in the same
release train. Rollback = revert the branch; only safe while no row has `referente_id IS NULL`.

## Open Questions

- [ ] Should the referente-facing `POST /necesidades` accept `organizacionId` as required
      immediately, or default to the sole org when the referente owns exactly one (softer
      migration for any existing client)? Design assumes **required** — explicit beats implicit.
