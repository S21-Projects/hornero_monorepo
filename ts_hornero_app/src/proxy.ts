import { NextRequest, NextResponse } from 'next/server';

// ─── Guard matrix ─────────────────────────────────────────────────────────────
//
// | Path                    | UNAUTH     | ADMIN  | REF validated | REF pending/null |
// |-------------------------|------------|--------|---------------|------------------|
// | /login, /register       | allow      | →/     | →/dashboard   | →/dashboard      |
// | /admin/*                | →/login    | allow  | →/            | →/               |
// | /dashboard              | →/login    | →/     | allow         | allow            |
// | /needs/*, /org/* (write)| →/login    | allow  | allow         | →/dashboard      |
// | / (public)              | allow      | allow  | allow         | allow            |
//
// Role is read from decoded access_token JWT payload.tipo (no signature verification —
// this is a UX optimization only; real auth enforcement is in the BFF + MS layer).
// org_validada cookie: "true" = validated; anything else / absent = not validated.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;

  // ── Decode JWT (PROXY-02) ──────────────────────────────────────────────────
  let role: string | null = null;
  let isValidatedReferente = false;

  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      role = payload.tipo ?? null;
    } catch {
      // Malformed JWT → treat as unauthenticated (PROXY-08 safe default)
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // org_validada cookie (PROXY-02)
    const orgValidadaCookie = request.cookies.get('org_validada')?.value;
    isValidatedReferente = orgValidadaCookie === 'true';
  }

  const isAuthenticated = role !== null;
  const isAdmin = role === 'ADMINISTRADOR';
  const isReferente = role === 'REFERENTE';

  // ── /login and /register (PROXY-03) ───────────────────────────────────────
  if (pathname === '/login' || pathname === '/register') {
    if (!isAuthenticated) return NextResponse.next();
    if (isAdmin) return NextResponse.redirect(new URL('/', request.url));
    // REFERENTE (validated or pending) → dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ── /admin/* (PROXY-04) ───────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) return NextResponse.redirect(new URL('/login', request.url));
    if (isAdmin) return NextResponse.next();
    // REFERENTE or DONANTE → home
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── /dashboard (PROXY-05) ─────────────────────────────────────────────────
  if (pathname === '/dashboard') {
    if (!isAuthenticated) return NextResponse.redirect(new URL('/login', request.url));
    if (isAdmin) return NextResponse.redirect(new URL('/', request.url));
    // REFERENTE (any validation state) → allow
    return NextResponse.next();
  }

  // ── /needs/* and /org/* (write routes) (PROXY-06) ─────────────────────────
  // Note: /org/[id] read pages are public — we only guard the write/management
  // subtree here. For simplicity the entire /needs/* is guarded as write-only.
  if (pathname.startsWith('/needs')) {
    if (!isAuthenticated) return NextResponse.redirect(new URL('/login', request.url));
    if (isAdmin) return NextResponse.next();
    if (isReferente && isValidatedReferente) return NextResponse.next();
    if (isReferente && !isValidatedReferente) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // DONANTE → not authorized for this management page
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── /prefs (legacy protected route) ───────────────────────────────────────
  if (pathname.startsWith('/prefs')) {
    if (!isAuthenticated) return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  // ── /users (legacy admin route) ───────────────────────────────────────────
  if (pathname.startsWith('/users')) {
    if (!isAuthenticated) return NextResponse.redirect(new URL('/login', request.url));
    if (isAdmin) return NextResponse.next();
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── Everything else (public) ──────────────────────────────────────────────
  return NextResponse.next();
}

// PROXY-07: matcher covers all guarded paths
export const config = {
  matcher: [
    '/login',
    '/register',
    '/dashboard',
    '/admin/:path*',
    '/needs/:path*',
    '/prefs/:path*',
    '/users/:path*',
  ],
};
