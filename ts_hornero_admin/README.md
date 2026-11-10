# ts_hornero_admin

Authenticated single-page app of Hornero (React 19, Vite 8, TypeScript 6, Tailwind 4). It is the only
place where authenticated routing exists, for every role: `ADMINISTRADOR`, `REFERENTE` (organization
contact) and `DONANTE`. The public, anonymous site is `ts_hornero_astro`.

## Role in the chain

```
Browser -> ts_hornero_admin :5173 (nginx serves the static build) -> ts_hornero_bff :3001 -> jar_hornero_ms
```

- All requests go through the axios instance in `src/lib/axios.ts`: `baseURL` is `VITE_BFF_URL` (no
  `/api` prefix) and `withCredentials: true`, so the httpOnly cookies set by the BFF travel along.
- On a `401` it refreshes the session once through a single-flight queue and retries; if the refresh fails
  it redirects to `/login` only when the readable `session_hint` cookie was present.
- The role is never read from a cookie: `src/store/auth.store.ts` (Zustand) is filled by `GET /auth/me`.
  `src/app/ProtectedRoute.tsx` (`ProtectedRoute`, `PublicOnlyRoute`) only drives redirects for UX; the
  real authorization is enforced by the MS and the BFF.
- Server state lives in TanStack Query; non-server state (auth session, notices) in Zustand.

## Main directories

| Path | Contents |
|---|---|
| `src/routes/` | One file per screen (with its `*.test.tsx`): dashboard, panel, needs, donations, rondas, accreditation, audit queue, claims and reports, users, activity log, legajo, delivery by QR code, login and password flows |
| `src/app/` | App shell, route guards, error fallback, not-found |
| `src/components/` | Shared and domain components (`acreditacion`, `donacion`, `entrega`, `map`, `necesidad`, `org`, `panel`, `reclamo`, `reporte`, `ui`) |
| `src/lib/` | axios client, idempotency keys, domain helpers (accreditation, categories, formatting, password policy, safe redirects, QR) |
| `src/store/` | Zustand stores (`auth.store.ts`, `notice.store.ts`) |
| `src/providers/` | TanStack Query provider |
| `src/types/`, `src/styles/`, `src/test/` | Types, styles, test setup |

Maps use Leaflet; charts use Recharts. The production image builds with Vite and serves the result with
nginx (SPA history fallback).

## Run, build, test

Supported way for the full stack: Docker from the repository root (`make up-local`); see the
[root README](../README.md). The panel is then at <http://localhost:5173>. Directly (needs a running BFF
and `VITE_BFF_URL` pointing to it):

```bash
npm install
npm run dev            # Vite dev server
npm run build          # tsc -b && vite build
npm run preview        # serve the build
npm run lint           # eslint .
npm test               # vitest run
npm run test:cov       # vitest with v8 coverage
npm run test:watch     # vitest watch
```

Run `npm run build` before calling a change done: `tsc -b` catches type errors that Vitest does not.

## Environment variables (names only)

| Variable | When | Purpose |
|---|---|---|
| `VITE_BFF_URL` | **Build time** (Docker build arg) | BFF base URL baked into the bundle; changing it needs a rebuild |
| `CSP_MODE` | Runtime (container) | `report-only` (default) or `enforce`; nginx renders the Content-Security-Policy at container start |

## Related docs

- [`../CLAUDE.md`](../CLAUDE.md): authentication layers and cookie model.
- [`../docs/security-access-token-httponly.md`](../docs/security-access-token-httponly.md): why the token is not readable from JS.
- [`../docs/mobile-views.md`](../docs/mobile-views.md): mobile layouts.
- [`../docs/tfg/seguridad-c2.md`](../docs/tfg/seguridad-c2.md): sessions.
