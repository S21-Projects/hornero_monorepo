# Design: Public Organization Info (donation badge + external links)

## Baseline (verified in the working tree, not assumed)

`referentes-organizaciones` **MS + BFF slices are already merged**; its SPA slice is not:

| Verified | State |
|---|---|
| `Organizacion.java:54` | `@JoinColumn(name="referente_id", nullable = true)` — applied |
| `OrganizacionService` | `listarPorReferente`, `listarTodas`, `asignarReferente`, cap=3 — applied |
| `OrganizacionController` | `GET /todas`, `PATCH /{id}/referente`, `/mia` returns `List` — applied |
| `OrganizacionResponse` | 15 fields incl. `referenteId` — applied |
| BFF `organizaciones.{controller,service}.ts` | `listarTodas`, `asignarReferente`, `misOrganizaciones` — applied |
| `ts_hornero_admin/src/types/domain.ts` | **NOT applied** — no `estado`/`referenteId` on `Organizacion` |
| `routes/referentes.tsx`, `mis-organizaciones.tsx`, `useMisOrganizaciones` | **do not exist** |

**Live defect discovered**: `useMiOrganizacion.ts` is typed `useQuery<Organizacion>` but `/organizaciones/mia` now returns an **array**. `AuthInitializer` reads `.validada` off an array → `undefined`. This change's referente form depends on that hook, so it must ship `useMisOrganizaciones` (array) if the SPA slice of `referentes-organizaciones` has not landed first.

This design is **purely additive** on top of the above: no signature it touches is one `referentes-organizaciones` still plans to change.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|---|---|---|---|
| D1 | Approval-gate mechanism | **Shadow columns**: 3 live columns + 3 `*_pendiente` mirrors + `info_publica_pendiente_en TIMESTAMP`. Pending exists iff the timestamp is non-null. | (a) reuse `estado`/`validada`; (b) one `jsonb` column; (c) a separate `SolicitudCambio` entity | `estado` gates the *whole org* — using it would un-publish an approved org over a link edit. `jsonb` needs a Hibernate type mapping the MS has nowhere else and buys nothing (never queried). A new entity is a moderation-workflow-sized answer to a 3-field problem. Typed columns are `ddl-auto`-safe and diffable in the admin UI for free. |
| D2 | Pending set is a **snapshot, not a delta** | On any referente write, the service seeds the pending trio from `coalesce(pending, live)` and applies the request on top. All three pending columns always describe the complete proposed state. | Per-field "dirty" flags | With null-means-unchanged, a delta cannot distinguish "no change to this field" from "clear this field to NULL" — a tri-state that needs 3 more columns. A snapshot makes approve a verbatim 3-column copy and makes clearing representable. |
| D3 | Referente vs admin write path | **Separate endpoints.** Referente keeps existing `PATCH /api/organizaciones/{id}` (writes pending). Admin gets `PATCH /api/organizaciones/{id}/info-publica` (writes live, clears pending). | One endpoint branching on the caller's role | Matches the established admin-suffix convention (`/validar`, `/rechazar`, `/referente`) and keeps the 3-layer enforcement declarative: `@PreAuthorize` at the MS, `@Roles(ADMINISTRADOR)` at the BFF, route group in the SPA. Role-branching inside one service method hides the authorization decision in an `if`. |
| D4 | `aceptaDonaciones` nullability | Column **nullable** in DDL; Java field defaults to `false`; `toResponse` coalesces `null → false`. | `@Column(nullable=false)` as the proposal stated | `ddl-auto=update` emits `ALTER TABLE ... ADD COLUMN acepta_donaciones boolean not null`, which **Postgres rejects on a non-empty table** with no DEFAULT. The dev/prod DBs have rows. Nullable + Java-side coalescing gives identical semantics with zero migration risk. |
| D5 | URL validation | Custom `@UrlSegura` / `UrlSeguraValidator` in `org.example.common.validation`. | Hibernate `@URL`; `@Pattern` regex | `@URL`'s `protocol` attribute takes **one** protocol, so http+https is not expressible; it also has no `""`-as-clear affordance. A regex on URLs is a known footgun. |
| D6 | Public exposure of pending values | Two mappers: `toResponse` (public — pending fields nulled) and `toResponseAutenticado` (owner/admin — pending populated). | One mapper + client-side filtering | Unapproved content must not leave the MS on a public path. Server-side gating means an Astro mistake cannot leak it. |
| D7 | Values on `crear` | The 3 fields on `CrearOrganizacionRequest` write **live** columns, no pending set. | Route them through the gate | A new org is `PENDIENTE` and invisible publicly until an admin approves the org itself — the existing gate already covers them. |
| D8 | Admin editing surface | New `routes/organizaciones.tsx` (admin), listing `GET /organizaciones/todas`, with per-org edit + Aprobar/Rechazar. | Extend `/panel`; extend `referentes-organizaciones`' planned `routes/referentes.tsx` | `/panel` is the org-*validation* queue; folding a second, unrelated approval gate into it conflates two state machines with different consequences. `referentes.tsx` **does not exist in the tree** — depending on an unlanded file would block this change, and it is referente-assignment-centric. Both read `/organizaciones/todas`, so a follow-up consolidation is reasonable; keep `referentes.tsx` referente-centric and let it deep-link here. |

## Data Flow

    Referente submit
      InfoPublicaForm ──PATCH /organizaciones/{id}──→ BFF (no @Roles; MS owns it)
        ──→ MS @PreAuthorize(REFERENTE) → actualizar() → owner check
        ──→ seedPendiente() + apply → *_pendiente cols + pendiente_en = now()
        ──→ LIVE COLUMNS UNTOUCHED → public site still shows last-approved

    Admin approve                          Admin direct edit
      PATCH /{id}/info-publica/aprobar       PATCH /{id}/info-publica
        pending → live, pending = NULL         request → live, pending = NULL
                              │
                              ▼
      Astro publicFetch /organizaciones/{slug} → toResponse (live only) → render

## File Changes

### MS (`jar_hornero_ms`)

| File | Action | Description |
|---|---|---|
| `domain/Organizacion.java` | Modify | `acepta_donaciones` (Boolean, nullable, Java default `false`), `sitio_web_url`/`donacion_directa_url` (`@Column(length=500)`), the three `*_pendiente` mirrors, `info_publica_pendiente_en` (`LocalDateTime`) |
| `common/validation/UrlSegura.java` | Create | Constraint annotation, `message = "URL inválida"` |
| `common/validation/UrlSeguraValidator.java` | Create | See Contracts |
| `organizacion/dto/CrearOrganizacionRequest.java` | Modify | 3 fields, `@UrlSegura @Size(max=500)` (D7) |
| `organizacion/dto/ActualizarOrganizacionRequest.java` | Modify | Same 3 fields — referente-submitted, routed to pending |
| `organizacion/dto/ActualizarInfoPublicaRequest.java` | Create | The 3 fields only; admin body |
| `organizacion/dto/OrganizacionResponse.java` | Modify | +3 live, +3 `*Pendiente`, +`infoPublicaPendienteEn`. **Append at the end** — it is an `@AllArgsConstructor` positional DTO |
| `organizacion/OrganizacionService.java` | Modify | `crear` maps live (D7); `actualizar` seeds+writes pending (D2); new `actualizarInfoPublica`, `aprobarInfoPublica`, `rechazarInfoPublica`; `normalizarUrl` helper; split `toResponse` / `toResponseAutenticado` (D6) |
| `organizacion/OrganizacionController.java` | Modify | 3 new `@PreAuthorize("hasRole('ADMINISTRADOR')")` PATCH mappings (D3). No `SecurityConfig` change — PATCH is not in the `permitAll` GET list |

`listarValidadas` / `findBySlugPublic` use `toResponse`; `listarPorReferente` / `listarTodas` / `listarPendientes` / `findBySlug`(owner|admin) use `toResponseAutenticado`.

### BFF (`ts_hornero_bff/src/organizaciones`) — thin proxy

| File | Action | Description |
|---|---|---|
| `dto/crear-organizacion.dto.ts`, `dto/actualizar-organizacion.dto.ts` | Modify | 3 optional fields, validation per Contracts |
| `dto/actualizar-info-publica.dto.ts` | Create | Same 3 fields |
| `organizaciones.service.ts` | Modify | `actualizarInfoPublica`, `aprobarInfoPublica`, `rechazarInfoPublica` — `axiosRef.patch` + `authHeaders` |
| `organizaciones.controller.ts` | Modify | `@Roles(Role.ADMINISTRADOR)` on `PATCH :id/info-publica`, `:id/info-publica/aprobar`, `:id/info-publica/rechazar`. No ordering hazard: `@Get(':slug')` is a GET |

### Astro (`ts_hornero_astro`)

| File | Action | Description |
|---|---|---|
| `src/lib/types.ts` | Modify | `Org` gains `aceptaDonaciones?: boolean`, `sitioWebUrl?: string \| null`, `donacionDirectaUrl?: string \| null` |
| `src/pages/org/[slug].astro` | Modify | (1) hero pill row after the `Validado` pill (`:122-124`): `{org.aceptaDonaciones && <Pill variant="solid" style={{background:'rgba(255,255,255,.22)'}}>Recibe donaciones</Pill>}`. (2) "Sobre el comedor" card (`:151-163`): second flex item beside Contacto, `🌐` tile + `<a href={org.sitioWebUrl} target="_blank" rel="noopener noreferrer nofollow">`. (3) "¿Querés colaborar?" card, **below** `Ir a donar` (`:242`): secondary ghost-styled `<a>` + a `variant="caption"` note that the channel is run by the organization and El Hornero does not intervene |
| `src/components/islands/OrgList.tsx` | Modify | `:25` — append `{org.aceptaDonaciones && <Pill variant="ghost">Recibe donaciones</Pill>}`. Badge only; the card stays a single `<a>` |
| `src/components/islands/HomeMapExplorer.tsx` | Modify | `:76` — same badge next to the tipo pill |

Bindings are JSX attribute expressions (auto-escaped). **No `set:html`. No string-concatenated `href`.**

### Admin SPA (`ts_hornero_admin`)

| File | Action | Description |
|---|---|---|
| `src/types/domain.ts` | Modify | `InfoPublica` + `InfoPublicaPendiente` interfaces; `Organizacion` and `OrganizacionAdmin` extend them. Also lands `estado`/`referenteId` if `referentes-organizaciones` has not |
| `src/lib/hooks/useMisOrganizaciones.ts` | Create | `useQuery<Organizacion[]>`, key `['organizaciones','mias']` — supersedes the broken `useMiOrganizacion` (see Baseline) |
| `src/lib/hooks/useActualizarInfoPublica.ts` | Create | Referente mutation → `PATCH /organizaciones/{id}` |
| `src/lib/hooks/useAdminInfoPublica.ts` | Create | Admin: `actualizar`, `aprobar`, `rechazar`; invalidates `['organizaciones']` |
| `src/lib/hooks/useTodasOrganizaciones.ts` | Create | `GET /organizaciones/todas` (shared with `referentes-organizaciones` — create only if absent) |
| `src/lib/hooks/mapInfoPublicaError.ts` | Create | 400 → "Revisá que los enlaces empiecen con http:// o https://"; 409 → "No hay cambios pendientes" |
| `src/components/org/InfoPublicaForm.tsx` | Create | `{ org, mode: 'referente' \| 'admin' }`. Referente mode pre-fills from the **pending** snapshot when present, shows `Badge tone="warn"` "Cambios pendientes de aprobación" plus a muted line with the currently-public values, and a post-submit note that changes go live after admin review. Admin mode writes live immediately, no badge |
| `src/routes/mi-organizacion.tsx` | Create | REFERENTE; renders one `InfoPublicaForm` per owned org. Component-per-org so `mis-organizaciones.tsx` can embed it later with no rework |
| `src/routes/organizaciones.tsx` | Create | ADMIN (D8); `/organizaciones/todas` list; per-row `InfoPublicaForm mode="admin"` + Aprobar/Rechazar when `infoPublicaPendienteEn != null`; pending-first ordering |
| `src/app/router.tsx` | Modify | `/organizaciones` in the ADMIN group (`:47-59`); `/mi-organizacion` in a REFERENTE group **without** `requireValidated` |
| `src/app/AppShell.tsx` | Modify | Nav entries; pending count on the admin entry |

## Interfaces / Contracts

```java
// UrlSeguraValidator.isValid
// null  -> true  (field omitted = unchanged)
// ""    -> true  (explicit clear sentinel; service normalizes to NULL)
// blank -> false (whitespace-only rejected)
// else  : trim, length <= 500, new URI(v).isAbsolute(),
//         scheme equalsIgnoreCase "http"|"https", host non-blank
//         -> javascript:, data:, file:, mailto: all rejected by allowlist
```

```java
@PatchMapping("/{id}/info-publica")            @PreAuthorize("hasRole('ADMINISTRADOR')")
OrganizacionResponse actualizarInfoPublica(@PathVariable Long id,
                                           @Valid @RequestBody ActualizarInfoPublicaRequest r);
@PatchMapping("/{id}/info-publica/aprobar")    @PreAuthorize("hasRole('ADMINISTRADOR')")
OrganizacionResponse aprobarInfoPublica(@PathVariable Long id);   // 409 if nothing pending
@PatchMapping("/{id}/info-publica/rechazar")   @PreAuthorize("hasRole('ADMINISTRADOR')")
OrganizacionResponse rechazarInfoPublica(@PathVariable Long id);  // 409 if nothing pending
```

```java
// OrganizacionService — pending write (D2)
private void seedPendiente(Organizacion o) {
    if (o.getInfoPublicaPendienteEn() == null) {   // snapshot current live state
        o.setAceptaDonacionesPendiente(o.getAceptaDonaciones());
        o.setSitioWebUrlPendiente(o.getSitioWebUrl());
        o.setDonacionDirectaUrlPendiente(o.getDonacionDirectaUrl());
    }
}
private static String normalizarUrl(String v) {   // "" and blank -> NULL
    return (v == null || v.isBlank()) ? null : v.trim();
}
```

```ts
// BFF DTO — mirrors the MS allowlist for fast feedback; the MS is the authority
@IsOptional() @MaxLength(500)
@ValidateIf((_o, v) => v !== '')
@IsUrl({ protocols: ['http', 'https'], require_protocol: true })
sitioWebUrl?: string;

@IsOptional() @IsBoolean() aceptaDonaciones?: boolean;
```

```ts
// ts_hornero_admin/src/types/domain.ts
export interface InfoPublica {
  aceptaDonaciones: boolean;
  sitioWebUrl?: string | null;
  donacionDirectaUrl?: string | null;
}
export interface InfoPublicaPendiente {
  aceptaDonacionesPendiente?: boolean | null;
  sitioWebUrlPendiente?: string | null;
  donacionDirectaUrlPendiente?: string | null;
  infoPublicaPendienteEn?: string | null;   // non-null => pending review
}
```

## What each actor sees

| Actor | Never approved | Pending edit outstanding | After approval |
|---|---|---|---|
| Public (Astro) | Nothing rendered — no empty rows, no dead links | **Last-approved values** (or nothing) — pending never leaves the MS (D6) | New values |
| Referente (SPA) | Empty form | Form pre-filled with the submitted snapshot + `warn` badge "Cambios pendientes de aprobación" + muted "Actualmente público: …" | Badge gone, form = live values |
| Admin (SPA) | Editable form, no pending block | Pending-vs-live diff + Aprobar / Rechazar; direct edit still available and clears the pending set | Editable form |

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (MS) | `UrlSeguraValidator`: `javascript:`, `data:`, `file:`, `//host`, `"   "`, 501 chars → invalid; `null`, `""`, `http://`, `HTTPS://` → valid. `actualizar` never touches live columns; snapshot seeding is idempotent across two consecutive referente edits; `""` → NULL inside the snapshot; `aprobar` copies all 3 and nulls the timestamp; `aprobar`/`rechazar` with no pending → 409; `actualizarInfoPublica` clears pending; `toResponse` nulls pending fields while `toResponseAutenticado` keeps them | JUnit + Mockito, mirroring `OrganizacionServiceTest` |
| Unit (BFF) | DTO accepts `''` and rejects `javascript:alert(1)`; the 3 new routes forward the Bearer header | Jest, mirroring `organizaciones.service.spec.ts` |
| Unit (SPA) | `InfoPublicaForm` referente mode renders the pending badge and pre-fills from the snapshot; admin mode does not; `mapInfoPublicaError` 400/409 | Vitest + RTL |
| Integration | Boot on a **fresh volume and the existing dev DB** — confirm `ddl-auto=update` adds all 7 columns with no `NOT NULL` failure (D4) | `docker compose down -v && make up`, then `\d organizaciones` |
| Build | `npm run build` (`tsc -b`) in `ts_hornero_admin` **and** `ts_hornero_astro` — the `Org`/`Organizacion` widening is compile-checked, not covered by unit tests | Project convention |
| Manual | `/org/{slug}` for an org with zero values renders byte-identically to today | Visual diff |

## Migration / Rollout

No migration file — 7 additive columns via `ddl-auto=update`, all nullable (D4). Order: MS → BFF → SPA/Astro. The MS response gains fields only (positional `@AllArgsConstructor` extended at the end), so BFF and Astro keep working un-rebuilt; only the new UI needs the SPA/Astro rebuild. Note `PUBLIC_BFF_URL`/`VITE_BFF_URL` are build-time — unchanged here. Rollback = revert the branch; the orphan columns are inert.

## Open Questions

- [ ] Rejecting a pending set discards it silently — the referente sees the badge disappear with no reason. Add an optional `motivoRechazo` (one more column + a textarea), or accept silent discard for the first slice? Design assumes **silent discard**, as the proposal scoped no notification channel.
- [ ] Should an admin's direct edit while a referente's pending set is outstanding discard that set (current design) or preserve it for separate review? Design assumes **discard** — the admin edit is authoritative and the referente resubmits if needed.
- [ ] Merge order with `referentes-organizaciones`' SPA slice: if it lands first, `useMisOrganizaciones`/`useTodasOrganizaciones`/`domain.ts` become no-ops here; if not, this change ships them.
