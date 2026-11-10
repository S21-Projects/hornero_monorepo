# Frontend Migration Plan — Option A: Astro + React Islands

> One of three evaluated migration targets for `ts_hornero_app` (currently
> Next.js 16 / React 19). Companion docs:
> [`frontend-migration-react-vite.md`](./frontend-migration-react-vite.md),
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
| `output: "standalone"` Docker build | `next.config.ts` | Replace with adapter |
| React Compiler | `next.config.ts` | Optional, drop or re-add |
| TanStack Query + Zustand + axios | `src/lib/hooks/`, `src/store/` | **Free** — framework-agnostic |
| 37 `use client` components, Tailwind 4 | `src/components/**` | **Free** |
| Leaflet dynamic import (SSR-unsafe) | `map-dynamic.tsx` | **Free** — islands love this |

The 37 client components, the TanStack Query hooks, Zustand stores, axios client
and Tailwind 4 setup move with near-zero changes. The plan below is about the
**three hard rows**.

## What Astro is

Astro is a **content-first, multi-page framework** with an *islands*
architecture: pages render to static/SSR HTML by default and ship **zero JS**
unless you explicitly hydrate a component ("island"). React runs only inside
`client:*`-directed islands via `@astrojs/react`. Authenticated SSR is done in
Astro middleware + per-page server frontmatter, using a server adapter
(`@astrojs/node` for the Railway container).

## Migration mapping

| Next.js 16 | Astro equivalent |
|---|---|
| `src/app/needs/page.tsx` (RSC) | `src/pages/needs.astro` — server frontmatter fetches, renders `<NeedsBoard client:load />` |
| `serverFetch.ts` via `next/headers` | helper reading `Astro.request.headers.cookie`, forwarding to `BFF_BASE_URL` |
| `proxy.ts` middleware | `src/middleware.ts` (`onRequest`) — same JWT decode + redirect matrix, `context.redirect()` |
| `loading.tsx` | client-side island loading state (no streaming-SSR boundary) |
| `error.tsx` | `src/pages/404.astro` / per-island error boundaries |
| `output: standalone` | `@astrojs/node` standalone adapter |
| `[slug]` route | `src/pages/org/[slug].astro` |
| TanStack Query providers | one provider per interactive island (or a shared shell island) |

The redirect matrix in `proxy.ts` ports almost line-for-line to Astro
middleware — both decode `payload.tipo` from the unverified access-token cookie
and redirect. **This is Astro's strongest fit point.**

## Pros

- **Smallest JS payload of all three options.** Static pages (home, org
  listings, public needs) ship no framework JS. For a donation platform with
  public read-heavy pages, this is a real Lighthouse/SEO win.
- **Middleware guards map cleanly.** `proxy.ts` → `onRequest` is close to a
  direct port; the auth model survives intact.
- **Cookie-forwarding SSR is supported** via `Astro.request.headers` + node
  adapter, so the `serverFetch` pattern survives conceptually.
- **Leaflet/Recharts SSR pain disappears** — islands are opt-in hydration by
  design, so `client:only="react"` replaces the `map-dynamic.tsx` workaround.
- Incremental adoption possible: Astro can host React islands while you port
  pages one by one.

## Cons

- **Worst fit for an app-like, authenticated dashboard.** Hornero is mostly
  *behind login* (dashboard, mis-donaciones, admin, panel with charts). Astro's
  value is public content; gated interactive views fight its grain.
- **Islands fragment React state.** TanStack Query cache and Zustand stores are
  per-island by default. Sharing one query cache / auth store across multiple
  islands on a page needs deliberate "nanostores" or a single big shell island —
  at which point you've rebuilt an SPA inside Astro and lost the payload win.
- **No streaming SSR / RSC equivalent.** The `loading.tsx` server-streamed
  skeletons become client-side states; perceived-perf model changes.
- **Two mental models** (`.astro` server files + React islands) on a team that
  currently writes only React. Learning-curve tax.
- React Compiler is not first-class; you'd drop it.

## Effort & risk

- **Effort: Medium-High.** Routing + middleware port is fast; the expensive part
  is re-architecting shared client state across islands and deciding the
  island/shell boundary for every authenticated page.
- **Risk: Medium-High** specifically *because* the app is auth-gated and
  stateful — Astro's sweet spot is the opposite.

## Verdict for Hornero

**Use Astro only if the product pivots toward a public, content-heavy NGO
directory** (browse organizations/needs without login, SEO-driven discovery). For
the current authenticated dashboard product, Astro's payload advantage is paid
for with state-fragmentation complexity. **Lowest recommendation of the three for
the app as it stands today**, highest if the public-facing surface grows.
