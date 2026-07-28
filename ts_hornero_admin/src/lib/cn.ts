/**
 * Minimal `clsx`-style class name joiner — avoids pulling in the `clsx`/`tailwind-merge`
 * dependency chain that the legacy `@/lib/utils` `cn` used, since the admin SPA only needs
 * conditional concatenation (no Tailwind class conflict resolution here).
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(' ');
}
