# Security finding: `access_token` cookie is not `httpOnly`

**Severity:** Medium–High (XSS token theft)
**Status:** Resolved
**Component:** `ts_hornero_bff`
**File:** `src/auth/auth.service.ts` → `setCookies()`

## Problem

The BFF sets the `access_token` cookie with `httpOnly: false`:

```ts
res.cookie('access_token', accessToken, {
  httpOnly: false,   // <-- readable by client-side JavaScript
  sameSite: 'strict',
  secure: isProd,
  maxAge: 900 * 1000,
});
```

Because the cookie is not `httpOnly`, any JavaScript running in the page can read
it via `document.cookie`. This defeats the main reason for keeping the JWT in a
cookie instead of `localStorage`: protection against XSS token theft.

The result is the worst of both worlds:

- **Exposed to XSS** — like `localStorage`, an injected script can read and
  exfiltrate the token silently.
- **Exposed to CSRF** — like any cookie, the browser sends it automatically
  (this is mitigated here by `SameSite=strict`).

The `refresh_token` cookie is correctly set with `httpOnly: true`.

## Why the fix is safe (no client reads the token via JS)

Every reader of `access_token` runs **server-side**, where `httpOnly` cookies are
fully readable. `httpOnly` only blocks the browser's `document.cookie`, not
server-side access.

Confirmed readers:

| Reader | Context | Reads via |
|--------|---------|-----------|
| `ts_hornero_app/src/proxy.ts` | Next.js middleware (server/edge) | `request.cookies.get('access_token')` |
| `ts_hornero_app/src/lib/serverFetch.ts` | Server | cookie store |
| `ts_hornero_bff` JwtStrategy | Server | `req.cookies.access_token` |

The only client-side `document.cookie` usage in the frontend
(`AuthInitializer.tsx`) reads `org_validada`, **not** `access_token`.

Conclusion: flipping `httpOnly` to `true` closes the XSS hole without breaking
the middleware guards, server fetches, or the BFF auth.

## Fix

In `ts_hornero_bff/src/auth/auth.service.ts`, `setCookies()`:

```diff
 res.cookie('access_token', accessToken, {
-  httpOnly: false,
+  httpOnly: true,
   sameSite: 'strict',
   secure: isProd,
   maxAge: 900 * 1000,
 });
```

## Verification after the fix

1. `proxy.ts` redirects still work (role decoded from the JWT for routing).
2. Server-rendered pages via `serverFetch.ts` still authenticate.
3. Protected BFF endpoints (`/auth/me`, `/organizaciones/*`) still return 200
   with a valid session.
4. In the browser console, `document.cookie` no longer shows `access_token`.

## Notes

- `SameSite=strict` is the strongest CSRF mitigation but drops the cookie on
  cross-site top-level navigations (e.g. following an external link into the
  app shows the user as logged out until they navigate internally). Switch to
  `lax` only if that UX cost matters.
- The Bruno collection in `bruno/` parses `access_token` from `Set-Cookie` in a
  post-response script. That parsing reads the HTTP response header, not
  `document.cookie`, so it keeps working after this fix — no change needed.

## Refresh-token rotation and revocation

Refresh tokens are tracked server-side in the MS (`refresh_tokens`: `jti`, family, expiry,
`rotatedAt`, `revokedAt`; never the raw token). A login starts a family; every `/auth/refresh`
marks the presented token as rotated and issues a successor in the same family.

- Replaying a rotated token after the grace window (`app.jwt.refresh-reuse-grace-seconds`,
  default 30s, covers several tabs sharing cookies) is treated as theft: the whole family is
  revoked and the request gets 401.
- `POST /auth/logout` (BFF) revokes the family at the MS (`POST /api/auth/logout`, always 204)
  and clears the cookies, even if the MS call fails.
- Deactivating a user revokes all their families. A daily job deletes rows expired over a day ago.
- Refresh tokens issued before this change carry no `jti` and are rejected once: users log in again.
