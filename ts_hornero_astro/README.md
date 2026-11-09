# ts_hornero_astro

Public, anonymous website of Hornero (Astro 7 in SSR mode with the Node standalone adapter, React islands,
Tailwind 4). It serves the landing page, the list of organizaciones and needs, the public map and the
contact form. Authenticated features live in `ts_hornero_admin`.

## Role in the chain

```
Browser -> ts_hornero_astro :4321 (SSR) -> ts_hornero_bff :3001 -> jar_hornero_ms
```

- Server-side rendering fetches public data through `src/lib/publicFetch.ts`, which calls `BFF_BASE_URL`
  with plain `fetch`: no cookies or authentication are forwarded.
- Client-side islands that build asset URLs (organization images) use `PUBLIC_BFF_URL`.
- Links to the panel use `PUBLIC_SPA_URL`.

## Main directories

| Path | Contents |
|---|---|
| `src/pages/` | Routes: `index`, `organizaciones`, `org/[slug]`, `necesidades`, `mapa`, `nosotros`, `contacto`, `404`, and the API route `api/contacto.ts` |
| `src/components/` | `Nav.astro`, `Footer.astro`, `ui/`, and `islands/` (React: home map explorer, needs board, organization list, vulnerability map, contact form) |
| `src/layouts/` | `Layout.astro` |
| `src/lib/` | `publicFetch.ts`, contact form logic (`contacto.ts`, swappable `mailer.ts`, `turnstile.ts`), `securityHeaders.ts`, geo and map helpers, shared types |
| `src/middleware.ts` | Security headers (Content-Security-Policy) |
| `src/data/`, `public/` | Static data and assets; `public/mapa/` holds the generated `departamentos.geojson` (see [`../scripts/mapa/README.md`](../scripts/mapa/README.md)) |

Route names are in Spanish (`/nosotros`, `/contacto`).

## Run, build

Supported way for the full stack: Docker from the repository root (`make up-local`); see the
[root README](../README.md). The site is then at <http://localhost:4321>. Directly (Node 22.12 or newer,
a reachable BFF):

```bash
npm install
npm run dev        # Astro dev server
npm run build      # production build into dist/
npm run preview    # serve the build
```

There is no unit-test or lint script in this package; `npm run build` is the compile check. Type
checking is available through `npx astro check` (`@astrojs/check` is a dev dependency).

## Environment variables (names only)

| Variable | When | Purpose |
|---|---|---|
| `PUBLIC_BFF_URL` | **Build time** (Docker build arg) | BFF URL exposed to browser code |
| `PUBLIC_SPA_URL` | **Build time** (Docker build arg) | Admin panel URL used in links |
| `BFF_BASE_URL` | Runtime | Internal BFF URL for SSR fetches (`http://bff:3001` in Compose) |
| `CSP_MODE` | Runtime | `report-only` (default) or `enforce` |
| `TURNSTILE_SECRET` | Runtime | Server half of the contact form bot check; empty makes the gate inert |
| `RESEND_API_KEY`, `CONTACTO_FROM_EMAIL`, `CONTACTO_TO_EMAIL` | Runtime | Contact form mail delivery; if any is missing, submissions are logged instead of sent |
| `HOST`, `PORT` | Runtime | Listen address (`0.0.0.0:4321` in Compose) |

The two `PUBLIC_*` values are baked into the bundle: changing them requires a rebuild.

## Related docs

- [`AGENTS.md`](AGENTS.md): notes for coding agents working in this package (dev server in background mode, Astro documentation links).
- [`../CLAUDE.md`](../CLAUDE.md): how the layers talk.
- [`../docs/frontend-migration-astro.md`](../docs/frontend-migration-astro.md): why the public site is Astro.
- [`../docs/mapa-vulnerabilidad.md`](../docs/mapa-vulnerabilidad.md): the vulnerability map.
