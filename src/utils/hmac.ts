import { createHmac, timingSafeEqual } from "node:crypto";

const signaturePrefix = "sha256=";

export function createWebhookSignature(rawBody: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `${signaturePrefix}${digest}`;
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader?.startsWith(signaturePrefix)) {
    return false;
  }

  const expected = createWebhookSignature(rawBody, secret);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
