import type { Logger } from "pino";
import type { WebhookJobData } from "../schemas/crmWebhook.js";
import { TemporaryJobError, TerminalJobError } from "../utils/errors.js";

export async function processWebhookJob(job: WebhookJobData, logger: Logger): Promise<void> {
  logger.info(
    {
      idempotencyKey: job.idempotencyKey,
      eventId: job.payload.eventId,
      eventType: job.payload.eventType,
      accountId: job.payload.accountId
    },
    "processing webhook job"
  );

  if (job.payload.data.status === "temporary_failure") {
    throw new TemporaryJobError("Simulated retryable downstream failure");
  }

  if (job.payload.data.status === "terminal_failure") {
    throw new TerminalJobError("Simulated terminal validation failure");
  }

  await Promise.resolve();
}
