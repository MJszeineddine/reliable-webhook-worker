import type { AppConfig } from "../src/config/env.js";
import type { CrmWebhookPayload } from "../src/schemas/crmWebhook.js";

export const testConfig: AppConfig = {
  NODE_ENV: "test",
  PORT: 3000,
  LOG_LEVEL: "silent",
  WEBHOOK_SECRET: "test-secret-with-enough-length",
  REDIS_URL: "redis://localhost:6379",
  QUEUE_NAME: "crm-webhook-events-test",
  WORKER_CONCURRENCY: 1,
  JOB_ATTEMPTS: 3,
  JOB_BACKOFF_MS: 50
};

export const validPayload: CrmWebhookPayload = {
  eventId: "evt_01HZXKQ5FH8A3V1Q2W9R8T7Y6X",
  eventType: "contact.updated",
  occurredAt: "2026-07-28T10:30:00.000Z",
  accountId: "acct_demo",
  data: {
    crmObjectId: "contact_123",
    email: "demo@example.com",
    name: "Demo Contact",
    status: "active"
  }
};

export function toRawBody(payload: unknown): string {
  return JSON.stringify(payload);
}
