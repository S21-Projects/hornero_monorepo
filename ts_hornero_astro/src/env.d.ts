/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** Server-only: internal BFF URL (Railway internal or localhost:3001). Never exposed to the browser. */
  readonly BFF_BASE_URL: string;
  /** Client-exposed: browser-reachable BFF origin (for image GETs). */
  readonly PUBLIC_BFF_URL: string;
  /** Client-exposed: ts_hornero_app (SPA) origin for login/donate CTA deep-links. */
  readonly PUBLIC_SPA_URL: string;
  /** Server-only: mail provider key. Absent => contact form only logs to stdout. */
  readonly RESEND_API_KEY?: string;
  /** Server-only: verified sender, e.g. `web@elhornero.org`. Never the visitor's address. */
  readonly CONTACTO_FROM_EMAIL?: string;
  /** Server-only: inbox that receives contact submissions. */
  readonly CONTACTO_TO_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
