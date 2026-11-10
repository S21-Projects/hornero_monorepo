# Hornero API — Bruno collection

A versionable [Bruno](https://www.usebruno.com/) collection for the Hornero BFF API.

## Usage

1. Open Bruno → **Open Collection** → select this `bruno/` folder.
2. Top-right environment selector → choose **local**.
3. Run **auth/Login** first. It captures the `access_token` cookie into the
   `accessToken` env var, which every protected request reuses.
4. Run any other request.

## Why auth works the way it does

The BFF does **not** authenticate with a `Bearer` header. Its `JwtStrategy`
extracts the JWT **only** from the `access_token` cookie:

```ts
jwtFromRequest: ExtractJwt.fromExtractors([
  (req) => req?.cookies?.access_token ?? null,
])
```

So the Bearer scheme you see in the BFF Swagger is effectively dead — importing
the spec and using "Authorize → Bearer" will return 401 against the BFF.

This collection handles it instead by:

- `login` / `register` read the `access_token` from the raw `Set-Cookie`
  response header (the cookie is `httpOnly`, which only hides it from browser JS) and store it in the `accessToken` env var.
- Protected requests send it explicitly via `Cookie: access_token={{accessToken}}`.

`refresh` needs the `refresh_token` cookie, which the collection does not capture — enable Bruno's cookie jar (Preferences → General) so it is
sent automatically.

## Endpoints

Requests are grouped in folders. Paths are relative to the BFF (no `/api` prefix).

| Folder | Requests (method path) |
|---|---|
| `auth` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` |
| `organizaciones` | `POST /organizaciones`, `GET /organizaciones`, `GET /organizaciones/mia`, `GET /organizaciones/pendientes` (admin), `GET /organizaciones/mapa/zona` (public), `GET /organizaciones/:slug`, `PATCH /organizaciones/:id/validar` (admin), `PATCH /organizaciones/:id/rechazar` (admin) |
| `necesidades` | `GET /necesidades`, `GET /necesidades/:id`, `POST /necesidades`, `PATCH /necesidades/:id`, `DELETE /necesidades/:id` |
| `donaciones` | `GET /donaciones`, `GET /donaciones/activas`, `GET /donaciones/mias`, `GET /donaciones/mi-organizacion`, `GET /donaciones/:id`, `POST /donaciones`, `PATCH /donaciones/:id/decision`, `PATCH /donaciones/:id/estado`, `PATCH /donaciones/:id/estado-admin`, `POST /donaciones/:id/confirmar-entrega`, `DELETE /donaciones/:id` |
| `usuarios` | `GET /usuarios`, `PATCH /usuarios/:id/activo` (admin) |

The collection does not cover every BFF route (for example rondas, accreditation, claims and reports);
the BFF Swagger at `http://localhost:3001/api/docs` lists them all. Admin-only endpoints require logging in as an admin user.

Set `orgId` on the
Validar request to a real pending organization id.

## Environment

`environments/local.bru` defines:

- `bffUrl` → `http://localhost:3001`
- `msUrl`  → `http://localhost:8081` (MS direct, for reference)
- `accessToken` → populated at runtime by Login/Register

`environments/production.bru` is a leftover that points to the decommissioned Railway deployment;
do not use it. Production is `https://elhornero.org` (see `docs/deploy-rpi-cloudflare.md`).

## Idempotency-Key (N11)

Every business `POST` that creates or triggers something (donaciones, necesidades, relanzar,
organizaciones, evidencias, entrega codigo/verificar, rondas, articulos) requires an
`Idempotency-Key` header, otherwise the MS answers `400 IDEMPOTENCY_KEY_REQUERIDA`. The requests in
this collection send `Idempotency-Key: {{$guid}}`, so each run is a new operation. To test a replay,
replace `{{$guid}}` with a fixed UUID and send the request twice: the second answer is the stored
one, with the response header `Idempotent-Replayed: true`. `/auth/**` does not need the header.
