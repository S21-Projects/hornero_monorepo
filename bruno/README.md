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

- `login` / `register` parse the `access_token` from `Set-Cookie` (it is
  `httpOnly: false`) and store it in the `accessToken` env var.
- Protected requests send it explicitly via `Cookie: access_token={{accessToken}}`.

`refresh` needs the `refresh_token` cookie, which **is** `httpOnly` and cannot
be read by a script — enable Bruno's cookie jar (Preferences → General) so it is
sent automatically.

## Endpoints

| Folder          | Request            | Method | Path                          | Auth          |
|-----------------|--------------------|--------|-------------------------------|---------------|
| auth            | Register           | POST   | /auth/register                | public        |
| auth            | Login              | POST   | /auth/login                   | public        |
| auth            | Me                 | GET    | /auth/me                      | cookie        |
| auth            | Refresh            | POST   | /auth/refresh                 | refresh cookie|
| auth            | Logout             | POST   | /auth/logout                  | public        |
| organizaciones  | Crear organizacion | POST   | /organizaciones               | referente     |
| organizaciones  | Mi organizacion    | GET    | /organizaciones/mia           | cookie        |
| organizaciones  | Listar validadas   | GET    | /organizaciones               | cookie        |
| organizaciones  | Listar pendientes  | GET    | /organizaciones/pendientes    | admin         |
| organizaciones  | Validar            | PATCH  | /organizaciones/:id/validar   | admin         |

Admin-only endpoints require logging in as an ADMIN user. Set `orgId` on the
Validar request to a real pending organization id.

## Environment

`environments/local.bru` defines:

- `bffUrl` → `http://localhost:3001`
- `msUrl`  → `http://localhost:8081` (MS direct, for reference)
- `accessToken` → populated at runtime by Login/Register

## Idempotency-Key (N11)

Every business `POST` that creates or triggers something (donaciones, necesidades, relanzar,
organizaciones, evidencias, entrega codigo/verificar, rondas, articulos) requires an
`Idempotency-Key` header, otherwise the MS answers `400 IDEMPOTENCY_KEY_REQUERIDA`. The requests in
this collection send `Idempotency-Key: {{$guid}}`, so each run is a new operation. To test a replay,
replace `{{$guid}}` with a fixed UUID and send the request twice: the second answer is the stored
one, with the response header `Idempotent-Replayed: true`. `/auth/**` does not need the header.
