# Mobile Views

Adds full mobile-responsive support to `ts_hornero_app`. The app previously had zero responsive handling — all layout used fixed inline styles.

## Approach

Two-system convention (enforced across all touched files):

- `className` → layout/structure: flex direction, grid, padding, width, visibility (`hidden`, `block`)
- `style` → visual/brand: colors, shadows, fonts, border-radius, CSS-var tokens

Tailwind v4 was already installed and wired via `@theme inline`; this change uses its responsive prefixes (`sm:`, `md:`, `lg:`) for layout only.

Breakpoints: `sm=640px`, `md=768px`, `lg=1024px` (Tailwind defaults).

## Changes

| File | What changed |
|------|-------------|
| `src/components/ui/top-bar.tsx` | Hamburger button + slide-in drawer with backdrop. Desktop nav hidden on mobile via `hidden md:flex`. Drawer closes on outside click, nav-item click, and route change. Body scroll lock while open. |
| `src/components/ui/admin-shell.tsx` | Sidebar becomes a fixed overlay drawer on mobile. Mobile sticky header with hamburger. Backdrop closes drawer on tap. Nav links close drawer on click. |
| `src/components/needs/needs-board.tsx` | Grid changes from fixed 3-col to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. |
| `src/components/admin/PendingOrgsList.tsx` | `overflow-x-auto` wrapper + `min-w-[640px]` on rows — horizontally scrollable on tablet. |
| `src/app/users/page.tsx` | Table hidden on mobile (`hidden sm:grid`). Card-list rendered for mobile (`sm:hidden`) with same data and handlers. |
| `src/app/org/[slug]/page.tsx` | 2-col layout stacks to 1-col below 640px. Right rail `w-full sm:w-[320px]`. Responsive padding `px-4 sm:px-10`. |
| `src/app/prefs/page.tsx` | Same as above, right rail `sm:w-[380px]`. |
| `src/app/donaciones/page.tsx` | `px-4 sm:px-10` |
| `src/app/needs/page.tsx` | `px-4 sm:px-10` |
| `src/app/organizaciones/page.tsx` | `px-4 sm:px-10` |
| `src/app/page.tsx` | Search bar `w-[calc(100%-32px)] sm:w-[min(760px,70%)]` for 16px side margins on mobile. |

## Pages not changed

`/login`, `/register`, `/dashboard` — already mobile-friendly (centered maxWidth cards).

## Verification

- Build: `npm run build` — PASS, 12/12 pages, 0 TypeScript errors
- Manual: DevTools responsive mode at 360px, 768px, 1280px across all 11 routes
