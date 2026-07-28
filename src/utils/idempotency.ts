import { createHash } from "node:crypto";
import type { CrmWebhookPayload } from "../schemas/crmWebhook.js";

export function createIdempotencyKey(payload: CrmWebhookPayload): string {
  const stableParts = [payload.accountId, payload.eventType, payload.eventId].join(":");
  return createHash("sha256").update(stableParts).digest("hex");
}
