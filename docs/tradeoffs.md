# Engineering Tradeoffs

## Idempotency Key

The idempotency key is generated from `accountId`, `eventType`, and `eventId`. This assumes the CRM emits stable event ids. If an upstream system cannot guarantee that, the key strategy should include a normalized payload hash or a provider-specific delivery id.

## Redis Reservation

Redis `SET NX` is used before enqueueing. This rejects duplicates early, but it creates one edge case: if Redis accepts the reservation and queueing fails, the event may need a replay or reconciliation path. Production systems often pair this with a durable event log.

## Queue Retry Policy

Temporary failures use BullMQ attempts with exponential backoff. Terminal failures throw `UnrecoverableError`, so invalid events move to the failed-job path without consuming retry capacity.

## Status Endpoint

The status endpoint intentionally exposes only operational metadata. It does not return signed headers, webhook secrets, or full customer payloads.

## Demo Scope

The repository is intentionally small. It shows the reliability pattern without adding unrelated CRM-specific SDKs, dashboards, authentication providers, or deployment vendor lock-in.
