import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/http/app.js";
import type { WebhookJobData } from "../src/schemas/crmWebhook.js";
import { createWebhookSignature } from "../src/utils/hmac.js";
import { testConfig, toRawBody, validPayload } from "./fixtures.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redisAvailable = await canConnectToRedis(redisUrl);
let redis: Redis;
let queue: Queue<WebhookJobData>;
let app: Awaited<ReturnType<typeof buildApp>>;

describe.runIf(redisAvailable)("CRM webhook flow", () => {
  beforeAll(async () => {
    redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue<WebhookJobData>(`${testConfig.QUEUE_NAME}-${randomUUID()}`, {
      connection: redis,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 25 },
        removeOnComplete: true,
        removeOnFail: false
      }
    });
    app = await buildApp({ config: { ...testConfig, REDIS_URL: redisUrl, QUEUE_NAME: queue.name }, redis, queue });
  });

  beforeEach(async () => {
    await queue.drain(true);
    const keys = await redis.keys("webhook:idempotency:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    await app.close();
    await queue.close();
    redis.disconnect();
  });

  it("accepts a signed webhook and enqueues one job", async () => {
    const rawBody = toRawBody(validPayload);
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/crm",
      headers: {
        "content-type": "application/json",
        "x-crm-signature": createWebhookSignature(rawBody, testConfig.WEBHOOK_SECRET)
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(202);
    const body = response.json<{ accepted: boolean; duplicate: boolean; jobId: string }>();
    expect(body).toMatchObject({ accepted: true, duplicate: false });

    const job = await queue.getJob(body.jobId);
    expect(job?.data.payload.eventId).toBe(validPayload.eventId);
  });

  it("rejects duplicate events without enqueueing another job", async () => {
    const rawBody = toRawBody(validPayload);
    const headers = {
      "content-type": "application/json",
      "x-crm-signature": createWebhookSignature(rawBody, testConfig.WEBHOOK_SECRET)
    };

    const first = await app.inject({ method: "POST", url: "/webhooks/crm", headers, payload: rawBody });
    const second = await app.inject({ method: "POST", url: "/webhooks/crm", headers, payload: rawBody });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(second.json<{ duplicate: boolean }>().duplicate).toBe(true);
    expect(await queue.count()).toBe(1);
  });

  it("rejects invalid signatures", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/crm",
      headers: {
        "content-type": "application/json",
        "x-crm-signature": "sha256=invalid"
      },
      payload: toRawBody(validPayload)
    });

    expect(response.statusCode).toBe(401);
  });

  it("exposes safe job status", async () => {
    const job = await queue.add("sync-crm-event", {
      idempotencyKey: "demo",
      payload: validPayload,
      receivedAt: new Date().toISOString()
    });

    const response = await app.inject({ method: "GET", url: `/jobs/${job.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      jobId: job.id,
      name: "sync-crm-event"
    });
    expect(response.body).not.toContain(testConfig.WEBHOOK_SECRET);
  });
});

describe.skipIf(redisAvailable)("CRM webhook flow", () => {
  it("requires Redis for integration tests", () => {
    expect(redisAvailable).toBe(false);
  });
});

async function canConnectToRedis(url: string): Promise<boolean> {
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 250,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });
  client.on("error", () => {
    // Expected when local Redis or Docker is not running.
  });

  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}
