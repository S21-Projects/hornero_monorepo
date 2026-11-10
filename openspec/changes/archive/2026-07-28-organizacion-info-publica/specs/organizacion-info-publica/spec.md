# Organizacion Info Publica Specification

## Purpose

Define `aceptaDonaciones`, `sitioWebUrl`, and `donacionDirectaUrl` on `Organizacion`: their validation, clearing semantics, and public rendering on the Astro site. Covers only the fields and their storage/render rules — editing workflows (who can set them, approval gating) live in `organizacion-self-edit`.

## Requirements

### Requirement: Field Definitions and Defaults
The system MUST store `aceptaDonaciones` (Boolean, nullable, with Java-side default `false` via coalescing in reads), `sitioWebUrl` (String, max 500 chars, nullable), and `donacionDirectaUrl` (String, max 500 chars, nullable) on `Organizacion`.

#### Scenario: New organizacion with no values set
- GIVEN a newly created organizacion that never set any of the three fields
- WHEN it is persisted
- THEN `aceptaDonaciones` is `false`, `sitioWebUrl` is `NULL`, `donacionDirectaUrl` is `NULL`

### Requirement: URL Scheme Validation
The MS MUST reject `sitioWebUrl` and `donacionDirectaUrl` values that are not absolute `http` or `https` URLs, including `javascript:`, `data:`, and any other non-`http(s)` scheme, and MUST reject whitespace-only values, with a 400 response. `http` and `https` are both accepted (ASSUMPTION carried from the proposal's unconfirmed assumption #5 — restricting to `https`-only was flagged as a one-line change if the business later prefers it).

#### Scenario: Reject javascript scheme
- GIVEN a request sets `sitioWebUrl` to `javascript:alert(1)`
- WHEN the MS validates the request
- THEN it responds 400 and no value is persisted

#### Scenario: Reject data scheme
- GIVEN a request sets `donacionDirectaUrl` to `data:text/html,...`
- WHEN the MS validates the request
- THEN it responds 400 and no value is persisted

#### Scenario: Accept http alongside https
- GIVEN a request sets `sitioWebUrl` to `http://example.org`
- WHEN the MS validates the request
- THEN the value is accepted and persisted (per ASSUMPTION: http allowed alongside https)

#### Scenario: Reject whitespace-only value
- GIVEN a request sets `sitioWebUrl` to `"   "`
- WHEN the MS validates the request
- THEN it responds 400 and the existing value (if any) is unchanged

### Requirement: Field Independence
`donacionDirectaUrl` MAY be set regardless of the current value of `aceptaDonaciones` — the system MUST NOT enforce a cross-field rule requiring `aceptaDonaciones=true` before `donacionDirectaUrl` can hold a value. This is an ASSUMPTION carried from the proposal's unconfirmed assumption #4.

#### Scenario: Donation link set while aceptaDonaciones is false
- GIVEN an organizacion with `aceptaDonaciones=false`
- WHEN a valid `donacionDirectaUrl` is set
- THEN the value is persisted without requiring `aceptaDonaciones` to be `true`

### Requirement: Clear Sentinel
The system MUST treat an explicit empty string (`""`) submitted for `sitioWebUrl` or `donacionDirectaUrl` as an instruction to clear that field to `NULL`. Omitting a field from the request MUST leave its current value unchanged (null-means-unchanged).

#### Scenario: Clear a previously set link
- GIVEN an organizacion with `sitioWebUrl = "https://example.org"`
- WHEN a request sets `sitioWebUrl` to `""`
- THEN `sitioWebUrl` becomes `NULL`

#### Scenario: Omitted field is left unchanged
- GIVEN an organizacion with `sitioWebUrl = "https://example.org"`
- WHEN a request omits `sitioWebUrl` entirely
- THEN `sitioWebUrl` remains `"https://example.org"`

### Requirement: Badge Rendering
The public site MUST render a positive "accepts donations" badge only when `aceptaDonaciones` is `true`, independent of the organizacion's `estado`/`validada` status, and MUST render nothing (no badge, no negative indicator) when `aceptaDonaciones` is `false`. This is an ASSUMPTION carried from the proposal's unconfirmed assumption #3.

#### Scenario: Badge shown when true
- GIVEN a validated organizacion with `aceptaDonaciones=true`
- WHEN its detail page or card is rendered
- THEN a positive badge is shown

#### Scenario: No badge when false
- GIVEN a validated organizacion with `aceptaDonaciones=false`
- WHEN its detail page or card is rendered
- THEN no badge or negative indicator is shown

### Requirement: Link Rendering Safety
When `sitioWebUrl` or `donacionDirectaUrl` is set, the public detail page MUST render it as an escaped `<a href="...">` element (never `set:html` or a raw interpolated href) with `rel="noopener noreferrer nofollow"` and `target="_blank"`. Org cards (list/map views) MUST render only the `aceptaDonaciones` badge, never the two links, and MUST remain a single link to `/org/{slug}`.

#### Scenario: Detail page renders both links
- GIVEN an organizacion with both `sitioWebUrl` and `donacionDirectaUrl` set
- WHEN `/org/{slug}` is rendered
- THEN both render as `<a>` elements with `rel="noopener noreferrer nofollow"` and `target="_blank"`
- AND the internal "Ir a donar" CTA remains the primary action

#### Scenario: Card renders badge only
- GIVEN an organizacion with `sitioWebUrl`, `donacionDirectaUrl`, and `aceptaDonaciones=true` all set
- WHEN it is rendered in `OrgList.tsx` or `HomeMapExplorer.tsx`
- THEN only the badge is shown
- AND the card remains a single anchor to `/org/{slug}`

### Requirement: No Regression When Unset
An organizacion with no values set for any of the three fields MUST render identically to its pre-change appearance — no empty rows, no dead links, no badge.

#### Scenario: Org with no values set
- GIVEN an organizacion where `aceptaDonaciones=false`, `sitioWebUrl=NULL`, `donacionDirectaUrl=NULL`
- WHEN its detail page and card are rendered
- THEN no badge, no website link, and no donation link appear
- AND the layout matches the pre-change rendering
