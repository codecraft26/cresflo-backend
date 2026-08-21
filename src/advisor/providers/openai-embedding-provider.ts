import { HttpError } from "../errors.js";
import { env } from "../../config/env.js";
import { createOpenAiClient } from "./openai-client.js";
import type { EmbeddingProvider } from "./embedding-provider.js";

class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai-embedding-provider";

  async embed(text: string) {
    if (!env.OPENAI_API_KEY) {
      throw new HttpError(500, "OPENAI_API_KEY is required for OpenAI embeddings.");
    }

    const client = createOpenAiClient();
    const response = await client.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: text,
      dimensions: env.ADVISOR_EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data[0]?.embedding;

    if (!embedding) {
      throw new HttpError(502, "OpenAI embedding response did not include a vector.");
    }

    return embedding;
  }
}

export { OpenAiEmbeddingProvider };
