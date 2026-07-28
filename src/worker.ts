import { UnrecoverableError, Worker } from "bullmq";
import pino from "pino";
import { loadConfig } from "./config/env.js";
import { createRedisConnection } from "./queue/redis.js";
import type { WebhookJobData } from "./schemas/crmWebhook.js";
import { processWebhookJob } from "./services/webhookProcessor.js";
import { TerminalJobError } from "./utils/errors.js";

const config = loadConfig();
const logger = pino({ level: config.LOG_LEVEL });
const connection = createRedisConnection(config);

const worker = new Worker<WebhookJobData>(
  config.QUEUE_NAME,
  async (job) => {
    try {
      await processWebhookJob(job.data, logger);
    } catch (error) {
      if (error instanceof TerminalJobError) {
        logger.warn({ jobId: job.id, err: error }, "terminal job failure");
        throw new UnrecoverableError(error.message);
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: config.WORKER_CONCURRENCY
  }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "job completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, err: error }, "job failed");
});

async function shutdown(): Promise<void> {
  logger.info("shutting down worker");
  await worker.close();
  connection.disconnect();
}

process.once("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

process.once("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
