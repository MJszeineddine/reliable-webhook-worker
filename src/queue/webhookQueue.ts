import { Queue, QueueEvents } from "bullmq";
import type { Redis } from "ioredis";
import type { AppConfig } from "../config/env.js";
import type { WebhookJobData } from "../schemas/crmWebhook.js";

export type WebhookQueueBundle = {
  queue: Queue<WebhookJobData>;
  events: QueueEvents;
};

export function createWebhookQueue(config: Pick<AppConfig, "QUEUE_NAME" | "JOB_ATTEMPTS" | "JOB_BACKOFF_MS">, connection: Redis): WebhookQueueBundle {
  const queue = new Queue<WebhookJobData>(config.QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: config.JOB_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: config.JOB_BACKOFF_MS
      },
      removeOnComplete: {
        age: 60 * 60 * 24,
        count: 1000
      },
      removeOnFail: false
    }
  });

  const events = new QueueEvents(config.QUEUE_NAME, { connection });

  return { queue, events };
}
