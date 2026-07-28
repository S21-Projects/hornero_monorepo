/**
 * Cloudflare Turnstile constants shared by the widget and the API route.
 *
 * The site key is PUBLIC by design — it ships inside the HTML of every page
 * that renders the widget. The matching secret is never here: it is read on the
 * server from `process.env.TURNSTILE_SECRET`.
 */

/** Widget created in the Cloudflare dashboard. Public value, safe to commit. */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAD_Vsr2Hxy3s36M5';

/** Analytics attribution for the Turnstile Spin integration. */
export const TURNSTILE_ACTION = 'turnstile-spin-v2';

/** Field carrying the widget token in the request body. */
export const TURNSTILE_TOKEN_FIELD = 'cf-turnstile-response';

/** Loaded with `?render=explicit` so auto-scan cannot race the React island. */
export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, options: TurnstileRenderOptions): string;
      reset(widgetId?: string): void;
      remove(widgetId?: string): void;
    };
  }
}
