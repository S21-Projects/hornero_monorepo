# Image Upload — Implementation Reference

## Overview

Adds profile image, banner, and user photo support across the full stack. Images are stored in Railway Object Storage (Tigris, S3-compatible) using a **presigned PUT URL** pattern: the BFF mints a short-lived upload URL, the browser uploads binary directly to S3, and the resulting public URL is persisted on the entity via a PATCH call.

## Architecture

```
Browser
  │
  ├─[1] GET /api/upload/presign?type=org-profile&filename=foto.jpg&entityId=42
  │       BFF validates ownership → returns { presignedUrl, publicUrl }
  │
  ├─[2] PUT <presignedUrl>   (binary, directly to Tigris — never through BFF/MS)
  │
  └─[3] PATCH /api/organizaciones/42   body: { profileImageUrl: "<publicUrl>" }
          BFF → MS → persists URL string on entity column
```

## Image Types

| Type | Entity field | Upload target | Who can upload |
|------|-------------|---------------|----------------|
| Org profile | `Organizacion.profileImageUrl` | `org-profile` | Org referente |
| Org banner | `Organizacion.bannerUrl` | `org-banner` | Org referente |
| User photo | `Usuario.photoUrl` | `user-photo` | The user themselves |

## Constraints

- Max size: 5 MB per upload
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Presigned URL expiry: 5 minutes
- All images are **public-read** (served directly from Tigris CDN URL)
- Old images are NOT deleted on replace (orphan cleanup is v2 scope)

## S3 Key Pattern

```
{type}/{entityId}/{timestamp}.{ext}
# e.g. org-profile/42/1718300000000.jpg
```

---

## Microservice Changes (`jar_hornero_ms`)

### Entity changes

**`Usuario.java`**
- Added `@Column(name = "photo_url") private String photoUrl` (nullable)
- Added `protected` 5-arg constructor (for subclass compatibility with `@NoArgsConstructor`)
- Removed `@AllArgsConstructor` (conflicted with `Referente`/`Administrador`/`Donante` subclass constructors)

**`Organizacion.java`**
- Added `@Column(name = "profile_image_url") private String profileImageUrl` (nullable)
- Added `@Column(name = "banner_url") private String bannerUrl` (nullable)

Schema migration handled automatically by `ddl-auto: update`.

### New files

| File | Purpose |
|------|---------|
| `user/UpdatePhotoRequest.java` | Request record: `@NotBlank String photoUrl` |

### Modified files

| File | Change |
|------|--------|
| `user/UsuarioResponse.java` | Added `photoUrl` as last field in the Java record |
| `user/UsuarioService.java` | Added `updatePhoto(userId, url)` + updated `toResponse()` to include `photoUrl` |
| `user/UsuarioController.java` | Added `PATCH /api/usuarios/me/photo` (any authenticated role) |
| `organizacion/dto/OrganizacionResponse.java` | Added `profileImageUrl`, `bannerUrl` |
| `organizacion/dto/ActualizarOrganizacionRequest.java` | Added optional `profileImageUrl`, `bannerUrl` fields |
| `organizacion/OrganizacionService.java` | Updated `actualizar()` + `toResponse()` to map image URL fields |
| `organizacion/OrganizacionController.java` | Added `PATCH /api/organizaciones/{id}` (REFERENTE role) |

### New endpoints

```
PATCH /api/usuarios/me/photo
  Auth: JWT (any authenticated role)
  Body: { "photoUrl": "https://..." }
  Response: UsuarioResponse

PATCH /api/organizaciones/{id}
  Auth: JWT (REFERENTE)
  Body: ActualizarOrganizacionRequest (all fields optional)
  Response: OrganizacionResponse
```

---

## BFF Changes (`ts_hornero_bff`)

### Dependencies added

```json
"@aws-sdk/client-s3": "^3.x",
"@aws-sdk/s3-request-presigner": "^3.x"
```

### Environment variables (added to `docker-compose.yml`)

```env
BUCKET_NAME=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=auto
AWS_ENDPOINT_URL_S3=        # Tigris endpoint, e.g. https://fly.storage.tigris.dev
```

Railway injects these automatically when the Object Storage service is attached to the BFF deployment.

### New module: `src/upload/`

| File | Purpose |
|------|---------|
| `upload.module.ts` | Imports `HttpModule`, `ConfigModule`, `OrganizacionesModule`; declares controller |
| `upload.service.ts` | `S3Client` (AWS SDK v3, Tigris endpoint), `presign(target, entityId, filename, contentType)` |
| `upload.controller.ts` | `GET /api/upload/presign` — JWT-gated, validates ownership |
| `dto/presign-query.dto.ts` | `UploadTarget` enum + `AllowedContentType` enum + `PresignQueryDto` |

**Ownership enforcement in `upload.controller.ts`:**
- `org-profile` / `org-banner`: calls `GET /api/organizaciones/mia` using the caller's cookie token; validates that the returned org id matches the `entityId` query param
- `user-photo`: `entityId` is always derived from the JWT `sub` (caller cannot override)

### Modified files

| File | Change |
|------|--------|
| `app.module.ts` | Registered `UploadModule` |
| `organizaciones/organizaciones.module.ts` | Added `exports: [OrganizacionesService]` |
| `organizaciones/dto/actualizar-organizacion.dto.ts` | Added `@IsUrl() @IsOptional() profileImageUrl`, `bannerUrl` |
| `organizaciones/organizaciones.service.ts` | Added `actualizar()` |
| `organizaciones/organizaciones.controller.ts` | Added `PATCH :id` |
| `usuarios/usuarios.service.ts` | Added `updatePhoto()` |
| `usuarios/usuarios.controller.ts` | Added `PATCH me/photo` |

### New endpoint

```
GET /api/upload/presign
  Auth: JWT (any authenticated role)
  Query: type (org-profile|org-banner|user-photo), filename, entityId (for org types)
  Response: { presignedUrl: string, publicUrl: string }
```

---

## Frontend Changes (`ts_hornero_app`)

### New files

| File | Purpose |
|------|---------|
| `src/components/upload/ImageUploadField.tsx` | Reusable upload field: file picker → presign → PUT → callback |
| `src/components/org/OrgEditForm.tsx` | Org edit modal with profile + banner upload fields |
| `src/components/org/OrgEditButton.tsx` | Button that opens `OrgEditForm` (rendered for org referente) |
| `src/lib/api/usuarios.ts` | `updateMyPhoto(photoUrl)` API call |
| `src/lib/api/upload.ts` | `getPresignUrl(type, filename, entityId?)` → `{ presignedUrl, publicUrl }` |

### Modified files

| File | Change |
|------|--------|
| `src/lib/api/organizaciones.ts` | Added `profileImageUrl`, `bannerUrl` to `OrganizacionResponse`; added `updateOrganizacion()` |
| `src/store/auth.store.ts` | Added `photoUrl` to `AuthUser` type + `setPhotoUrl` action |
| `src/components/ui/avatar.tsx` | Added optional `src` prop; renders `<img>` with initials fallback on error |
| `src/app/org/[slug]/page.tsx` | Renders real `bannerUrl` / `profileImageUrl`; shows `OrgEditButton` for referente |
| `src/app/dashboard/page.tsx` | User photo upload wired in referente view |
| `src/components/ui/top-bar.tsx` | Passes `user.photoUrl` to `Avatar src` |

### `ImageUploadField` props

```ts
interface ImageUploadFieldProps {
  label: string;
  currentUrl?: string;
  onUploaded: (url: string) => void;
  uploadType: 'org-profile' | 'org-banner' | 'user-photo';
  entityId?: number;
  aspectRatio?: string;  // e.g. "1 / 1", "3 / 1"
}
```

---

## Public URL Construction

```
publicUrl = `${AWS_ENDPOINT_URL_S3}/${BUCKET_NAME}/${key}`
```

> **Validate before shipping**: Tigris may use virtual-host style (`https://<bucket>.fly.storage.tigris.dev/<key>`) instead of path-style. Confirm the actual URL pattern against the live bucket and update `UploadService` if needed.

---

## Pre-Deploy Checklist

- [ ] Set `BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=auto`, `AWS_ENDPOINT_URL_S3` on the BFF Railway service
- [ ] Configure bucket CORS to allow `PUT` from `FRONTEND_URL`
- [ ] Validate `publicUrl` pattern (path-style vs virtual-host) with a test upload
- [ ] Set bucket policy to public-read for the `org-profile/`, `org-banner/`, `user-photo/` prefixes (or entire bucket)

---

## Known Limitations (v1)

- No cleanup of old images when a new one is uploaded (orphaned objects accumulate in S3)
- `Content-Length` in the presigned `PutObjectCommand` is advisory only — does not enforce a hard server-side size cap. For stricter enforcement, add a bucket policy condition.
- No image processing (resize, format conversion) — raw uploads only
