# Architecture

The service is split into a webhook API and a worker process.

## Components

- `src/http/app.ts`: Fastify application, signature verification, payload validation, duplicate handling, enqueueing, and status routes.
- `src/worker.ts`: BullMQ worker process with retry and terminal failure handling.
- `src/services/idempotencyStore.ts`: Redis-backed idempotency reservation.
- `src/services/webhookProcessor.ts`: integration work boundary used by the worker.
- `src/schemas/crmWebhook.ts`: Zod schema and TypeScript types for accepted webhook data.
- `src/utils/hmac.ts`: HMAC SHA-256 signing and verification.

## Runtime Flow

1. The simulated CRM sends a JSON payload with `x-crm-signature`.
2. The API verifies the HMAC using the exact raw request body.
3. The parsed payload is validated with Zod.
4. The service derives an idempotency key from `accountId`, `eventType`, and `eventId`.
5. Redis reserves that key with `SET NX`.
6. A new event is enqueued as a BullMQ job.
7. Duplicate events return `202` safely without enqueueing another job.
8. The worker handles jobs in a separate process.
9. Temporary failures retry with exponential backoff.
10. Terminal failures are marked unrecoverable and moved to BullMQ's failed-job path.

## Operational Boundaries

The HTTP process does not perform downstream CRM work inline. It authenticates, validates, records idempotency, and enqueues. This keeps webhook response times predictable and gives operators a queue to inspect when downstream systems are degraded.
