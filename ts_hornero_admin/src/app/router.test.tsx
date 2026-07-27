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
});
