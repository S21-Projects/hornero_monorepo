/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** Server-only: internal BFF URL (Railway internal or localhost:3001). Never exposed to the browser. */
  readonly BFF_BASE_URL: string;
  /** Client-exposed: browser-reachable BFF origin (for image GETs). */
  readonly PUBLIC_BFF_URL: string;
  /** Client-exposed: ts_hornero_app (SPA) origin for login/donate CTA deep-links. */
  readonly PUBLIC_SPA_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
