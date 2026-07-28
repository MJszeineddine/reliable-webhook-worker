import { describe, expect, it } from "vitest";
import { crmWebhookSchema } from "../src/schemas/crmWebhook.js";
import { createWebhookSignature, verifyWebhookSignature } from "../src/utils/hmac.js";
import { createIdempotencyKey } from "../src/utils/idempotency.js";
import { testConfig, toRawBody, validPayload } from "./fixtures.js";

describe("webhook HMAC signatures", () => {
  it("accepts a valid sha256 signature", () => {
    const rawBody = toRawBody(validPayload);
    const signature = createWebhookSignature(rawBody, testConfig.WEBHOOK_SECRET);

    expect(verifyWebhookSignature(rawBody, signature, testConfig.WEBHOOK_SECRET)).toBe(true);
  });

  it("rejects tampered payloads", () => {
    const rawBody = toRawBody(validPayload);
    const signature = createWebhookSignature(rawBody, testConfig.WEBHOOK_SECRET);
    const tamperedBody = toRawBody({ ...validPayload, eventId: "evt_tampered" });

    expect(verifyWebhookSignature(tamperedBody, signature, testConfig.WEBHOOK_SECRET)).toBe(false);
  });
});

describe("CRM payload validation", () => {
  it("accepts a valid payload", () => {
    expect(crmWebhookSchema.parse(validPayload)).toEqual(validPayload);
  });

  it("rejects unknown event types", () => {
    const invalidPayload = { ...validPayload, eventType: "invoice.paid" };

    expect(() => crmWebhookSchema.parse(invalidPayload)).toThrow();
  });
});

describe("idempotency keys", () => {
  it("is stable for the same business event", () => {
    expect(createIdempotencyKey(validPayload)).toBe(createIdempotencyKey({ ...validPayload }));
  });

  it("changes when the event id changes", () => {
    expect(createIdempotencyKey(validPayload)).not.toBe(
      createIdempotencyKey({ ...validPayload, eventId: "evt_different" })
    );
  });
});
