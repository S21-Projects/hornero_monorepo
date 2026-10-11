import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttler keyed by the real client IP. Production runs behind a Cloudflare Tunnel, so the
 * socket address is always the tunnel; `cf-connecting-ip` carries the visitor. Outside
 * Cloudflare (local dev, seed script) the header is absent and `req.ip` is used.
 *
 * The header is only trustworthy because the BFF is reachable solely through the tunnel
 * (cloudflared on localhost); do not expose the BFF port publicly.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const header = req.headers?.['cf-connecting-ip'];
    const value = (Array.isArray(header) ? header[0] : header)?.trim();
    return value || req.ip;
  }
}
