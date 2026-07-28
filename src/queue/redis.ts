import { Redis } from "ioredis";
import type { AppConfig } from "../config/env.js";

export function createRedisConnection(config: Pick<AppConfig, "REDIS_URL">): Redis {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false
  });
}
