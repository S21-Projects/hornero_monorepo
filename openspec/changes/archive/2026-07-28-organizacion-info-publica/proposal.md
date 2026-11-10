# Proposal: Public Organization Info (donation badge + external links)

## Intent

A visitor on `/org/{slug}` can only see description, address, map and the internal donation CTA. Organizations that already have their own website or their own donation channel (Mercado Pago, Instagram, bank link) have nowhere to show it, and a visitor cannot tell whether an org is currently receiving donations at all. Three optional fields close that gap. Today nothing can be set either: `ts_hornero_admin` has **no organization edit screen** even though `PATCH /organizaciones/:id` exists in BFF and MS.

## Scope

### In Scope
- MS `Organizacion` + DTOs: `aceptaDonaciones` (Boolean, not null, default `false`), `sitioWebUrl`, `donacionDirectaUrl` (`String`, 500, nullable).
- URL validation at the MS (authority) mirrored in the BFF DTO: absolute URL, `http`/`https` scheme only, max 500 chars. Empty string clears the field.
- BFF passthrough in `crear`/`actualizar`/response mapping.
- Astro public surface: org detail page renders the links + badge; org cards render the badge only.
- `ts_hornero_admin`: a minimal "Mi organización" edit form for the owning referente covering these three fields, on top of the existing `PATCH /organizaciones/:id`.
- Admin can also edit these three fields for any organization from the admin panel (not just the owning referente) — e.g. to correct or remove an incorrect/inappropriate link.
- **Approval gate**: a referente's change to any of these three fields does not go live on the public site immediately — it requires admin approval first, mirroring the spirit of the existing org validation gate. Design phase must pick the concrete mechanism (e.g. a `infoPublicaPendiente` flag holding the last-submitted values until approved, vs. reusing the existing `estado` machine) — decide and justify in `design.md`. Admin-authored edits (see above) do not need self-approval — an admin change is authoritative and goes live immediately.

### Out of Scope
- Hornero processing or tracking donations made through `donacionDirectaUrl` — it is an outbound link, nothing more. No payment integration, no attribution, no click analytics.
- Editing any other organization field (nombre, tipo, direccion, images) from the new form.
- Link liveness checks (whether the URL actually resolves) — only format/scheme validation, not reachability.
- `referentes-organizaciones` concerns (referente 1:N, onboarding, reassignment). That change explicitly deferred these fields.

## Capabilities

### New Capabilities
- `organizacion-info-publica`: optional donation-acceptance flag and external website/donation links on an organization, their validation rules, and their public rendering.
- `organizacion-self-edit`: the owning referente can update their organization's public info from the SPA.

### Modified Capabilities
- None (`openspec/specs/` is empty).

## Approach

Additive columns only — `ddl-auto=update` adds three nullable/defaulted columns with no migration file and no impact on existing rows. `aceptaDonaciones` defaults to `false` so nothing is claimed on an org's behalf.

Spanish domain naming, consistent with `profileImageKey`/`validada`.

**Validation.** The MS is the enforcement authority (`OrganizacionService.actualizar`); the BFF DTO mirrors it with `@IsUrl({ protocols: ['http','https'], require_protocol: true })` for fast feedback. Scheme allowlisting at write time is what prevents `javascript:`/`data:` ever reaching storage.

**Clearing.** `actualizar` is null-means-unchanged (`if (request.getX() != null)`). A referente must be able to remove a link, so `""` is the explicit clear sentinel, normalized to `NULL`. Validation must accept `""` and reject whitespace-only.

**Rendering.** Astro/JSX escape by default; render links as `<a href={org.sitioWebUrl}>` — never `set:html`, never a raw href string built from user input. Add `rel="noopener noreferrer nofollow"` and `target="_blank"` for outbound links. Defense in depth only: storage-time scheme allowlisting is the real control.

**Placement.** Detail page (`ts_hornero_astro/src/pages/org/[slug].astro`) carries all three: `sitioWebUrl` in the "Sobre el comedor" card next to the contact email; `donacionDirectaUrl` as a secondary action inside the existing "¿Querés colaborar?" right-rail card, below the internal "Ir a donar" CTA so the platform flow stays primary; `aceptaDonaciones` as a pill in the hero pill row. Cards (`OrgList.tsx`, `HomeMapExplorer.tsx`) get the badge **only** — the card is a single link to `/org/{slug}`, so nesting outbound anchors inside it would break the click target and dilute the scan-level signal.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `jar_hornero_ms/.../domain/Organizacion.java` | Modified | 3 new columns |
| `jar_hornero_ms/.../organizacion/dto/{Crear,Actualizar}OrganizacionRequest.java`, `OrganizacionResponse.java` | Modified | Fields + URL constraints |
| `jar_hornero_ms/.../OrganizacionService.java` | Modified | Map/patch fields; `""` → `NULL` |
| `ts_hornero_bff/src/organizaciones/dto/*.ts` | Modified | Mirror validation |
| `ts_hornero_astro/src/lib/types.ts` | Modified | `Org` gains 3 optional fields |
| `ts_hornero_astro/src/pages/org/[slug].astro` | Modified | Badge + both links |
| `ts_hornero_astro/src/components/islands/OrgList.tsx`, `HomeMapExplorer.tsx` | Modified | Badge pill only |
| `ts_hornero_admin/src/types/domain.ts` | Modified | `Organizacion`/`OrganizacionAdmin` gain fields |
| `ts_hornero_admin` "Mi organización" route + mutation hook | New | Referente edit form |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Merge conflict with `referentes-organizaciones` on `Organizacion.java` / `domain.ts` / `OrganizacionService` | Med | Purely additive fields, no touched line overlaps its nullable-`referente`/`List` refactor; rebase this change second |
| Link injection / malicious outbound target | Med | `http(s)`-only allowlist at MS write time, escaped attribute binding, `rel="noopener noreferrer nofollow"` |
| Users trust a Hornero-hosted donation link and Hornero cannot mediate disputes | Med | Label the link as external/org-run in the UI copy; keep it visually secondary to the platform CTA |
| New admin edit form grows into a full org editor | Low | Scope the form to the three fields; other fields stay read-only |
| `aceptaDonaciones=false` reads as "rejected/inactive" | Low | Show a positive pill only when `true`; render nothing when `false` |

## Rollback Plan

Revert the change branch. Columns left behind by `ddl-auto=update` are additive and unused by reverted code; drop them manually only if desired. No data migration and no destructive schema step, so rollback is safe at any point.

## Dependencies

- `PATCH /organizaciones/:id` (MS + BFF) already exists with referente-owner enforcement — reused as-is.
- Rebase after `referentes-organizaciones` lands if both are in flight.

## Success Criteria

- [ ] A referente sets, edits, and clears all three fields from `ts_hornero_admin` and sees them persist.
- [ ] `sitioWebUrl`/`donacionDirectaUrl` reject non-`http(s)` schemes (incl. `javascript:`) and whitespace-only values with a 400 at the MS.
- [ ] `""` clears a link to `NULL`; omitting a field leaves it unchanged.
- [ ] An org with no values set renders exactly as it does today — no empty rows, no dead links.
- [ ] `/org/{slug}` renders both links as escaped `<a>` with `rel="noopener noreferrer nofollow"`, and the badge shows only when `aceptaDonaciones` is `true`.
- [ ] Org cards show the badge and remain a single link to `/org/{slug}`.
- [ ] The internal "Ir a donar" CTA remains the primary action on the detail page.

## Decisions (confirmed by user)

1. **Who edits** — both the owning referente (self-service, subject to admin approval before going live) and the admin (direct edit, live immediately, no self-approval).
2. **Moderation** — referente-submitted changes require admin approval before rendering publicly; admin-authored changes do not.

## Proposal question round

Remaining assumptions, not yet confirmed — flag any that are wrong before `sdd-spec`:

3. **Badge semantics** — `aceptaDonaciones` is an org-declared self-service flag, unrelated to `estado`/`validada`, and `false` renders nothing rather than a negative badge.
4. **Link independence** — `donacionDirectaUrl` may be set even when `aceptaDonaciones` is `false` (no cross-field rule).
5. **Scheme policy** — `http` is allowed alongside `https`. Restricting to `https` only is a one-line change if preferred.
