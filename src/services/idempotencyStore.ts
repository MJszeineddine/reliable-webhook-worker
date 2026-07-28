import type { Redis } from "ioredis";

export type DuplicateCheckResult =
  | { accepted: true }
  | { accepted: false; existingJobId: string | null };

export class IdempotencyStore {
  private readonly ttlSeconds = 60 * 60 * 24 * 7;

  public constructor(private readonly redis: Redis) {}

  public async reserve(key: string, jobId: string): Promise<DuplicateCheckResult> {
    const redisKey = this.toRedisKey(key);
    const result = await this.redis.set(redisKey, jobId, "EX", this.ttlSeconds, "NX");

    if (result === "OK") {
      return { accepted: true };
    }

    const existingJobId = await this.redis.get(redisKey);
    return { accepted: false, existingJobId };
  }

  private toRedisKey(key: string): string {
    return `webhook:idempotency:${key}`;
  }
}
