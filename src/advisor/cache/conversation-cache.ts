import { env } from "../../config/env.js";
import type { ConversationState } from "../types.js";

type CacheClient = {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: {
      EX?: number;
    },
  ): Promise<unknown>;
};

class ConversationCache {
  constructor(private readonly redis: CacheClient | null) {}

  async get(conversationId: string) {
    if (!this.redis) {
      return null;
    }

    const cached = await this.redis.get(`advisor:conversation:${conversationId}`);

    return cached ? (JSON.parse(cached) as ConversationState) : null;
  }

  async set(conversation: ConversationState) {
    if (!this.redis) {
      return;
    }

    await this.redis.set(
      `advisor:conversation:${conversation.id}`,
      JSON.stringify(conversation),
      {
        EX: env.ADVISOR_CACHE_TTL_SECONDS,
      },
    );
  }
}

export { ConversationCache };
