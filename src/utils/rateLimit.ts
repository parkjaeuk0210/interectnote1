interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  key: string;
}

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  blocked: boolean;
  blockUntil?: number;
}

class RateLimiter {
  private storage: Map<string, RateLimitEntry>;

  constructor() {
    this.storage = new Map();
  }

  private pruneExpiredEntries(now: number): void {
    // Remove entries older than 1 hour (no background timer to reduce idle CPU wakeups)
    for (const [key, entry] of this.storage.entries()) {
      if (now - entry.lastAttempt > 3600000) {
        this.storage.delete(key);
      }
    }
  }

  private getKey(config: RateLimitConfig, identifier: string): string {
    return `${config.key}:${identifier}`;
  }

  private getIdentifier(): string {
    // Use a combination of factors for rate limiting
    const factors: string[] = [];
    
    // Add browser fingerprint elements
    if (typeof window !== 'undefined') {
      factors.push(navigator.userAgent);
      factors.push(navigator.language);
      factors.push(screen.width + 'x' + screen.height);
      factors.push(new Date().getTimezoneOffset().toString());
      
      // Try to get or create a persistent identifier
      let clientId = localStorage.getItem('_rl_client_id');
      if (!clientId) {
        // Use crypto-secure random generation
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        clientId = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('') + '_' + Date.now().toString(36);
        localStorage.setItem('_rl_client_id', clientId);
      }
      factors.push(clientId);
    }
    
    // Create a simple hash from factors
    return factors.join('|');
  }

  public async checkLimit(config: RateLimitConfig): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
  }> {
    const identifier = this.getIdentifier();
    const key = this.getKey(config, identifier);
    const now = Date.now();

    // Opportunistic cleanup to avoid always-on intervals (battery friendly)
    this.pruneExpiredEntries(now);
    
    let entry = this.storage.get(key);
    
    if (!entry) {
      entry = {
        attempts: 0,
        firstAttempt: now,
        lastAttempt: now,
        blocked: false
      };
      this.storage.set(key, entry);
    }

    // Check if currently blocked
    if (entry.blocked && entry.blockUntil && entry.blockUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.blockUntil,
        retryAfter: Math.ceil((entry.blockUntil - now) / 1000)
      };
    }

    // Reset if outside time window
    if (now - entry.firstAttempt > config.windowMs) {
      entry.attempts = 0;
      entry.firstAttempt = now;
      entry.blocked = false;
      entry.blockUntil = undefined;
    }

    // Increment attempts
    entry.attempts++;
    entry.lastAttempt = now;

    // Check if limit exceeded
    if (entry.attempts > config.maxAttempts) {
      entry.blocked = true;
      // Progressive blocking: double the window for each violation
      const blockDuration = config.windowMs * Math.pow(2, Math.floor(entry.attempts / config.maxAttempts) - 1);
      entry.blockUntil = now + blockDuration;
      
      this.storage.set(key, entry);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.blockUntil,
        retryAfter: Math.ceil(blockDuration / 1000)
      };
    }

    this.storage.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxAttempts - entry.attempts,
      resetAt: entry.firstAttempt + config.windowMs
    };
  }

  public reset(config: RateLimitConfig): void {
    const identifier = this.getIdentifier();
    const key = this.getKey(config, identifier);
    this.storage.delete(key);
  }

  public destroy(): void {
    this.storage.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Predefined rate limit configurations
export const RATE_LIMITS = {
  ANONYMOUS_SIGNIN: {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    key: 'anonymous_signin'
  },
  CANVAS_JOIN: {
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
    key: 'canvas_join'
  },
  SHARE_TOKEN_GENERATION: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    key: 'share_token'
  },
  FAILED_LOGIN: {
    maxAttempts: 5,
    windowMs: 30 * 60 * 1000, // 30 minutes
    key: 'failed_login'
  }
} as const;

// Export functions for rate limiting
export async function checkRateLimit(config: RateLimitConfig): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  return rateLimiter.checkLimit(config);
}

export function resetRateLimit(config: RateLimitConfig): void {
  rateLimiter.reset(config);
}

// Helper function to format retry message
export function formatRetryMessage(retryAfter: number): string {
  if (retryAfter < 60) {
    return `다시 시도하려면 ${retryAfter}초 기다려주세요.`;
  } else if (retryAfter < 3600) {
    const minutes = Math.ceil(retryAfter / 60);
    return `다시 시도하려면 ${minutes}분 기다려주세요.`;
  } else {
    const hours = Math.ceil(retryAfter / 3600);
    return `다시 시도하려면 ${hours}시간 기다려주세요.`;
  }
}

// Clean up on window unload (for browser environment)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    rateLimiter.destroy();
  });
}
