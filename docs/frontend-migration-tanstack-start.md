# Frontend Migration Plan — Option C: TanStack Start

> One of three evaluated migration targets for `ts_hornero_app` (currently
> Next.js 16 / React 19). Companion docs:
> [`frontend-migration-astro.md`](./frontend-migration-astro.md),
> [`frontend-migration-react-vite.md`](./frontend-migration-react-vite.md).
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
| TanStack Query + Zustand + axios | `src/lib/hooks/`, `src/store/` | **Free** — and *first-class* here |
| 37 `use client` components, Tailwind 4 | `src/components/**` | **Free** |
| Leaflet dynamic import (SSR-unsafe) | `map-dynamic.tsx` | **Free** |

The 37 client components, the TanStack Query hooks, Zustand stores, axios client
and Tailwind 4 setup move with near-zero changes. The plan below is about the
**three hard rows** — and TanStack Start has a native, designed answer for each.

## What TanStack Start is

A **full-stack React framework** built on **Vite + TanStack Router**, with SSR,
streaming, server functions (`createServerFn`), and route-level `loader`s and
`beforeLoad` guards. It is the closest *architectural* analog to Next.js App
Router among the three, but Vite-based and type-safe routing first. The same team
that makes TanStack Query (which you already depend on) makes it — the data layer
integration is the tightest of any option.

## Migration mapping

| Next.js 16 | TanStack Start equivalent |
|---|---|
| App Router `page.tsx` | type-safe file routes (`src/routes/needs.tsx`) |
| RSC async page + `serverFetch` | route `loader` + `createServerFn` that reads the request cookies and forwards to `BFF_BASE_URL` — **same cookie-forwarding SSR pattern, kept** |
| `proxy.ts` middleware | route `beforeLoad` guards (per-route or layout route) decoding `tipo`, throwing `redirect()` — the matrix ports cleanly and gains **type safety** |
| `loading.tsx` | route `pendingComponent` + streaming `Await` |
| `error.tsx` | route `errorComponent` |
| `output: standalone` | Nitro server build → Node container for Railway |
| TanStack Query SSR hydration | **first-class** — `loader` can prime the query cache, no double-fetch |
| Leaflet SSR | `ClientOnly` wrapper / lazy island |

Crucially, the **two hard rows survive as designed features**, not workarounds:
cookie-forwarded SSR via `createServerFn`, and edge-style guards via
`beforeLoad`. Your existing TanStack Query hooks become loader-primed instead of
client-only — an upgrade, not a rewrite.

## Pros

- **Closest 1:1 to your current architecture.** SSR, file routing, route guards,
  per-route loading/error — every Next concept you use has a direct, intended
  equivalent. Lowest *conceptual* translation loss.
- **Best-in-class TanStack Query integration.** You already depend on
  `@tanstack/react-query@5`. Loaders prime the cache, SSR hydrates it, no
  double-fetch. This is the option that *rewards* your existing stack the most.
- **End-to-end type-safe routing & server functions** — params, search, loader
  data, and server-fn IO are typed. Strictly better DX than Next here.
- **Keeps SSR/SEO** for public pages (org/needs listings) *and* stays app-like
  for the authenticated dashboard — no Astro-style state fragmentation.
- Vite toolchain: fast HMR, familiar to the team, no webpack/turbopack quirks.

## Cons

- **Maturity risk.** TanStack Start reached 1.0 relatively recently; the
  ecosystem, docs, and battle-tested-in-prod surface are smaller than Next.js.
  Fewer Stack Overflow answers, more reading source. For a faculty project this
  is acceptable; for a long-lived product, weigh it.
- **Still a server runtime to operate.** Like Next, you deploy a Node (Nitro)
  server on Railway — none of Vite-SPA's deploy simplicity. You keep SSR's
  operational weight.
- **You drop React Compiler** (Next-specific integration); minor.
- **Smallest community of the three**, so unknowns surface as you go — the
  migration is low-translation-loss but higher *uncertainty*.
- Requires the team to learn TanStack Router's file/loader conventions (similar
  effort to learning App Router, just different).

## Effort & risk

- **Effort: Medium.** Mechanically the highest-fidelity port — guards and SSR map
  directly — but you re-express every route and adopt loader/server-fn
  conventions. Less *rework* than Astro, more *new framework surface* than Vite
  SPA.
- **Risk: Medium**, almost entirely *ecosystem maturity* rather than
  architectural mismatch. The technical fit is the best of the three.

## Verdict for Hornero

**The best technical fit if keeping SSR matters.** It preserves everything the
current app does — cookie-forwarded server fetch, route guards, per-route
loading/error, SSR/SEO — while upgrading the data layer and routing to type-safe,
TanStack-native equivalents. The single real reservation is **maturity**: you're
betting on a younger framework. **Recommended when "keep the architecture, lose
the Vercel coupling, gain type-safety" is the goal and the team can tolerate a
smaller ecosystem.** If that maturity bet is unacceptable, fall back to the Vite
SPA (Option B) and accept losing SSR.
