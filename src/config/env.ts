import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  WEBHOOK_SECRET: z.string().min(24, "WEBHOOK_SECRET must be at least 24 characters"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  QUEUE_NAME: z.string().min(1).default("crm-webhook-events"),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  JOB_ATTEMPTS: z.coerce.number().int().positive().default(5),
  JOB_BACKOFF_MS: z.coerce.number().int().positive().default(1000)
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}
