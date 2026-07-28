import { loadConfig } from "./config/env.js";
import { buildApp } from "./http/app.js";
import { createRedisConnection } from "./queue/redis.js";
import { createWebhookQueue } from "./queue/webhookQueue.js";

const config = loadConfig();
const redis = createRedisConnection(config);
const { queue, events } = createWebhookQueue(config, redis);
const app = await buildApp({ config, redis, queue });

async function shutdown(): Promise<void> {
  app.log.info("shutting down");
  await app.close();
  await queue.close();
  await events.close();
  redis.disconnect();
}

process.once("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

process.once("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

await app.listen({ port: config.PORT, host: "0.0.0.0" });
