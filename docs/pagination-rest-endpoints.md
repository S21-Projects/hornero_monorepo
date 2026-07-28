# Implementation Plan — Pagination + Global Response Envelope

## Goal

Add pagination to every collection (`list`) endpoint across the four domain
resources — **organizaciones, usuarios, necesidades, donaciones** — and adopt a
**global response envelope** for the whole API (success and error) while we are
at it. Clients fetch bounded pages instead of full tables, and every response has
a single, predictable shape.

Pagination scope is **list/collection** endpoints. The envelope, by contrast,
wraps **all** responses (items, lists, writes, errors) — see the scope note in
Design Decision 2.

This is delivered as **one coordinated cutover across the three services** — the
monorepo exists precisely so MS, BFF, and frontend ship together. There is no
gradual per-resource migration (see Rollout).

---

## Current state (verified in code)

All three layers today move **unbounded, unwrapped** payloads.

**MS** — controllers return `List<XResponse>` directly; services do
`repository.findAll().stream().map(...).collect(toList())`; repositories extend
plain `JpaRepository`.

| Resource       | List endpoint(s)                                              | Service method                          |
|----------------|--------------------------------------------------------------|-----------------------------------------|
| necesidades    | `GET /api/necesidades?organizacionId=`                       | `findAll()` / `findByOrganizacion`      |
| organizaciones | `GET /api/organizaciones`, `/pendientes`                     | `listarValidadas()` / `listarPendientes()` |
| donaciones     | `GET /api/donaciones?organizacionId=`, `/mias`               | `findAll()` / `findByOrg` / `findMias`  |
| usuarios       | `GET /api/usuarios`                                           | `findAll()`                             |

> `/api/organizaciones/mia` and all `/{id}`,`/{slug}` reads are single-item — not
> paginated, but they **are** wrapped by the envelope.

**BFF** — thin proxy; forwards the query string by hand and returns `data`
verbatim. Its error path (`common/axios-exception.filter.ts`) currently emits
`{ statusCode, message }` — this must change to match the new error envelope.

**Frontend** — TanStack Query hooks (`useQuery`) calling `api.get<X[]>(...)` and
returning a flat array; `staleTime: 60_000`. The axios instance
(`src/lib/axios.ts`) already has a response interceptor (used for 401 refresh) —
that is where we will unwrap the envelope.

### ⚠️ Two breaking changes, shipped together

1. **Pagination**: list responses go from `[...]` to a paged `data` object.
2. **Envelope**: every response is wrapped in `{ status, message, timestamp,
   data, errors }`.

Both break the current frontend contract. Because it is a monorepo, they ship as
**one cutover**, not staged.

---

## Design decisions

### 1. One coordinated cutover (no gradual rollout)

All three services change in the same PR. The frontend's axios interceptor is
updated to unwrap `.data` in the same change, so the moment the back returns the
envelope, the front already understands it. The monorepo makes this atomic — use
that advantage instead of maintaining two response shapes during a transition.

### 2. Global response envelope (adopted from the org standard)

Align to the existing corporate standard (cf. `ms-transactions/api/v1/...`).
**Every** response — success and error — uses this shape:

**Success (paged list):**
```json
{
  "status": 200,
  "message": "Request processed successfully",
  "timestamp": "2026-06-18T20:25:28.938445167Z",
  "data": {
    "totalElements": 2335,
    "totalPages": 779,
    "number": 0,
    "size": 3,
    "content": []
  }
}
```

**Success (single item):** `data` holds the object directly (no `content`):
```json
{ "status": 200, "message": "...", "timestamp": "...", "data": { "id": 1, "...": "..." } }
```

**Error:**
```json
{
  "status": 404,
  "message": "Resource not found",
  "timestamp": "2026-06-18T17:22:21.694012337-03:00",
  "data": null,
  "errors": ["No static resource api/v1/organizations."]
}
```

Three rules that keep this clean:

- **The HTTP status line stays the authority.** The body `status` mirrors it for
  convenience/logging but must never be the source of truth — if they ever
  disagree, the HTTP line wins. Keep them in sync by setting both from one place.
- **`data` for pages is our own `PageData<T>` DTO**, not a raw Spring `Page`. The
  field names (`number`, `size`, `totalElements`, `totalPages`, `content`)
  intentionally match the standard, but we own the DTO so the JSON contract is
  stable. Never serialize `PageImpl` directly.
- **Wrap centrally, never per-controller** (Design Decision 4).

### 3. Offset pagination (`page` + `size`), not cursor

Query contract on every list endpoint, matching the standard URL
(`?organizationId=8&page=0&size=3`):

```
?page=0          zero-based, default 0
&size=20         default 20, hard-capped at 100
&sort=campo,desc optional; e.g. sort=fechaPublicacion,desc
```

**Why offset:** the dataset is small (NGO orgs and their needs/donations, user
admin tables); the UIs are numbered admin tables and short public lists; offset
gives "jump to page N" and total counts for free. Cursor/keyset only pays off at
large scale or deep infinite scroll. A public list that later needs infinite
scroll can use `useInfiniteQuery` over the **same** offset endpoint — no backend
change. Existing filters (`organizacionId`) stay and combine with paging.

### 4. Wrap and handle errors centrally

The envelope is applied in exactly one place per service. No controller manually
builds it.

- **MS**: a `ResponseBodyAdvice<Object>` wraps every successful body; a
  `@RestControllerAdvice` with `@ExceptionHandler`s builds the error envelope.
- **BFF**: passes the MS envelope through untouched, and its own exception filter
  is rewritten to emit the **same** error envelope for BFF-originated errors
  (e.g. missing access token).
- **Frontend**: a single axios response interceptor unwraps `.data` so app code
  keeps reading domain fields directly; the error path reads `.errors`/`.message`.

---

## Part 1 — MS (jar_hornero_ms, Spring Boot)

### 1.1 Envelope DTOs

```java
// org.example.common.ApiResponse
public record ApiResponse<T>(
    int status, String message, Instant timestamp, T data, List<String> errors) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(200, "Request processed successfully", Instant.now(), data, null);
    }
    public static ApiResponse<Void> error(int status, String message, List<String> errors) {
        return new ApiResponse<>(status, message, Instant.now(), null, errors);
    }
}

// org.example.common.PageData — our stable page DTO (NOT Spring's PageImpl)
public record PageData<T>(
    long totalElements, int totalPages, int number, int size, List<T> content) {

    public static <T> PageData<T> from(Page<T> p) {
        return new PageData<>(p.getTotalElements(), p.getTotalPages(),
                              p.getNumber(), p.getSize(), p.getContent());
    }
}
```

### 1.2 Central wrapping + defaults

- **`ResponseBodyAdvice<Object>`** (`@RestControllerAdvice`): if a controller
  returns something that is not already an `ApiResponse`, wrap it in
  `ApiResponse.ok(body)`. This keeps every controller method returning plain
  domain objects/`PageData` — the advice does the envelope. (Exempt the
  springdoc/`/v3/api-docs` paths so the OpenAPI JSON stays raw.)
- **`@ExceptionHandler`s** in the same advice (or a dedicated one) turn
  `ResponseStatusException`, validation errors (`MethodArgumentNotValidException`
  → field messages into `errors[]`), and fallbacks into `ApiResponse.error(...)`
  with the matching HTTP status. This replaces relying on Spring's default error
  body.
- `application.yml` page defaults/cap:

```yaml
spring:
  data:
    web:
      pageable:
        default-page-size: 20
        max-page-size: 100
        one-indexed-parameters: false
```

### 1.3 Repositories

Add `Pageable`-aware methods. `findAll(Pageable)` is inherited; filtered finders
need new signatures. Example `NecesidadRepository`:

```java
Page<Necesidad> findByOrganizacion_Id(Long organizacionId, Pageable pageable);
```

Same for `DonacionRepository` (by org, by donante) and the
`Organizacion`/`Usuario` filtered finders. Keep non-paged methods only where
internal logic still needs them (e.g. ownership checks).

### 1.4 Services

Return `Page<XResponse>`; `Page.map` converts entity → DTO while preserving paging
metadata:

```java
public Page<NecesidadResponse> findAll(Pageable pageable) {
    return necesidadRepository.findAll(pageable).map(this::toResponse);
}
public Page<NecesidadResponse> findByOrganizacion(Long orgId, Pageable pageable) {
    return necesidadRepository.findByOrganizacion_Id(orgId, pageable).map(this::toResponse);
}
```

Apply to `OrganizacionService.listarValidadas/listarPendientes`,
`DonacionService.findAll/findByOrg/findMias`, `UsuarioService.findAll`.

### 1.5 Controllers

Accept `Pageable` (Spring binds `page`/`size`/`sort`), return `PageData` — the
advice wraps it:

```java
@GetMapping
public PageData<NecesidadResponse> listar(
        @RequestParam(required = false) Long organizacionId,
        @PageableDefault(size = 20, sort = "id") Pageable pageable) {
    Page<NecesidadResponse> page = (organizacionId == null)
            ? necesidadService.findAll(pageable)
            : necesidadService.findByOrganizacion(organizacionId, pageable);
    return PageData.from(page);
}
```

Single-item endpoints keep returning their DTO directly — the advice wraps them
into `{ ...data: {...} }` automatically. **`@PreAuthorize` rules are unchanged**;
paging and wrapping don't alter authorization.

---

## Part 2 — BFF (ts_hornero_bff, NestJS)

### 2.1 Controllers — forward paging params

Add `page`/`size`/`sort` alongside existing query params. Example
`necesidades.controller.ts`:

```ts
@Public() @Get()
getNecesidades(
  @Query('organizacionId') organizacionId?: string,
  @Query('page') page?: string,
  @Query('size') size?: string,
  @Query('sort') sort?: string,
) {
  return this.necesidadesService.getNecesidades({ organizacionId, page, size, sort });
}
```

### 2.2 Services — build querystring, relay envelope untouched

```ts
// common/build-query.ts
export function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : '';
}
```

```ts
async getNecesidades(p: { organizacionId?: string; page?: string; size?: string; sort?: string }) {
  const url = `${this.msUrl}/api/necesidades${buildQuery(p)}`;
  const { data } = await this.httpService.axiosRef.get(url);
  return data; // MS envelope, passed straight through
}
```

The MS already produced the envelope, so the BFF does **not** re-wrap successful
responses. Apply to `donaciones`, `organizaciones`, `usuarios` services.

### 2.3 Exception filter — match the envelope

`common/axios-exception.filter.ts` today returns `{ statusCode, message }`.
Rewrite it to emit the **same** error envelope, so BFF-originated errors and
relayed MS errors are indistinguishable to the frontend:

```ts
const status = exception.response?.status ?? HttpStatus.BAD_GATEWAY;
const upstream = exception.response?.data; // already-enveloped MS error?
const body = upstream?.status
  ? upstream                                  // relay MS envelope as-is
  : { status, message: exception.message, timestamp: new Date().toISOString(),
      data: null, errors: [exception.message] };
response.status(status).json(body);
```

Also align any `UnauthorizedException` (e.g. missing `access_token`) so it
serializes into this envelope rather than Nest's default shape.

---

## Part 3 — Frontend (ts_hornero_app, Next.js 16 / React 19)

> Per `ts_hornero_app/AGENTS.md`: this is Next 16 / React 19 — read the relevant
> guide in `node_modules/next/dist/docs/` before writing frontend code.

### 3.1 Unwrap the envelope once, in the axios interceptor

`src/lib/axios.ts` already has a response interceptor. Add unwrapping there so the
rest of the app keeps reading domain data directly:

```ts
api.interceptors.response.use(
  (res) => { if (res.data && 'data' in res.data) res.data = res.data.data; return res; },
  async (error) => { /* existing 401-refresh logic; read error.response.data.errors for messages */ }
);
```

> `serverFetch.ts` (Server Components path) does **not** go through this axios
> instance — unwrap `.data` explicitly there too, or add a small shared helper.

### 3.2 Shared types + API layer

```ts
export interface PageData<T> {
  content: T[]; number: number; size: number; totalElements: number; totalPages: number;
}
export interface PageParams { page?: number; size?: number; sort?: string; }
```

After interceptor unwrapping, list API functions return `PageData<T>`:

```ts
export async function fetchAllNecesidades(p: PageParams = {}): Promise<PageData<NecesidadResponse>> {
  const { data } = await api.get<PageData<NecesidadResponse>>('/necesidades', {
    params: { page: p.page ?? 0, size: p.size ?? 20, sort: p.sort },
  });
  return data;
}
```

### 3.3 Hooks — two patterns

**Numbered tables** (`useQuery` + `keepPreviousData`):
```ts
export function useNecesidades(page = 0, size = 20) {
  return useQuery({
    queryKey: ['necesidades', 'all', page, size],   // page/size in key is mandatory
    queryFn: () => fetchAllNecesidades({ page, size }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
```

**Infinite scroll** (`useInfiniteQuery`, same endpoint):
```ts
export function useNecesidadesInfinite(size = 20) {
  return useInfiniteQuery({
    queryKey: ['necesidades', 'infinite', size],
    queryFn: ({ pageParam }) => fetchAllNecesidades({ page: pageParam, size }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.number + 1 < last.totalPages ? last.number + 1 : undefined,
    staleTime: 60_000,
  });
}
```

### 3.4 Frontend impact map (verified consumers)

Each of these renders a list today by treating the response as an array. They all
need: read `data.content`, and add a pager **or** an infinite-scroll trigger. The
"UI control" column is the recommendation — confirm per screen.

| File | Resource | Today | UI control to add |
|------|----------|-------|-------------------|
| `src/app/users/page.tsx` | usuarios | `useUsuariosQuery` admin table | **Numbered pager** (admin table, jump-to-page) |
| `src/components/admin/PendingOrgsList.tsx` | organizaciones (pendientes) | `usePendingOrgsQuery` admin list | **Numbered pager** |
| `src/app/organizaciones/page.tsx` | organizaciones (validadas) | `useValidatedOrganizaciones` | **Infinite scroll** (public browse) or pager |
| `src/app/needs/page.tsx` | necesidades | `useNecesidades` | **Infinite scroll** (public feed) |
| `src/app/donaciones/page.tsx` | donaciones | `useDonaciones` | Numbered pager |
| `src/app/mis-donaciones/page.tsx` | donaciones (mias) | `useMisDonaciones` | Numbered pager |
| `src/app/page.tsx` | (home — orgs/needs preview) | list hook(s) | Likely a small fixed `size`, **no pager** (teaser) |
| `src/components/prefs/zonas-map.tsx` | organizaciones (map markers) | orgs list for markers | **Special case** — see note |

**Reusable components to build (don't hand-roll per screen):**
- `components/ui/Pager.tsx` — prev/next + page numbers, driven by
  `number`/`totalPages`/`totalElements`; owns nothing, fully controlled.
- `components/ui/InfiniteList.tsx` (or a `useInfiniteScroll` hook) — wraps an
  `IntersectionObserver` sentinel and calls `fetchNextPage` when
  `hasNextPage`.

**`zonas-map.tsx` is the one to think about, not auto-paginate.** A map needs
**all** markers in the viewport, not "page 1 of 779." Options: give the map a
large/`size`-max single fetch, or — better long-term — a dedicated geo/bounds
endpoint (`?bbox=...`) instead of the paginated list. Don't bolt a pager onto a
map. Flag this for a product decision.

---

## Rollout (single coordinated PR — monorepo)

Because the envelope changes **every** endpoint at once, a per-resource rollout
is not possible: the frontend interceptor either unwraps `.data` or it doesn't.
So ship it as one change, in this internal order of work:

1. **MS first, behind the same branch**: envelope DTOs, advice, exception
   handlers, then `Pageable` through repos/services/controllers for all four
   resources.
2. **BFF**: forward paging params, rewrite the exception filter.
3. **Frontend**: interceptor unwrap + `serverFetch` unwrap, `PageData` types,
   hooks with paged query keys, then each screen in the impact map + the two
   reusable UI components.

PR checklist:

- [ ] Every MS list endpoint returns `PageData`; every response is enveloped.
- [ ] MS error paths produce the error envelope (incl. validation → `errors[]`).
- [ ] BFF forwards `page`/`size`/`sort` and relays/produces the error envelope.
- [ ] Frontend unwraps in **both** axios and `serverFetch`.
- [ ] Every screen in the impact map reads `data.content` and has its pager /
      infinite trigger.
- [ ] `zonas-map.tsx` decision recorded (bulk fetch vs geo endpoint).
- [ ] Auth/role guards unchanged on every touched endpoint.

---

## Testing

**MS (`mvn test`)**
- Repo slice: `findAll(PageRequest.of(0, 2))` → 2 items + correct `totalElements`.
- Service: `Page.map` yields `Page<Dto>` with metadata intact.
- `@WebMvcTest`: `?page=1&size=5&sort=id,desc` binds the right `Pageable`;
  response JSON is `{ status, message, timestamp, data:{ content, number, ... } }`.
- `size=9999` is clamped to 100.
- An exception (e.g. 404) serializes to the error envelope with `errors[]`.

**BFF (`npm test`)**
- `?page=2&size=10&organizacionId=3` forwarded verbatim to the MS URL.
- MS success envelope relayed unchanged; MS/own errors emit the error envelope.

**Frontend**
- Interceptor unwraps `.data`; components receive `PageData`.
- `keepPreviousData` keeps the current page visible while loading the next.
- Infinite hook stops when `number + 1 === totalPages`.

---

## Out of scope (follow-ups)

- Cursor/keyset pagination — only if a table grows large enough that `OFFSET` hurts.
- A geo/bounds endpoint for the map (`zonas-map.tsx`).
- Server-driven filtering/search beyond the existing `organizacionId`.
- Persisting page/sort in the URL for shareable deep links.
- `count(*)` caching for very large tables.
```
