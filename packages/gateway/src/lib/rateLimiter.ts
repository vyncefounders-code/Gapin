import Redis from 'ioredis';
import type { Redis as RedisType } from 'ioredis';

type LimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number; // epoch ms
};

const redisUrl = process.env.REDIS_URL || '';

class InMemoryBucket {
  private map = new Map<string, { count: number; ts: number }>();

  async increment(key: string, windowSec: number, limit: number): Promise<LimitResult> {
    const now = Date.now();
    const entry = this.map.get(key) || { count: 0, ts: now };
    if (now - entry.ts > windowSec * 1000) {
      entry.count = 1;
      entry.ts = now;
    } else {
      entry.count += 1;
    }
    this.map.set(key, entry);
    const remaining = Math.max(0, limit - entry.count);
    return { allowed: entry.count <= limit, remaining, reset: entry.ts + windowSec * 1000 };
  }
}

class RedisLimiter {
  private client: RedisType;

  constructor(url?: string) {
    this.client = url ? new Redis(url) : new Redis();
  }

  async increment(key: string, windowSec: number, limit: number): Promise<LimitResult> {
    const redisKey = `rate:${key}`;
    const tx = this.client.multi();
    tx.incr(redisKey);
    tx.pttl(redisKey);
    const res = await tx.exec();
    const count = Number(res?.[0][1] ?? 0);
    let ttl = Number(res?.[1][1] ?? -1);
    if (ttl <= 0) {
      await this.client.pexpire(redisKey, windowSec * 1000);
      ttl = windowSec * 1000;
    }
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining, reset: Date.now() + ttl };
  }
}

const limiter = redisUrl ? new RedisLimiter(redisUrl) : new InMemoryBucket();

export default limiter;
