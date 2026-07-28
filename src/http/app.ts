import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { AppConfig } from "../config/env.js";
import { crmWebhookSchema, type WebhookJobData } from "../schemas/crmWebhook.js";
import { IdempotencyStore } from "../services/idempotencyStore.js";
import { HttpError } from "../utils/errors.js";
import { createIdempotencyKey } from "../utils/idempotency.js";
import { verifyWebhookSignature } from "../utils/hmac.js";

type AppDependencies = {
  config: AppConfig;
  redis: Redis;
  queue: Queue<WebhookJobData>;
};

export async function buildApp({ config, redis, queue }: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.x-crm-signature"]
    }
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });

  const idempotencyStore = new IdempotencyStore(redis);

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      void reply.status(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }

    if (error instanceof ZodError) {
      void reply.status(422).send({
        error: "payload_validation_failed",
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      });
      return;
    }

    app.log.error({ err: error }, "unhandled request error");
    void reply.status(500).send({ error: "internal_error" });
  });

  app.get("/health", async () => ({ ok: true }));

  app.post("/webhooks/crm", async (request: FastifyRequest<{ Body: string }>, reply: FastifyReply) => {
    const rawBody = request.body;
    const signature = getHeader(request, "x-crm-signature");

    if (!verifyWebhookSignature(rawBody, signature, config.WEBHOOK_SECRET)) {
      throw new HttpError(401, "invalid_signature", "Webhook signature verification failed");
    }

    const parsedJson = parseJson(rawBody);
    const payload = crmWebhookSchema.parse(parsedJson);
    const idempotencyKey = createIdempotencyKey(payload);
    const jobId = idempotencyKey;
    const duplicate = await idempotencyStore.reserve(idempotencyKey, jobId);

    if (!duplicate.accepted) {
      return reply.status(202).send({
        accepted: false,
        duplicate: true,
        idempotencyKey,
        jobId: duplicate.existingJobId ?? jobId
      });
    }

    const job = await queue.add(
      "sync-crm-event",
      {
        idempotencyKey,
        payload,
        receivedAt: new Date().toISOString()
      },
      { jobId }
    );

    request.log.info({ jobId: job.id, idempotencyKey, eventType: payload.eventType }, "webhook accepted");

    return reply.status(202).send({
      accepted: true,
      duplicate: false,
      idempotencyKey,
      jobId: job.id
    });
  });

  app.get("/jobs/:jobId", async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const { jobId } = request.params;
    const job = await queue.getJob(jobId);

    if (!job) {
      return reply.status(404).send({ error: "job_not_found" });
    }

    const state = await job.getState();
    const failedReason = state === "failed" ? job.failedReason : undefined;

    return {
      jobId: job.id,
      name: job.name,
      state,
      attemptsMade: job.attemptsMade,
      failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    };
  });

  return app;
}

function parseJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
  }
}

function getHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
