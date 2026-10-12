import { describe, it, expect } from 'vitest';
import type { RouteObject } from 'react-router-dom';
import { router } from './router';

/**
 * Structural tests against the ACTUAL router configuration (not a synthetic
 * ProtectedRoute fixture) — guards against wiring gaps like a route group
 * silently missing `requireValidated`, which ProtectedRoute.test.tsx cannot
 * catch since it only exercises the guard component in isolation.
 */

// Finds the top-level route group (as declared in router.routes) whose
// descendant leaf route matches `targetPath`, then returns that group's
// guard element (e.g. <ProtectedRoute allow={...} requireValidated .../>).
function findGuardElementForPath(routes: RouteObject[], targetPath: string) {
  function hasDescendantPath(route: RouteObject): boolean {
    if (route.path === targetPath) return true;
    return (route.children ?? []).some(hasDescendantPath);
  }

  const group = routes.find(hasDescendantPath);
  return group?.element as React.ReactElement | undefined;
}

describe('router.tsx — real route wiring', () => {
  it('/dashboard is gated by ProtectedRoute with requireValidated (unvalidated REFERENTE must not reach it)', () => {
    const guard = findGuardElementForPath(router.routes, '/dashboard');

    expect(guard).toBeDefined();
    expect((guard!.type as { name?: string }).name).toBe('ProtectedRoute');
    expect(guard!.props).toMatchObject({
      allow: ['REFERENTE'],
      requireValidated: true,
    });
  });

  it('/needs stays gated by ProtectedRoute with requireValidated (regression guard)', () => {
    const guard = findGuardElementForPath(router.routes, '/needs');

    expect(guard).toBeDefined();
    expect((guard!.type as { name?: string }).name).toBe('ProtectedRoute');
    expect(guard!.props).toMatchObject({
      requireValidated: true,
    });
  });

  it('/acreditacion requires the REFERENTE role (evidence self-submission, no org validation required)', () => {
    const guard = findGuardElementForPath(router.routes, '/acreditacion');

    expect(guard).toBeDefined();
    expect((guard!.type as { name?: string }).name).toBe('ProtectedRoute');
    expect(guard!.props).toMatchObject({
      allow: ['REFERENTE'],
    });
  });

  // Amendment D-01 (decisiones-posteriores.md): GET /{id}/legajo admits
  // ADMINISTRADOR and the owning REFERENTE, not admin-only as tasks.md's
  // original wording assumed — the SPA gate must not hide the referente's
  // own-organizacion export behind an admin-only route.
  it('/organizaciones/:id/legajo admits ADMINISTRADOR and REFERENTE (D-01)', () => {
    const guard = findGuardElementForPath(router.routes, '/organizaciones/:id/legajo');

    expect(guard).toBeDefined();
    expect((guard!.type as { name?: string }).name).toBe('ProtectedRoute');
    expect(guard!.props).toMatchObject({
      allow: expect.arrayContaining(['ADMINISTRADOR', 'REFERENTE']),
    });
  });

  // Task 3c.14 — the mobile delivery-confirmation screen is reachable by both parties of a
  // donación (spec `donacion-entrega-codigo`'s "Mobile Delivery Confirmation Screen").
  it('/donaciones/:id/entrega admits DONANTE and REFERENTE, requireVerified', () => {
    const guard = findGuardElementForPath(router.routes, '/donaciones/:id/entrega');

    expect(guard).toBeDefined();
    expect((guard!.type as { name?: string }).name).toBe('ProtectedRoute');
    expect(guard!.props).toMatchObject({
      allow: expect.arrayContaining(['DONANTE', 'REFERENTE']),
      requireVerified: true,
    });
  });

  // Task 4b.6 (AD-8) — the cross-org audit queue screen is ADMINISTRADOR-only, same gate as
  // the other admin-block routes (/panel, /users, /control-donaciones, etc.).
  it('/auditoria is ADMINISTRADOR-only, requireVerified', () => {
    const guard = findGuardElementForPath(router.routes, '/auditoria');

    expect(guard).toBeDefined();
    expect((guard!.type as { name?: string }).name).toBe('ProtectedRoute');
    expect(guard!.props).toMatchObject({
      allow: ['ADMINISTRADOR'],
      requireVerified: true,
    });
  });

  // N10 — the activity log is ADMINISTRADOR-only, like the other admin-block routes.
  it('/actividad is ADMINISTRADOR-only, requireVerified', () => {
    const guard = findGuardElementForPath(router.routes, '/actividad');

    expect(guard).toBeDefined();
    expect((guard!.type as { name?: string }).name).toBe('ProtectedRoute');
    expect(guard!.props).toMatchObject({
      allow: ['ADMINISTRADOR'],
      requireVerified: true,
    });
  });

  // N14 — requesting a reset is for people without a session: PublicOnlyRoute.
  it('/olvide-contrasena is public-only', () => {
    const route = router.routes.find((r) => r.path === '/olvide-contrasena');

    expect(route).toBeDefined();
    expect(((route!.element as React.ReactElement).type as { name?: string }).name).toBe('PublicOnlyRoute');
  });

  // The emailed link must work even if the browser still holds a session: a PublicOnlyRoute
  // would redirect home and drop the token. Completing the reset revokes every session anyway.
  it('/restablecer is not guarded', () => {
    const route = router.routes.find((r) => r.path === '/restablecer');

    expect(route).toBeDefined();
    const name = ((route!.element as React.ReactElement).type as { name?: string }).name;
    expect(name).not.toBe('PublicOnlyRoute');
    expect(name).not.toBe('ProtectedRoute');
  });
});
