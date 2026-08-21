import { createClient } from "redis";

import { env } from "../config/env.js";

type RedisCacheClient = {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: {
      EX?: number;
    },
  ): Promise<unknown>;
};

let redisClientPromise: Promise<RedisCacheClient | null> | null = null;

const getRedisClient = async () => {
  if (!env.REDIS_ENABLED) {
    return null;
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({
        url: env.REDIS_URL,
      });

      client.on("error", (error) => {
        console.error("Redis client error", error);
      });

      await client.connect();

      return client;
    })().catch((error) => {
      redisClientPromise = null;
      throw error;
    });
  }

  return redisClientPromise;
};

export { getRedisClient };
