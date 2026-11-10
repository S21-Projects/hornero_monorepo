# Proposal: Referente ↔ Organizacion 1:N and Onboarding Repair

## Intent

A new `REFERENTE` today registers, logs in, and is trapped: the org-creation step that existed in the deprecated Next.js app was dropped from `ts_hornero_admin/src/routes/register.tsx`, so `GET /organizaciones/mia` 404s and `ProtectedRoute` parks them on `/pending-validation` with no way out. Separately, the code assumes one `Organizacion` per `Referente` (singular `Optional` in repository + 3 MS services), while the business reality is one referente managing several organizations, and admins needing to reassign an organization when a referente leaves.

## Scope

### In Scope
- Restore org creation in referente registration (role → account → organizacion → success), reusing the old flow's map picker (lat/lng), tipo, direccion, descripcion, and its partial-failure retry when account succeeds but org creation fails.
- Turn the de-facto 1:1 into a real 1:N: list-returning repository/services/controller in the MS, BFF passthrough, and admin SPA types.
- New admin panel section: browse referentes with their managed organizations, and reassign an organization to a different referente or leave it unassigned.

### Out of Scope
- Organization badges, website, and donation links (item 3 of the original request).
- Migration tooling / backfill: no real data exists yet.

## Capabilities

### New Capabilities
- `referente-onboarding`: registration must end with the referente owning at least one `Organizacion`, including partial-failure recovery.
- `referente-organizacion-assignment`: a `Referente` may hold N organizations; an `Organizacion` has at most one referente.
- `admin-referente-management`: admin views referente→orgs and reassigns ownership.

### Modified Capabilities
- None (no existing `openspec/specs/`).

## Approach

Keep `Organizacion.referente` as `@ManyToOne` — it is already the correct 1:N mapping; the bug is in application code, not the entity graph. Remove the singular assumption: `findByReferente_Id` returns a `List`, `/api/organizaciones/mia` returns an array, and `NecesidadService` / `DonacionService` resolve an explicit organization id instead of "the" org.

Make `referente_id` nullable and add an explicit **unassigned** state. Reasoning: reassignment must not require a replacement referente to already exist — admins already deactivate users from `/users`, so forcing referente→referente handoff would block that operation. Unassigned orgs stay visible to admins, flagged in the panel, and are excluded from referente-scoped writes.

Registration stays exactly one org (the first). A referente may additionally self-service create up to a **cap of 3 organizations total** from the SPA; every new organization (the first at registration and any subsequent one) goes through the existing `validada`/`estado` approval flow (`OrganizacionService`, `/panel` validate/reject) before it is publicly visible — no new approval mechanism is introduced, the cap and the self-service creation route just feed the existing one.

An organization left **unassigned** (referente deactivated or explicitly unassigned by an admin) remains **publicly visible** on the Astro site — it is still a validated organization, just without an active point of contact; hiding it would remove a legitimate need from public view during the reassignment window. It stays flagged/highlighted in the admin panel as needing reassignment.

Deactivating a referente from `/users` **auto-unassigns** all of their organizations in the same transaction (`referente_id` → `NULL`, org enters the unassigned state) rather than requiring the admin to unassign each one by hand first — consistent with treating deactivation as the trigger for the "orphaned org" workflow the admin panel exists to handle.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `jar_hornero_ms/.../domain/Organizacion.java` | Modified | `referente` becomes nullable |
| `.../OrganizacionRepository` + `OrganizacionService:118-122` | Modified | `Optional` → `List` |
| `.../NecesidadService:30,86`, `.../DonacionService:73,84` | Modified | Explicit org id resolution |
| `.../OrganizacionController` | Modified | `/mia` returns a list; reassign endpoint |
| `ts_hornero_bff/src/organizaciones/*` | Modified | Proxy new shapes + reassign |
| `ts_hornero_admin/src/routes/register.tsx` | Modified | Re-add organizacion step |
| `ts_hornero_admin/src/types/domain.ts:30-35,98-113` | Modified | Single-object → collection |
| `ts_hornero_admin` admin panel | New | Referentes + orgs view, reassignment |

Note: `/admin` is a metrics dashboard (`admin.tsx`, charts over pendientes + usuarios); `/panel` is validate/reject. Neither covers assignment — the new section is genuinely new.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Blast radius: 3 MS services + BFF + SPA types change together | High | Slice per layer; MS contract first, then BFF, then SPA |
| `ddl-auto=update` auto-migrates a nullable `referente_id` with no migration file | Med | Design phase must state the schema delta explicitly and verify against a fresh volume |
| Consumers silently break on null referente | Med | Compile-time: `List`/nullable types force call sites; add MS tests per service |
| Registration partial failure leaves an account with no org again | Med | Retry UI + a resumable "create your organizacion" entry from `/pending-validation` |

## Rollback Plan

Revert the change branch. Schema rollback = re-tighten `referente_id` to `NOT NULL`; safe only while no unassigned rows exist, so verify before reverting. No data migration is needed (environment has no real data).

## Dependencies

- `POST /api/organizaciones` (`OrganizacionController.java:29-37`) already works for the referente-driven creation path (registration and self-service); reused as-is, now callable more than once per referente up to the cap of 3.
- The existing `validada`/`estado` approval flow (`OrganizacionService`, `/panel` validate/reject) is reused unchanged for every new organization, whether created at registration or via self-service.

## Success Criteria

- [ ] A new referente completes registration and lands on a working dashboard, never `/pending-validation` with no org.
- [ ] If org creation fails after account creation, the user can retry without re-registering.
- [ ] A referente with 2 organizations sees and operates both; necesidades/donaciones resolve per organization.
- [ ] An admin can view any referente's organizations and reassign one to another referente.
- [ ] An org whose referente is removed becomes unassigned, remains admin-visible (flagged) and remains publicly visible on Astro.
- [ ] A referente can self-service create additional organizations up to a hard cap of 3 total; each goes through the existing approval flow before going live.
- [ ] Deactivating a referente from `/users` auto-unassigns all their organizations in the same operation.
- [ ] DONANTE registration is unchanged.

## Decisions (confirmed by user)

1. **Referente self-service second/third org** — allowed, capped at 3 organizations per referente, each new org subject to the existing validation/approval flow (no new approval mechanism).
2. **Unassigned orgs and public visibility** — stay visible on the public Astro site while unassigned.
3. **Referente deactivation semantics** — auto-unassigns all of the referente's organizations.
