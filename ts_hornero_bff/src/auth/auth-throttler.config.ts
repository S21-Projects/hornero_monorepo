import type { ThrottlerModuleOptions } from '@nestjs/throttler';

const ONE_MINUTE_MS = 60_000;

/** Per-IP request budgets (per minute) of the rate-limited auth routes. */
export const AUTH_LIMITS = {
  login: 5,
  register: 3,
  refresh: 20,
  verifyOtp: 5,
  resendOtp: 3,
  passwordOlvido: 3,
  passwordRestablecer: 5,
} as const;

/** Window of every auth limit; the default limit is only a safety net for unannotated auth routes. */
export const authThrottle = (limit: number) => ({
  default: { limit, ttl: ONE_MINUTE_MS },
});

/**
 * Throttler options. There is deliberately NO global ThrottlerGuard: the guard is bound to
 * `AuthController` only, so the rest of the API is never rate limited.
 */
export const AUTH_THROTTLER_OPTIONS: ThrottlerModuleOptions = [
  { ttl: ONE_MINUTE_MS, limit: 20 },
];
