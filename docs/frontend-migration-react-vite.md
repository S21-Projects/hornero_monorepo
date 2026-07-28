# Frontend Migration Plan — Option B: React + Vite (SPA)

> One of three evaluated migration targets for `ts_hornero_app` (currently
> Next.js 16 / React 19). Companion docs:
> [`frontend-migration-astro.md`](./frontend-migration-astro.md),
> [`frontend-migration-tanstack-start.md`](./frontend-migration-tanstack-start.md).
> Read [the shared baseline](#current-state-the-thing-we-are-actually-migrating) first — it is identical in all three.

## Current state — the thing we are actually migrating

The frontend is **not** a plain SPA. The migration cost lives entirely in these
Next.js-specific couplings, not in the UI components:

| Coupling | Where | Portability |
|---|---|---|
| App Router file routing (~14 routes, `[slug]` dynamic) | `src/app/**/page.tsx` | Re-expressed per framework |
| **Server Components doing authenticated SSR** (10 async pages) | `serverFetch.ts` via `next/headers` `cookies()` | **Hard** — forwards browser cookies to the BFF server-side |
| **Edge route guards** (JWT decode + redirect matrix) | `src/proxy.ts` (Next 16 middleware) | **Hard** — runs before render |
| `error.tsx` / `loading.tsx` conventions | per route | Re-expressed |
| `output: "standalone"` Docker build | `next.config.ts` | Replace with static build |
| React Compiler | `next.config.ts` | Optional, drop or re-add |
| TanStack Query + Zustand + axios | `src/lib/hooks/`, `src/store/` | **Free** — framework-agnostic |
| 37 `use client` components, Tailwind 4 | `src/components/**` | **Free** |
| Leaflet dynamic import (SSR-unsafe) | `map-dynamic.tsx` | **Free** |

The 37 client components, the TanStack Query hooks, Zustand stores, axios client
and Tailwind 4 setup move with near-zero changes. The plan below is about the
**three hard rows** — and Vite's answer to two of them is "delete the problem."

## What React + Vite is

A **client-only SPA**: Vite builds a static bundle (HTML + JS + CSS) served by
any static host or behind nginx. There is **no server runtime**. Routing is
client-side (React Router or TanStack Router). All data fetching happens in the
browser via the existing axios + TanStack Query stack. Authenticated SSR and edge
middleware **cease to exist** — they become client concerns.

## Migration mapping

| Next.js 16 | React + Vite equivalent |
|---|---|
| App Router file routing | React Router / TanStack Router route config |
| `serverFetch.ts` (RSC, cookie-forwarded SSR) | **Removed.** The 10 server pages become client pages using the existing axios client + TanStack Query hooks (which already exist for most resources) |
| `proxy.ts` middleware guards | client-side `<ProtectedRoute>` wrapper that decodes the cookie JWT and redirects in-app |
| `loading.tsx` | TanStack Query `isLoading` + Suspense boundaries (already the client pattern) |
| `error.tsx` | React error boundaries |
| `output: standalone` (Node container) | static build, served by nginx or `vite preview`; lighter Docker image |
| `NEXT_PUBLIC_BFF_URL` build ARG | `import.meta.env.VITE_BFF_URL` build ARG (same baked-at-build constraint) |

Note the asymmetry: you already have client hooks (`useDonaciones`,
`useNecesidades`, `useOrganizacionesInfinite`, etc.). The server pages are the
*minority*. Converting them to client fetches is mostly deleting `serverFetch`
calls and reusing hooks you already wrote.

## Pros

- **Conceptually the simplest target.** No server runtime, no SSR, no
  middleware. One build artifact. Easiest to reason about, deploy, and debug.
- **Highest reuse of existing client code.** TanStack Query + Zustand + axios is
  *the native idiom* of a Vite SPA. The 37 client components drop in unchanged.
- **Fastest local dev / HMR** of the three; smallest toolchain surface.
- **Cheapest deploy.** Static assets on a CDN or tiny nginx image — no Node
  server to keep warm on Railway. Removes the `BFF_BASE_URL` server-side hop;
  the browser talks to the BFF directly.
- **Cleanest auth story end-to-end:** the BFF + MS already are the real auth
  authority (per `CLAUDE.md`). Client-side guards are explicitly *UX-only* today
  anyway — so moving them client-side loses **nothing** that was ever trusted.

## Cons

- **You lose SSR entirely.** No server-rendered HTML → worse first-paint and
  **worse SEO** for public pages (org/needs listings). For an authenticated app
  this barely matters; for public discovery it does.
- **Auth flash / redirect-on-load.** Without edge middleware, an unauthenticated
  user briefly loads the SPA shell before the client guard redirects. Mitigable
  (gate render before first paint) but never as clean as a server 302.
- **No cookie-forwarded server fetch.** All requests are browser→BFF; anything
  that *relied* on server-side cookie forwarding (currently `serverFetch`) must
  work purely with the browser's own cookies. In practice this is fine — the BFF
  reads the `access_token` cookie either way — but it removes a layer.
- **You build the routing/guard plumbing yourself.** What Next gave for free
  (file routing, middleware) is now app code you own and test.
- Larger initial JS bundle than Astro for public pages (everything is a SPA).

## Effort & risk

- **Effort: Low-Medium.** The single biggest task is converting 10 server pages
  to client pages — and most of their hooks already exist. Routing + a
  `ProtectedRoute` guard is a day's work. No server runtime to wire.
- **Risk: Low.** Smallest number of moving parts; the auth model degrades
  *gracefully* because the trusted enforcement was never in the frontend.

## Verdict for Hornero

**The pragmatic default.** Hornero is an authenticated, app-like dashboard whose
real security lives in the BFF + MS. A Vite SPA matches that shape, maximizes
reuse of the existing client stack, and is the cheapest to run and simplest to
maintain. **You sacrifice SSR/SEO** — acceptable while the product is
login-gated. If/when public SEO discovery becomes a goal, that's the argument for
Astro or TanStack Start instead. **Recommended if "ship it, keep it simple" wins
over "keep SSR."**
