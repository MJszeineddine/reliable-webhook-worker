import { z } from "zod";

export const crmWebhookSchema = z.object({
  eventId: z.string().min(8).max(120),
  eventType: z.enum(["contact.created", "contact.updated", "deal.updated", "task.completed"]),
  occurredAt: z.string().datetime(),
  accountId: z.string().min(3).max(80),
  data: z.object({
    crmObjectId: z.string().min(1).max(120),
    email: z.string().email().optional(),
    name: z.string().min(1).max(160).optional(),
    amount: z.number().nonnegative().optional(),
    status: z.string().min(1).max(80).optional()
  })
});

export type CrmWebhookPayload = z.infer<typeof crmWebhookSchema>;

export type WebhookJobData = {
  idempotencyKey: string;
  payload: CrmWebhookPayload;
  receivedAt: string;
};
